# UK Wind Forecast Dashboard

A web app for UK electricity procurement teams to evaluate day-ahead wind generation forecasts against actuals (January 2026).

## Files & Directories

```
intern_demo/
├── backend/
│   └── main.py          # Python backend: data loading + error calculations + API (FastAPI)
├── frontend/
│   ├── index.html       # HTML shell
│   ├── vite.config.js   # Vite config (dev proxy to backend)
│   ├── package.json     # React dependencies
│   └── src/
│       ├── main.jsx     # React entry point (mounts App)
│       └── App.jsx      # Full dashboard UI (charts, metrics, table)
├── data_cache/
│   ├── fuelhh_jan2026.json   # Elexon actual wind generation (Jan 2026)
│   └── windfor_jan2026.json  # Elexon day-ahead wind forecasts (Jan 2026)
├── Dockerfile           # Container build (Node + Python, single image)
├── docker-compose.yml   # One-command startup
└── README.md
```

## How to Start (Local Development)

### 1. Backend (Python / FastAPI)
```bash
pip install fastapi uvicorn
python -m uvicorn backend.main:app --port 8000
```
API available at http://localhost:8000/docs

### 2. Frontend (React / Vite)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

### Or: Run with Docker (one command)
```bash
docker compose up --build
```
Open http://localhost:8000

## Live App
> [Add deployed URL here after deploying to Render / Heroku]

## AI Tool Disclosure
This application was built with assistance from Google Antigravity (AI-powered coding assistant). All data logic, Elexon matching methodology, and metric calculations were verified for correctness.
