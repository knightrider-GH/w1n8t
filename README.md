# VoltWise UK: Day-Ahead Wind Generation Decision Support & Error Evaluation

An enterprise-grade wholesale power procurement decision support web application built for UK energy utilities. The platform empowers trading and procurement teams to evaluate the latest day-ahead renewable generation forecasts, quantify empirical prediction error (MAE, RMSE, Bias, MAPE), and optimize thermal/flexible generation procurement to avoid costly imbalance cashouts.

---

## 🌟 Executive Summary & Problem Setting

In the UK electricity wholesale market, retailers serve end-consumer demand through power procured in advance. Day-ahead market decisions (e.g., EPEX Spot, Nord Pool) are finalized **one day before the delivery day (D-1)** before market gate closures (typically 11:00 or 12:00 UTC).

Because wind power is weather-dependent and volatile:
1. **Procurement Gap**: Any deficit between forecasted wind and actual delivered wind must be covered by procuring additional thermal/peaker assets or transacting in costly intra-day/balancing markets.
2. **Quantified Error**: Without quantifying forecast uncertainty, procurement desks either over-procure (wasting capital on unused power) or under-procure (facing severe cashout penalties).

This platform ingests live national-level Elexon BMRS datasets for **January 2026** to provide actionable intelligence for day-ahead purchasing decisions.

---

## 📊 Datasets Utilized (Elexon BMRS)

1. **Actual Wind Generation (`FUELHH`)**:
   - Source: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream`
   - Filter: `fuelType = "WIND"`
   - Granularity: Half-hour settlement periods (48 periods/day).
2. **Forecasted Generation (`WINDFOR`)**:
   - Source: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream`
   - Attributes: Target `startTime`, publication `publishTime`, and forecasted `generation` (MW).
   - Matching: The latest forecast run locked **before the D-1 Day-Ahead Gate Closure** (e.g. 11:00 UTC, 12:00 UTC, or end of D-1) is aligned to each settlement period.

---

## 📁 Repository Directory Structure

```
├── Dockerfile                  # Multi-stage container build (Node + Python)
├── docker-compose.yml          # Container orchestration configuration
├── README.md                   # Complete architectural, usage, and pitch documentation
├── backend/                    # Python Backend
│   ├── main.py                 # FastAPI application, routing, CORS, and static file serving
│   ├── data_service.py         # Ingestion, D-1 forecast matching logic & statistical calculations
│   └── requirements.txt        # Python backend dependencies
├── data_cache/                 # Cached January 2026 Elexon datasets
│   ├── fuelhh_jan2026.json     # 1,489 actual wind generation records (Jan 2026)
│   └── windfor_jan2026.json    # 19,272 wind generation forecast runs
└── frontend/                   # React Frontend (Vite + TypeScript + Tailwind CSS)
    ├── index.html              # HTML shell with Google Fonts
    ├── vite.config.ts          # Vite build and proxy settings
    ├── package.json            # Frontend scripts and dependencies
    └── src/
        ├── App.tsx             # Complete interactive trading & procurement dashboard
        ├── main.tsx            # React root component mounting
        ├── index.css           # Styling and design system tokens
        └── vite-env.d.ts       # TypeScript module declarations
```

---

## 🚀 How to Start the Application

### Option A: Using Docker (Recommended for Production / Reviewers)

Make sure Docker is running on your machine, then run:

```bash
docker compose up --build
```

The application will be compiled and accessible at **`http://localhost:8000`**.

---

### Option B: Running Locally (Fastest Development Setup)

#### 1. Start the Python Backend:
```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Run the FastAPI server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend will start at: `http://127.0.0.1:8000` (API documentation available at `http://127.0.0.1:8000/docs`).

#### 2. Start the React Frontend:
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Frontend will be accessible at: **`http://localhost:3000`**.

---

## 📈 Quantitative Error Methodology

The quantitative error evaluation engine computes standard power industry error metrics:

1. **Mean Absolute Error (MAE)**:
   $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |\text{Forecast}_i - \text{Actual}_i|$$
   Represents the expected magnitude of procurement mismatch per settlement period.

2. **Root Mean Square Error (RMSE)**:
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (\text{Forecast}_i - \text{Actual}_i)^2}$$
   Heavily penalizes volatile forecast outliers.

3. **Forecast Bias (Mean Error)**:
   $$\text{Bias} = \frac{1}{N} \sum_{i=1}^N (\text{Forecast}_i - \text{Actual}_i)$$
   Positive bias indicates systematic over-forecasting (requiring thermal backup to cover generation deficits).

4. **Normalized Accuracy %**:
   $$\text{Accuracy} = 100\% - \left(\frac{\text{MAE}}{\overline{\text{Actual}}}\right) \times 100\%$$

---

## 🌐 Deployment Links

- **Live Deployed Web Application**: `[Add your Vercel / Heroku / Render URL here]`
- **Unlisted YouTube Video Demo**: `[Add your YouTube Video URL here]`

---

## 🤖 AI Disclosure

As explicitly permitted in Section 2 of the problem guidelines, AI-assisted tools (Google Antigravity IDE and LLM agentic pair-programming) were utilized to accelerate boilerplate generation, API schema discovery, and data visualization scaffolding. All core domain modeling, Elexon matching logic, error calculations, and system integration were verified for accuracy.
