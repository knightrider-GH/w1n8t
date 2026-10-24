import os
import json
import math
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Any, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_CACHE_DIR = os.path.join(os.path.dirname(BASE_DIR), "data_cache")

class WindDataService:
    def __init__(self, cache_dir: str = DATA_CACHE_DIR):
        self.cache_dir = cache_dir
        self.actuals_raw: List[Dict[str, Any]] = []
        self.forecasts_raw: List[Dict[str, Any]] = []
        # Map: "YYYY-MM-DDTHH:MM:SSZ" -> generation (MW)
        self.actual_by_start: Dict[str, float] = {}
        # Map: "YYYY-MM-DDTHH:MM:SSZ" -> list of forecast objects
        self.forecasts_by_start: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.available_dates: List[str] = []
        self.load_data()

    def load_data(self):
        fuel_path = os.path.join(self.cache_dir, "fuelhh_jan2026.json")
        windfor_path = os.path.join(self.cache_dir, "windfor_jan2026.json")

        if os.path.exists(fuel_path):
            with open(fuel_path, "r", encoding="utf-8") as f:
                self.actuals_raw = json.load(f)
                for a in self.actuals_raw:
                    st = a.get("startTime")
                    gen = a.get("generation")
                    if st and gen is not None:
                        self.actual_by_start[st] = float(gen)

        if os.path.exists(windfor_path):
            with open(windfor_path, "r", encoding="utf-8") as f:
                self.forecasts_raw = json.load(f)
                for item in self.forecasts_raw:
                    st = item.get("startTime")
                    pub = item.get("publishTime")
                    gen = item.get("generation")
                    if st and pub and gen is not None:
                        self.forecasts_by_start[st].append(item)

        dates_set = set()
        for st in self.actual_by_start.keys():
            if st.startswith("2026-01-"):
                dates_set.add(st[:10])
        self.available_dates = sorted(list(dates_set))

    def get_matched_points(self, date_str: Optional[str] = None, cutoff_hour: int = 12, resolution: str = "30min") -> List[Dict[str, Any]]:
        """
        Match actual wind generation with day-ahead forecast.
        resolution: 
          - '30min': 48 half-hour settlement periods per day. If WINDFOR is hourly, interpolates or steps to 30m.
          - 'hourly': 24 hourly periods per day (averaging two 30-min actuals).
        cutoff_hour: Hour on D-1 used as gate closure (e.g., 11:00 or 12:00 UTC).
        """
        matched = []
        target_dates = [date_str] if date_str else self.available_dates

        for d_str in target_dates:
            delivery_date = datetime.strptime(d_str, "%Y-%m-%d").date()
            cutoff_dt = datetime(delivery_date.year, delivery_date.month, delivery_date.day, cutoff_hour, 0, 0) - timedelta(days=1)
            cutoff_iso = cutoff_dt.isoformat() + "Z"

            if resolution == "hourly":
                # 24 periods: HH:00:00Z
                for hour in range(24):
                    st_top = f"{d_str}T{hour:02d}:00:00Z"
                    st_half = f"{d_str}T{hour:02d}:30:00Z"

                    # Calculate average actual generation for the hour
                    act_vals = []
                    if st_top in self.actual_by_start:
                        act_vals.append(self.actual_by_start[st_top])
                    if st_half in self.actual_by_start:
                        act_vals.append(self.actual_by_start[st_half])
                    if not act_vals:
                        continue
                    act_avg = sum(act_vals) / len(act_vals)

                    # Latest forecast published <= cutoff_iso
                    fcs = [f for f in self.forecasts_by_start.get(st_top, []) if f["publishTime"] <= cutoff_iso]
                    if not fcs:
                        continue
                    fcs.sort(key=lambda x: x["publishTime"])
                    chosen = fcs[-1]
                    fc_val = float(chosen["generation"])

                    err = fc_val - act_avg
                    abs_err = abs(err)
                    pct_err = (abs_err / act_avg * 100.0) if act_avg > 50 else 0.0

                    matched.append({
                        "startTime": st_top,
                        "date": d_str,
                        "time": f"{hour:02d}:00",
                        "settlementPeriodHour": hour + 1,
                        "actual": round(act_avg, 1),
                        "forecast": round(fc_val, 1),
                        "publishTime": chosen["publishTime"],
                        "error": round(err, 1),
                        "absError": round(abs_err, 1),
                        "sqError": round(err ** 2, 1),
                        "pctError": round(pct_err, 1),
                        "procurementRisk": "Deficit (Need Thermal/Balancing)" if err > 0 else "Surplus (Excess Day-Ahead Wind)"
                    })
            else:
                # 30-min resolution (48 settlement periods)
                for sp in range(1, 49):
                    # Period 1: 00:00, Period 2: 00:30, etc.
                    minute = (sp - 1) * 30
                    hour = minute // 60
                    min_part = minute % 60
                    st = f"{d_str}T{hour:02d}:{min_part:02d}:00Z"

                    if st not in self.actual_by_start:
                        continue
                    act_val = self.actual_by_start[st]

                    # Match forecast: if 30m exact exists, use it. Otherwise, use top of the hour forecast
                    st_top = f"{d_str}T{hour:02d}:00:00Z"
                    fcs = [f for f in self.forecasts_by_start.get(st, []) if f["publishTime"] <= cutoff_iso]
                    if not fcs:
                        # Fallback to hourly forecast
                        fcs = [f for f in self.forecasts_by_start.get(st_top, []) if f["publishTime"] <= cutoff_iso]
                    
                    if not fcs:
                        continue
                    fcs.sort(key=lambda x: x["publishTime"])
                    chosen = fcs[-1]
                    fc_val = float(chosen["generation"])

                    err = fc_val - act_val
                    abs_err = abs(err)
                    pct_err = (abs_err / act_val * 100.0) if act_val > 50 else 0.0

                    matched.append({
                        "startTime": st,
                        "date": d_str,
                        "time": f"{hour:02d}:{min_part:02d}",
                        "settlementPeriod": sp,
                        "actual": round(act_val, 1),
                        "forecast": round(fc_val, 1),
                        "publishTime": chosen["publishTime"],
                        "error": round(err, 1),
                        "absError": round(abs_err, 1),
                        "sqError": round(err ** 2, 1),
                        "pctError": round(pct_err, 1),
                        "procurementRisk": "Deficit (Need Thermal/Balancing)" if err > 0 else "Surplus (Excess Day-Ahead Wind)"
                    })

        return matched

    def compute_metrics(self, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute comprehensive statistical metrics."""
        if not points:
            return {
                "count": 0,
                "mae": 0.0,
                "rmse": 0.0,
                "meanBias": 0.0,
                "mape": 0.0,
                "maxOverForecast": 0.0,
                "maxUnderForecast": 0.0,
                "avgActual": 0.0,
                "avgForecast": 0.0,
                "accuracyPercent": 0.0
            }

        n = len(points)
        sum_abs_err = sum(p["absError"] for p in points)
        sum_sq_err = sum(p["sqError"] for p in points)
        sum_err = sum(p["error"] for p in points)
        sum_actual = sum(p["actual"] for p in points)
        sum_forecast = sum(p["forecast"] for p in points)

        mape_points = [p["pctError"] for p in points if p["actual"] > 50]
        avg_mape = (sum(mape_points) / len(mape_points)) if mape_points else 0.0

        errors = [p["error"] for p in points]
        mae = sum_abs_err / n
        avg_act = sum_actual / n
        # Standard accuracy = 100 - Normalized MAE (NMAE)
        accuracy = max(0.0, round(100.0 - (mae / avg_act * 100.0 if avg_act > 0 else 0.0), 1))

        return {
            "count": n,
            "mae": round(mae, 2),
            "rmse": round(math.sqrt(sum_sq_err / n), 2),
            "meanBias": round(sum_err / n, 2),
            "mape": round(avg_mape, 2),
            "maxOverForecast": round(max(errors), 2) if errors else 0.0,
            "maxUnderForecast": round(min(errors), 2) if errors else 0.0,
            "avgActual": round(avg_act, 2),
            "avgForecast": round(sum_forecast / n, 2),
            "accuracyPercent": accuracy
        }

    def get_daily_summaries(self, cutoff_hour: int = 12) -> List[Dict[str, Any]]:
        """Summary metrics for each day in January 2026."""
        summaries = []
        for date_str in self.available_dates:
            day_points = self.get_matched_points(date_str=date_str, cutoff_hour=cutoff_hour, resolution="30min")
            metrics = self.compute_metrics(day_points)
            summaries.append({
                "date": date_str,
                "metrics": metrics
            })
        return summaries
