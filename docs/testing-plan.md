# Testing Plan

## Scope
Lightweight test coverage for a hackathon POC — catch breaking changes, not 100% coverage.

## Backend (pytest)

### Models (`test_models.py`)
- Ride and Vehicle Pydantic models validate correctly with valid data
- Reject invalid data (negative passenger_count, bad priority enum, missing required fields)
- OptimizationResult parses Claude's expected JSON shape

### Seed Data (`test_seed.py`)
- All seed rides have valid Portland-area coordinates (lat 45.3–45.7, lng -122.9–-122.4)
- All seed vehicles have capacity > 0 and valid status
- No duplicate ride or vehicle IDs

### Optimizer (`test_optimizer.py`)
- `build_prompt()` includes all ride IDs and vehicle IDs in output
- `build_prompt()` includes constraints section
- Mock Claude response parses into valid OptimizationResult
- Handles malformed Claude response gracefully (wrapped in code fences, extra whitespace)

### API (`test_api.py`)
- `GET /seed` returns 200 with rides and vehicles arrays
- `POST /optimize` with valid payload returns 200 (mock Claude client)
- `POST /optimize` with empty rides list returns reasonable response
- `GET /health` returns 200

## Frontend (vitest)
- Skipping for hackathon — manual browser testing sufficient for 3h build

## Running Tests
```bash
cd backend
uv run pytest -v
```

## When to Run
- Before each git commit
- After any change to models.py, optimizer.py, or api.py
- Before demo
