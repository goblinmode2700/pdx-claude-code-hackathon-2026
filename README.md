# Fleet Route Optimizer

AI-powered dispatch optimizer built at the PDX Claude Code Hackathon 2026. Given a queue of ride requests with constraints (time windows, passenger counts, luggage, priority levels) and a fleet of vehicles, Claude reasons through optimal route assignments in real-time — explaining every decision it makes.

## How to run

```bash
# Backend
cd backend
cp .env.example .env  # add your ANTHROPIC_API_KEY (required) + GOOGLE_MAPS_API_KEY (optional)
uv sync && uv run uvicorn app.api:app --reload --port 8000

# Frontend
cd frontend
npm install && npm run dev
```

Open http://localhost:5173, pick a scenario, hit **Optimize Routes**.

## What the demo shows

Two scenarios (Downtown Mix, Airport Rush) compare a naive round-robin dispatcher against Claude's AI optimization. The right panel shows miles saved, constraint violations avoided, and Claude's reasoning for every vehicle assignment. Routes render as real road-following polylines via Google Maps Directions API, with haversine fallback when no API key is set.
