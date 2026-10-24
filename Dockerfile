# Multi-stage build: Stage 1 compiles React, Stage 2 runs Python backend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn
COPY backend/ ./backend/
COPY data_cache/ ./data_cache/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
