"""
UK Wind Generation Day-Ahead Forecast Evaluation — Backend API
Fetches data from Elexon BMRS and computes forecast accuracy metrics.
"""

import os, json, math
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────
app = FastAPI(title="Wind Forecast Evaluation API")

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ─────────────────────────────────────────────
# Load cached Elexon data from disk (Jan 2026)
# ─────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, "data_cache")

with open(os.path.join(CACHE, "fuelhh_jan2026.json")) as f:
    raw_actuals = json.load(f)

with open(os.path.join(CACHE, "windfor_jan2026.json")) as f:
    raw_forecasts = json.load(f)

# Build lookup dicts
actuals = {r["startTime"]: float(r["generation"])
           for r in raw_actuals if r.get("startTime") and r.get("generation") is not None}

forecasts = defaultdict(list)   # key: startTime, value: list of {publishTime, generation}
for r in raw_forecasts:
    if r.get("startTime") and r.get("publishTime") and r.get("generation") is not None:
        forecasts[r["startTime"]].append(r)

# All January 2026 delivery dates
DATES = sorted({k[:10] for k in actuals if k.startswith("2026-01-")})

# ─────────────────────────────────────────────
# Core helper: match actuals with day-ahead forecast
# ─────────────────────────────────────────────
def match_day(date_str: str, cutoff_hour: int) -> list:
    """
    For every 30-min settlement period on date_str, find the latest
    forecast that was published BEFORE the Day-Ahead Gate Closure on D-1.
    Returns a list of matched records with actual, forecast, and error.
    """
    results = []
    delivery_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    # Gate closure timestamp: e.g. 2026-01-01 → cutoff is 2025-12-31 at cutoff_hour:00
    cutoff_iso = (
        datetime(delivery_date.year, delivery_date.month, delivery_date.day,
                 cutoff_hour, 0, 0) - timedelta(days=1)
    ).isoformat() + "Z"

    for sp in range(48):                         # 48 half-hour periods per day
        hh = sp * 30
        start_time = f"{date_str}T{hh//60:02d}:{hh%60:02d}:00Z"
        hourly_time = f"{date_str}T{hh//60:02d}:00:00Z"   # fallback for hourly forecasts

        if start_time not in actuals:
            continue
        actual_mw = actuals[start_time]

        # Pick the latest forecast published before the gate closure
        candidates = [f for f in forecasts.get(start_time, [])
                      if f["publishTime"] <= cutoff_iso]
        if not candidates:
            candidates = [f for f in forecasts.get(hourly_time, [])
                          if f["publishTime"] <= cutoff_iso]
        if not candidates:
            continue

        forecast_rec = max(candidates, key=lambda x: x["publishTime"])
        forecast_mw  = float(forecast_rec["generation"])
        error        = forecast_mw - actual_mw      # positive = over-forecast

        results.append({
            "time":        f"{hh//60:02d}:{hh%60:02d}",
            "actual":      round(actual_mw, 1),
            "forecast":    round(forecast_mw, 1),
            "error":       round(error, 1),
            "publishTime": forecast_rec["publishTime"],
        })
    return results


def calc_metrics(records: list) -> dict:
    """Compute MAE, RMSE, Bias, MAPE, and Accuracy from matched records."""
    if not records:
        return {}
    n      = len(records)
    errors = [r["error"] for r in records]
    abs_e  = [abs(e) for e in errors]
    mae    = sum(abs_e) / n
    rmse   = math.sqrt(sum(e**2 for e in errors) / n)
    bias   = sum(errors) / n
    mape_vals = [abs(r["error"]) / r["actual"] * 100
                 for r in records if r["actual"] > 50]
    mape   = sum(mape_vals) / len(mape_vals) if mape_vals else 0
    avg_act = sum(r["actual"] for r in records) / n
    accuracy = max(0, round(100 - mae / avg_act * 100, 1)) if avg_act else 0

    return {
        "count":       n,
        "mae":         round(mae, 1),
        "rmse":        round(rmse, 1),
        "bias":        round(bias, 1),
        "mape":        round(mape, 1),
        "accuracy":    accuracy,
        "avgActual":   round(avg_act, 1),
        "avgForecast": round(sum(r["forecast"] for r in records) / n, 1),
        "maxError":    round(max(errors), 1),
        "minError":    round(min(errors), 1),
    }


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────
@app.get("/api/dates")
def get_dates():
    """All available delivery dates in January 2026."""
    return {"dates": DATES}


@app.get("/api/day")
def get_day(date: str = Query("2026-01-01"), cutoff_hour: int = Query(12)):
    """
    Time-series: Actual vs Day-Ahead Forecast for a single delivery date.
    cutoff_hour: hour on D-1 representing the Day-Ahead Gate Closure (e.g. 11 or 12).
    """
    records = match_day(date, cutoff_hour)
    return {"date": date, "cutoffHour": cutoff_hour,
            "metrics": calc_metrics(records), "data": records}


@app.get("/api/month")
def get_month(cutoff_hour: int = Query(12)):
    """Aggregate metrics + daily breakdown for all of January 2026."""
    all_records, daily = [], []
    for d in DATES:
        recs = match_day(d, cutoff_hour)
        all_records.extend(recs)
        daily.append({"date": d, "metrics": calc_metrics(recs)})
    return {"overall": calc_metrics(all_records), "daily": daily}


# ─────────────────────────────────────────────
# Serve built React frontend (production / Docker)
# ─────────────────────────────────────────────
FRONTEND = os.path.join(BASE, "frontend", "dist")
if os.path.exists(FRONTEND):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND, "assets")), name="assets")

    @app.get("/")
    def frontend():
        return FileResponse(os.path.join(FRONTEND, "index.html"))
