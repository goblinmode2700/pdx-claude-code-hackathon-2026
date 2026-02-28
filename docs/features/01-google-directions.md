# Feature 01: Google Maps Directions API

**Status: IMPLEMENTED** (commit a5c6f0d)

## What it does
Routes on the map follow real Portland roads instead of straight lines. Claude receives real drive times in its prompt for smarter decisions. Naive vs optimized comparison uses real road distances.

## Data flow
1. After Claude returns assignments, backend calls Google Directions API per vehicle route
2. Google returns encoded polyline → decoded into `[[lat, lng], ...]` (300+ pts per route)
3. Distance Matrix API called before Claude prompt to provide real drive times between vehicles and pickups
4. Frontend renders polyline coords via Leaflet Polyline (no Google Maps JS needed)

## Files modified
- `backend/app/directions.py` — new: Directions API, Distance Matrix API, polyline decoder, haversine fallback
- `backend/app/geo.py` — new: extracted haversine_miles to break circular import
- `backend/app/optimizer.py` — enriches assignments with polylines post-optimization, feeds drive times to prompt
- `backend/app/models.py` — RouteAssignment gained `polyline` and `route_miles` fields
- `frontend/src/components/RouteMap.tsx` — renders real polyline when available, falls back to straight lines
- `frontend/src/types.ts` — RouteAssignment type updated

## Edge cases / fallbacks
- No GOOGLE_MAPS_API_KEY → haversine distances + straight-line polylines (fully functional)
- Google API error/timeout (10s) → same fallback per-request
- Waypoints > 25 → Google rejects; not an issue with our scenario sizes

## Acceptance criteria
- [x] Routes visually follow roads on map
- [x] /optimize response includes polyline arrays with 100+ points
- [x] Mile comparison uses road distances, not haversine
- [x] Everything works with GOOGLE_MAPS_API_KEY unset
