# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Trading 212 portfolio dashboard. Users upload their Trading 212 CSV exports; the FastAPI backend parses and normalizes them; the React frontend displays the data. The project is in early development — CSV parsing is functional but database storage and full dashboard UI are not yet built.

## Commands

### Backend
```bash
# Run the FastAPI backend (from repo root)
uvicorn backend.main:app --reload

# Run the CSV parser test script (from backend/ directory)
cd backend && python test_parser.py
```

### Frontend
```bash
# From frontend/ directory
cd frontend
npm install      # install dependencies
npm run dev      # start Vite dev server (http://localhost:5173)
npm run build    # production build
npm run lint     # ESLint
```

## Architecture

The project uses a split `backend/` + `frontend/` layout (not the `app/` structure described in `.cursor/plans/`—that plan is aspirational).

**Backend** (`backend/`)
- `main.py` — FastAPI app. Single `POST /upload` endpoint and a `GET /health` check. CORS is configured for `http://localhost:5173` only.
- `csv_parser.py` — Core parsing logic. `parse_trading212_csv(content: bytes)` is the main entry point. It classifies each row into a `kind` (`trade`, `dividend`, `cash`, `unknown`), parses all numeric fields via `parse_decimal`, normalizes datetimes to ISO 8601, and returns a `{ transactions, summary, schema, errors }` dict.
- `test_parser.py` — Ad-hoc script to test the parser against a real CSV file; run directly from `backend/`.

**Frontend** (`frontend/src/`)
- `App.tsx` — Top-level layout: title header, a `Card`, and `FileUpload`.
- `components/FileUpload.tsx` — Handles file selection and `POST` to `http://localhost:8000/api/upload`. Note: the current URL is `/api/upload` but the backend route is `/upload` — this mismatch needs fixing.
- `components/Card.tsx` — Generic styled container card.

**Planned but not yet implemented** (per `.cursor/plans/`):
- PostgreSQL database with SQLAlchemy models for trades/positions
- Alembic migrations
- Dashboard API routes (`/api/trades`, `/api/positions`, `/api/stats`, `/api/chart-data`)
- Chart visualizations (Chart.js or Plotly)

## Known Issues

- `FileUpload.tsx` posts to `http://localhost:8000/api/upload` but the backend exposes `POST /upload` (no `/api` prefix).
- `requirements.txt` only lists `fastapi==0.104.1`; `uvicorn`, `python-multipart` (required for file uploads), and future dependencies (SQLAlchemy, pandas, psycopg2, alembic) are missing.
- `app/__init__.py` exists but `app/` is otherwise empty; the actual code lives in `backend/`.
