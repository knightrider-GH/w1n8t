import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from backend.data_service import WindDataService

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


app = FastAPI(
    title="UK Wind Generation Day-Ahead Forecast Evaluation API",
    description="REST API for UK Day-Ahead electricity procurement decision support & forecast error quantification",
    version="1.0.0"
)

# Enable CORS for React frontend (local dev & production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = WindDataService()

# Serve static frontend files if built (e.g. in Docker or single-server deployment)
frontend_dist = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/")
    def serve_frontend_index():
        return FileResponse(os.path.join(frontend_dist, "index.html"))


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Wind Forecast Evaluation API",
        "januaryDaysAvailable": len(service.available_dates)
    }

@app.get("/api/dates")
def get_available_dates():
    """Returns all available delivery dates in January 2026."""
    return {
        "dates": service.available_dates,
        "defaultDate": service.available_dates[0] if service.available_dates else "2026-01-01"
    }

@app.get("/api/forecast-vs-actual")
def get_forecast_vs_actual(
    date: Optional[str] = Query(None, description="Delivery date in YYYY-MM-DD format (January 2026)"),
    cutoff_hour: int = Query(12, description="D-1 Day-Ahead Gate Closure hour in UTC (e.g. 11, 12, or 23)"),
    resolution: str = Query("30min", description="Data resolution: '30min' or 'hourly'")
):
    """
    Get 30-minute settlement period or hourly generation data (Actual vs Latest Day-Ahead Forecast).
    """
    selected_date = date if date else (service.available_dates[0] if service.available_dates else "2026-01-01")
    points = service.get_matched_points(date_str=selected_date, cutoff_hour=cutoff_hour, resolution=resolution)
    metrics = service.compute_metrics(points)
    
    return {
        "date": selected_date,
        "cutoffHour": cutoff_hour,
        "resolution": resolution,
        "metrics": metrics,
        "data": points
    }

@app.get("/api/monthly-metrics")
def get_monthly_metrics(
    cutoff_hour: int = Query(12, description="D-1 Day-Ahead Gate Closure hour in UTC")
):
    """
    Returns monthly aggregate metrics and daily summaries across all of January 2026.
    """
    all_points = service.get_matched_points(date_str=None, cutoff_hour=cutoff_hour, resolution="30min")
    overall_metrics = service.compute_metrics(all_points)
    daily_summaries = service.get_daily_summaries(cutoff_hour=cutoff_hour)

    return {
        "overall": overall_metrics,
        "daily": daily_summaries
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
