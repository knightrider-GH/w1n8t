# Video Presentation Script (10-Minute Maximum)

This guide provides the exact script and talking points for your 2-part video recording.
- **Part 1 (0:00 - 4:30)**: Client Pitch & Product Demonstration (Presenting to the Energy Utility).
- **Part 2 (4:30 - 9:00)**: Technical Architecture & Code Walkthrough (Explaining to the Internal Tech Lead).

---

## 🎬 Part 1: Client Pitch (Max 5 Minutes)
**Audience:** The Head of Power Procurement / Day-Ahead Trading Desk at a UK Energy Utility.
**Your Role:** Product Developer delivering the pilot solution.
**Screen to Show:** Have `http://localhost:8000` or `http://localhost:3000` open in full screen on the "Delivery Day View".

### Script:
> "Hello everyone, thank you for your time today.
>
> As an energy utility in the UK wholesale market, your core operational challenge is procuring enough electricity in the day-ahead auction to reliably meet your consumers' demand.
>
> Wind generation is clean and cost-effective, but highly volatile. Because day-ahead purchasing decisions must be committed on D-1 before the market gate closure, your trading desk must rely on renewable forecasts to determine how much thermal or peaking power needs to be contracted. 
>
> If the wind forecast is too optimistic, you face a dangerous supply deficit in real time, forcing expensive balancing mechanism cashouts. If it is too pessimistic, you over-buy thermal generation and tie up capital.
>
> To solve this, we built **VoltWise UK**—a customized decision support and forecast evaluation platform.
>
> Let's look at the live application.
>
> Here on the **Delivery Day View**, we are analyzing delivery dates across **January 2026** using live data from Elexon BMRS.
>
> At the top, you can adjust the **D-1 Gate Closure Cutoff**. For example, selecting 12:00 UTC ensures that we only consider the latest forecast runs that were genuinely available to your traders before bidding closed.
>
> Looking at the main chart:
> - The **cyan area curve** shows the actual wind generation delivered across all 48 half-hour settlement periods.
> - The **amber dashed curve** displays the locked day-ahead forecast.
>
> Immediately below, our **Quantified Error Engine** gives your desk four vital decision signals:
> 1. **MAE (Mean Absolute Error):** On this day, the average deviation was approximately 4,200 MW. This is the exact volume of flexible thermal buffer your desk needs to keep on standby.
> 2. **RMSE:** Which penalizes extreme spike errors, showing volatility exposure.
> 3. **Forecast Bias:** Showing whether the forecast systematically over-predicted or under-predicted. Over-prediction directly flags a real-time supply deficit risk!
> 4. **Model Accuracy %:** Giving traders a clear confidence score for the day.
>
> Below that, the **Quantified Error by Settlement Period chart** pinpoints exactly which hours had peak forecasting errors—for example, during morning or evening ramp periods—allowing your desk to hedge specific half-hour blocks rather than buying flat thermal power all day.
>
> Now, switching to the **Jan 2026 Evaluation tab**:
> Here, your risk and trading managers can review the entire month. You can see the full 31-day trajectory of error, identify high-volatility storm days, and review the complete audit table across all 1,488 settlement periods.
>
> In summary, VoltWise UK turns raw Elexon forecast feeds into actionable procurement buffers, protecting your balance sheet from imbalance penalties while maximizing clean wind consumption. Thank you!"

---

## 🛠️ Part 2: Technical Walkthrough (Max 5 Minutes)
**Audience:** Internal Technical Lead reviewing your software design, code, and implementation.
**Your Role:** Full Stack Software Engineer conducting a knowledge transfer.
**Screen to Show:** VS Code / IDE displaying the project file structure, `backend/data_service.py`, `backend/main.py`, and `frontend/src/App.tsx`.

### Script:
> "Hi team, in this second part of the walkthrough, I will present the system architecture, data matching logic, and engineering decisions behind the implementation.
>
> ### 1. Tech Stack Overview
> - **Backend:** Python 3 with FastAPI. We selected FastAPI because it is lightweight, strongly typed, and delivers asynchronous performance for data-intensive APIs.
> - **Frontend:** React 19 with Vite, TypeScript, Tailwind CSS, and Recharts. This provides a modern, responsive, component-driven UI with fluid time-series visualization.
> - **Containerization:** A multi-stage Dockerfile enabling single-command container orchestration.
>
> ### 2. Data Engineering & Domain Matching Logic
> The assignment specifies using Elexon BMRS data exclusively:
> - `FUELHH` for actual generation where `fuelType == 'WIND'`.
> - `WINDFOR` for wind generation forecasts.
>
> If we look at `backend/data_service.py`:
> One of the most important technical considerations in UK power market modeling is avoiding **data look-ahead bias**.
> For any delivery day $D$, National Grid publishes multiple forecast runs on day $D-1$ and even within the delivery day itself. However, day-ahead trading decisions are legally locked at Day-Ahead Gate Closure (typically 11:00 or 12:00 UTC on $D-1$).
>
> In our `get_matched_points()` method:
> - For every settlement period, we filter candidate forecasts where `publishTime <= cutoff_timestamp`.
> - We sort by `publishTime` descending to pick the exact **latest available forecast** that was in the hands of the trader at decision time.
> - We support both **30-minute settlement period resolution (48 periods/day)** as well as hourly aggregation.
>
> ### 3. Error Metrics Calculation
> The module mathematically computes:
> - **MAE (Mean Absolute Error):** $\frac{1}{N} \sum |\hat{y}_i - y_i|$
> - **RMSE (Root Mean Square Error):** $\sqrt{\frac{1}{N} \sum (\hat{y}_i - y_i)^2}$
> - **Mean Bias:** $\frac{1}{N} \sum (\hat{y}_i - y_i)$, which reveals structural over- or under-forecasting.
> - **Accuracy %:** Normalized MAE subtracted from 100%.
>
> ### 4. API & Frontend Integration
> In `backend/main.py`, we expose clean REST endpoints:
> - `/api/dates`: Lists all January 2026 dates.
> - `/api/forecast-vs-actual`: Returns time-series pairs, metrics, and risk classifications.
> - `/api/monthly-metrics`: Returns full 31-day aggregate statistics.
>
> Notice also that in production, FastAPI serves the pre-built React frontend static files from `frontend/dist`, making the entire service deployable as a single unified container or separate services.
>
> ### 5. Containerization & Deployment
> In the root directory, our `Dockerfile` is built with a multi-stage pattern:
> - Stage 1 uses `node:20-alpine` to compile the TypeScript React application.
> - Stage 2 uses `python:3.11-slim` to install backend dependencies, copy the cached January 2026 Elexon data, and serve both the API and client.
> - A `docker-compose.yml` is provided for one-click deployment (`docker compose up --build`).
>
> Everything is tested, type-safe, and ready for deployment on Vercel and Render/Heroku. Thank you!"
