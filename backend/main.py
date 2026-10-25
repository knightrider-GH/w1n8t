"""
UK Wind Generation Day-Ahead Forecast Evaluation — Backend API
Point-in-time evaluation of Elexon WINDFOR forecasts against FUELHH actuals for January 2026.
"""

import os, json, math
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

# ─────────────────────────────────────────────
# App Setup & CORS
# ─────────────────────────────────────────────
app = FastAPI(
    title="UK Wind Forecast Evaluation API",
    description="Elexon BMRS day-ahead wind forecast accuracy & procurement risk evaluation (Jan 2026)"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Load cached Elexon data (Decision window: Jan 2026)
# ─────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(BASE, "data_cache")

with open(os.path.join(CACHE, "fuelhh_jan2026.json")) as f:
    raw_actuals = json.load(f)

with open(os.path.join(CACHE, "windfor_jan2026.json")) as f:
    raw_forecasts = json.load(f)

# Actuals: 30-min settlement resolution (FUELHH)
actuals = {
    r["startTime"]: float(r["generation"])
    for r in raw_actuals if r.get("startTime") and r.get("generation") is not None
}

# Forecasts: 1-hour resolution (WINDFOR) grouped by target startTime
forecasts = defaultdict(list)
for r in raw_forecasts:
    st = r.get("startTime")
    pt = r.get("publishTime")
    if st and pt and r.get("generation") is not None:
        forecasts[st].append(r)

# All 31 delivery days in January 2026 (purchase decisions made 2025-12-31 to 2026-01-30)
DATES = sorted({k[:10] for k in actuals if k.startswith("2026-01-")})
STANDARD_CUTOFFS = [11, 12, 23]


# ─────────────────────────────────────────────
# Statistical Helpers
# ─────────────────────────────────────────────
def calc_percentile(data: list, p: float) -> float:
    """Calculate p-th percentile of a list using linear interpolation."""
    if not data:
        return 0.0
    s = sorted(data)
    k = (len(s) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


def calc_metrics(records: list) -> dict:
    """Compute MAE, RMSE, Bias, MAPE, Accuracy, and extremes."""
    if not records:
        return {}
    n = len(records)
    errors = [r["error"] for r in records]
    abs_e = [abs(e) for e in errors]
    mae = sum(abs_e) / n
    rmse = math.sqrt(sum(e**2 for e in errors) / n)
    bias = sum(errors) / n

    mape_vals = [abs(r["error"]) / r["actual"] * 100 for r in records if r["actual"] > 50]
    mape = sum(mape_vals) / len(mape_vals) if mape_vals else 0.0

    avg_act = sum(r["actual"] for r in records) / n
    avg_fc = sum(r["forecast"] for r in records) / n
    accuracy = max(0.0, round(100.0 - (mae / avg_act * 100.0), 1)) if avg_act else 0.0

    return {
        "count": n,
        "mae": round(mae, 1),
        "rmse": round(rmse, 1),
        "bias": round(bias, 1),
        "mape": round(mape, 1),
        "accuracy": accuracy,
        "avgActual": round(avg_act, 1),
        "avgForecast": round(avg_fc, 1),
        "maxError": round(max(errors), 1),
        "minError": round(min(errors), 1),
    }


# ─────────────────────────────────────────────
# Core Matching: Point-in-time D-1 Gate Closure & 30-min Alignment
# ─────────────────────────────────────────────
def match_day_raw(date_str: str, cutoff_hour: int) -> list:
    """
    Match actuals with the latest WINDFOR forecast strictly published before
    the D-1 Gate Closure (no look-ahead bias).
    Linearly aligns 1-hour WINDFOR forecasts into 30-minute settlement periods.
    """
    results = []
    delivery_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    cutoff_dt = datetime(delivery_date.year, delivery_date.month, delivery_date.day, cutoff_hour, 0, 0) - timedelta(days=1)
    cutoff_iso = cutoff_dt.isoformat() + "Z"

    for sp in range(48):
        hh = sp * 30
        hour = hh // 60
        minute = hh % 60
        start_time = f"{date_str}T{hour:02d}:{minute:02d}:00Z"
        h_st = f"{date_str}T{hour:02d}:00:00Z"

        if start_time not in actuals:
            continue
        actual_mw = actuals[start_time]

        # Latest forecast for current hour published before D-1 cutoff
        c_cur = [f for f in forecasts.get(h_st, []) if f["publishTime"] <= cutoff_iso]
        if not c_cur:
            continue
        cur_rec = max(c_cur, key=lambda x: x["publishTime"])
        v_cur = float(cur_rec["generation"])

        # 30-minute alignment via linear interpolation with next hour
        if minute == 0:
            forecast_mw = v_cur
            pub_time = cur_rec["publishTime"]
        else:
            next_dt = datetime(delivery_date.year, delivery_date.month, delivery_date.day, hour, 0, 0) + timedelta(hours=1)
            next_st = next_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            c_next = [f for f in forecasts.get(next_st, []) if f["publishTime"] <= cutoff_iso]
            if c_next:
                next_rec = max(c_next, key=lambda x: x["publishTime"])
                v_next = float(next_rec["generation"])
                forecast_mw = (v_cur + v_next) / 2.0
                pub_time = cur_rec["publishTime"]
            else:
                forecast_mw = v_cur
                pub_time = cur_rec["publishTime"]

        error = forecast_mw - actual_mw  # positive = over-forecast (deficit)

        results.append({
            "sp": sp + 1,
            "time": f"{hour:02d}:{minute:02d}",
            "actual": round(actual_mw, 1),
            "forecast": round(forecast_mw, 1),
            "error": round(error, 1),
            "publishTime": pub_time,
        })
    return results


# ─────────────────────────────────────────────
# In-Memory Cache Initialization (Precomputes all Jan 2026 cutoffs)
# ─────────────────────────────────────────────
CACHE_STORE = {}

def build_cache():
    """Precompute all monthly and daily slices for instantaneous UI responsiveness."""
    global CACHE_STORE
    store = {"days": {}, "months": {}, "sensitivity": []}

    # 1. Compute whole-month stats per cutoff to determine monthly P90 buffer
    cutoff_stats = {}
    for c in STANDARD_CUTOFFS:
        month_recs = []
        for d in DATES:
            month_recs.extend(match_day_raw(d, c))
        errors = [r["error"] for r in month_recs]
        over_errors = [e for e in errors if e > 0]
        p90_over = calc_percentile(over_errors, 90.0) if over_errors else 0.0
        p95_over = calc_percentile(over_errors, 95.0) if over_errors else 0.0
        p90_err = calc_percentile(errors, 90.0) if errors else 0.0
        metrics = calc_metrics(month_recs)

        cutoff_stats[c] = {
            "p90_over": p90_over,
            "p95_over": p95_over,
            "p90_err": p90_err,
            "pct_over": round(len(over_errors) / len(errors) * 100.0, 1) if errors else 0.0,
            "pct_under": round((len(errors) - len(over_errors)) / len(errors) * 100.0, 1) if errors else 0.0,
            "metrics": metrics,
        }

        cutoff_label = "11:00 UTC (EPEX)" if c == 11 else "12:00 UTC (NordPool)" if c == 12 else "23:00 UTC (D-1 Close)"
        store["sensitivity"].append({
            "cutoff": c,
            "label": cutoff_label,
            "mae": metrics["mae"],
            "rmse": metrics["rmse"],
            "bias": metrics["bias"],
            "p90": round(p90_err, 1),
            "p90Shortfall": round(p90_over, 1),
            "accuracy": metrics["accuracy"],
            "pctOver": cutoff_stats[c]["pct_over"]
        })

    # 2. Build enriched daily records with Safe Wind Baseline and Procurement Summaries
    for c in STANDARD_CUTOFFS:
        p90_buf = cutoff_stats[c]["p90_over"]
        store["days"][c] = {}
        all_month_enriched = []
        daily_summaries = []
        diurnal_map = {sp: {"errors": [], "abs_errors": [], "actuals": [], "forecasts": []} for sp in range(48)}

        for d in DATES:
            raw_recs = match_day_raw(d, c)
            enriched_recs = []
            for r in raw_recs:
                safe_bl = max(0.0, round(r["forecast"] - p90_buf, 1))
                rec = {
                    **r,
                    "safeBaseline": safe_bl,
                    "thermalGap": round(max(0.0, r["forecast"] - safe_bl), 1)
                }
                enriched_recs.append(rec)
                all_month_enriched.append(rec)
                sp_idx = r["sp"] - 1
                diurnal_map[sp_idx]["errors"].append(r["error"])
                diurnal_map[sp_idx]["abs_errors"].append(abs(r["error"]))
                diurnal_map[sp_idx]["actuals"].append(r["actual"])
                diurnal_map[sp_idx]["forecasts"].append(r["forecast"])

            d_metrics = calc_metrics(enriched_recs)

            # Daily actionable procurement decision summary
            tot_fc_mwh = round(sum(r["forecast"] * 0.5 for r in enriched_recs), 1)
            tot_act_mwh = round(sum(r["actual"] * 0.5 for r in enriched_recs), 1)
            rec_buf_mwh = round(sum((r["forecast"] - r["safeBaseline"]) * 0.5 for r in enriched_recs), 1)
            max_err_rec = max(enriched_recs, key=lambda x: x["error"]) if enriched_recs else None

            procurement_summary = {
                "expectedWindMWh": tot_fc_mwh,
                "actualWindMWh": tot_act_mwh,
                "recommendedThermalBufferMWh": rec_buf_mwh,
                "p90BufferMW": round(p90_buf, 1),
                "peakDeficitPeriod": f"{max_err_rec['time']} UTC (+{max_err_rec['error']:,.0f} MW)" if max_err_rec else "N/A",
                "peakDeficitMW": max_err_rec["error"] if max_err_rec else 0.0,
            }

            day_payload = {
                "date": d,
                "cutoffHour": c,
                "metrics": d_metrics,
                "procurementSummary": procurement_summary,
                "data": enriched_recs,
            }
            store["days"][c][d] = day_payload
            daily_summaries.append({"date": d, "metrics": d_metrics, "procurement": procurement_summary})

        # Diurnal (time-of-day) profile across all 48 settlement periods
        diurnal_profile = []
        for sp in range(48):
            hh = sp * 30
            t_str = f"{hh//60:02d}:{hh%60:02d}"
            s_err = diurnal_map[sp]["errors"]
            s_abs = diurnal_map[sp]["abs_errors"]
            diurnal_profile.append({
                "sp": sp + 1,
                "time": t_str,
                "bias": round(sum(s_err) / len(s_err), 1) if s_err else 0.0,
                "mae": round(sum(s_abs) / len(s_abs), 1) if s_abs else 0.0,
                "avgActual": round(sum(diurnal_map[sp]["actuals"]) / len(s_err), 1) if s_err else 0.0,
                "avgForecast": round(sum(diurnal_map[sp]["forecasts"]) / len(s_err), 1) if s_err else 0.0,
            })

        store["months"][c] = {
            "overall": cutoff_stats[c]["metrics"],
            "riskSummary": {
                "pctOver": cutoff_stats[c]["pct_over"],
                "pctUnder": cutoff_stats[c]["pct_under"],
                "p90Shortfall": round(cutoff_stats[c]["p90_over"], 1),
                "p95Shortfall": round(cutoff_stats[c]["p95_over"], 1),
                "p90Error": round(cutoff_stats[c]["p90_err"], 1),
            },
            "sensitivity": store["sensitivity"],
            "diurnal": diurnal_profile,
            "daily": daily_summaries,
        }

    CACHE_STORE = store

# Build in-memory cache once on startup
build_cache()


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────
@app.get("/api/dates")
def get_dates():
    """All January 2026 delivery dates."""
    return {"dates": DATES}


@app.get("/api/day")
def get_day(date: str = Query("2026-01-01"), cutoff_hour: int = Query(12)):
    """
    Time-series & procurement decision metrics for a single delivery day.
    Instantaneous response served directly from local precomputed cache.
    """
    c = cutoff_hour if cutoff_hour in CACHE_STORE["days"] else 12
    if date in CACHE_STORE["days"][c]:
        return CACHE_STORE["days"][c][date]
    # Fallback compute if custom date queried
    raw = match_day_raw(date, c)
    p90_buf = CACHE_STORE["months"][c]["riskSummary"]["p90Shortfall"]
    enriched = [{**r, "safeBaseline": max(0.0, round(r["forecast"] - p90_buf, 1))} for r in raw]
    return {"date": date, "cutoffHour": c, "metrics": calc_metrics(enriched), "data": enriched}


@app.get("/api/month")
def get_month(cutoff_hour: int = Query(12)):
    """
    Monthly evaluation payload:
    - Whole-month KPI metrics
    - Gate closure sensitivity comparison (11:00 vs 12:00 vs 23:00 UTC)
    - Diurnal (time-of-day) bias & MAE profile (periods 1–48)
    - Risk & bias breakdown (% over/under forecast & P90 shortfall)
    - Daily audit table records
    """
    c = cutoff_hour if cutoff_hour in CACHE_STORE["months"] else 12
    return CACHE_STORE["months"][c]


# ─────────────────────────────────────────────
# Serve built React frontend (production / Docker)
# ─────────────────────────────────────────────
FRONTEND = os.path.join(BASE, "frontend", "dist")
if os.path.exists(FRONTEND):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND, "index.html"))
