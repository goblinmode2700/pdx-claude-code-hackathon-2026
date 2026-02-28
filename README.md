# Fleet Route Optimizer

AI-powered dispatch optimizer built at the **PDX Claude Code Hackathon 2026**. Given a queue of ride requests with constraints (time windows, passenger counts, luggage, priority levels) and a fleet of vehicles, Claude reasons through optimal route assignments in real-time — explaining every decision it makes.

## The Optimizer Story

The optimization approach is inspired by a production **Mixed-Integer Programming (MIP) optimizer** built for BetterHelp's therapist-client matching system. The key insight: **greedy assignment depletes scarce specialized resources.** At BetterHelp, a greedy system would assign a high-quality therapist of color in a small state market to clients who didn't specifically request that attribute — leaving no supply for clients who *did* need it.

We translate this to fleet dispatch as **reservation logic**: before assigning any rides, scan the full batch and identify rides that *require* a specific vehicle's capability (e.g., a party of 7 that only the 8-passenger van can handle). Reserve that vehicle — even if it's geographically closest to a simpler ride. Claude narrates these trade-offs in its reasoning.

See [`docs/optimizer_interview.md`](docs/optimizer_interview.md) for the full design interview notes.

## How to Run

```bash
# Backend
cd backend
cp .env.example .env  # add ANTHROPIC_API_KEY (required) + GOOGLE_MAPS_API_KEY (optional)
uv sync && uv run uvicorn app.api:app --reload --port 8000

# Frontend
cd frontend
npm install && npm run dev
```

Open http://localhost:5173, pick a scenario, hit **Optimize Routes**.

## Key Features

- **Streaming reasoning** — watch Claude think in real-time as tokens arrive via SSE
- **Reservation-aware optimization** — Claude holds specialized vehicles for rides that need them
- **Before/After toggle** — compare naive round-robin vs AI-optimized routes on the map
- **Real road polylines** — Google Maps Directions API for road-following routes (haversine fallback)
- **Distance matrix** — real drive times fed into Claude's prompt for better decisions
- **Constraint violation counting** — capacity, luggage, and priority ordering checks
- **Prompt transparency** — expand "View Prompt" to see exactly what Claude receives

## Architecture

```
Frontend (React + TypeScript + Leaflet)
  |  SSE stream
FastAPI Backend
  |-- Claude Sonnet API (streaming) -> route assignments + reasoning
  |-- Google Directions API -> road polylines
  |-- Google Distance Matrix API -> drive times for prompt enrichment
  +-- Naive baseline -> round-robin comparison
```

## Scenarios

| Scenario | Rides | Vehicles | Key Test |
|----------|-------|----------|----------|
| Downtown Mix | 11 | 3 (sedan, SUV, van) | R011: 7 pax forces van reservation |
| Airport Rush | 8 | 3 (sedan, SUV, sprinter) | A008: 6 pax corporate group |

## Tech Stack

- **Backend:** Python 3.13, FastAPI, Pydantic, Anthropic SDK, `uv`
- **Frontend:** Vite, React, TypeScript, Tailwind CSS v4, Leaflet
- **APIs:** Claude Sonnet 4, Google Maps Directions + Distance Matrix
