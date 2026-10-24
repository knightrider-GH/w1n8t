# Multi-stage Dockerfile for UK Wind Power Day-Ahead Forecasting Application

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend + Static Files
FROM python:3.11-slim
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy cached Elexon datasets and backend source code
COPY data_cache ./data_cache
COPY backend ./backend

# Copy built frontend static bundle
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 8000

# Command to serve application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
