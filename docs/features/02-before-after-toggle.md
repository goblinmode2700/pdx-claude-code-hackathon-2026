# Feature 02: Before/After Route Toggle

**Status: SPEC**

## What it does
Map shows both naive (round-robin) and AI-optimized routes. A toggle in the map area lets the user switch between "Naive" and "Optimized" views, or show both overlaid. This makes the value of AI optimization immediately visible to judges — they can see the messy criss-crossing naive routes vs the clean clustered AI routes.

## Data flow
1. Backend: `/optimize` response already returns `naive_miles` and `optimized_miles`. Extend to also return naive route polylines.
2. Backend: after computing naive assignments, enrich them with Google Directions polylines (same as optimized).
3. Response adds `naive_assignments: RouteAssignment[]` alongside existing `result.assignments`.
4. Frontend: RouteMap receives both assignment sets. Toggle controls which layer renders.
5. Toggle states: "Optimized" (default after optimize), "Naive", "Both" (naive dashed + optimized solid).

## Files modified
- `backend/app/optimizer.py` — return naive_enriched assignments in optimize() response
- `backend/app/models.py` — OptimizeResponse gains `naive_assignments` field
- `backend/app/api.py` — pass naive_assignments through
- `frontend/src/types.ts` — OptimizeResponse type updated
- `frontend/src/components/RouteMap.tsx` — accept naive assignments, render toggle, dual layer
- `frontend/src/App.tsx` — pass naive assignments to RouteMap

## Edge cases / fallbacks
- Toggle only appears after optimize has been run (hidden before)
- "Both" view: naive routes render as dashed gray at 50% opacity underneath solid optimized routes
- Switching scenarios resets toggle to hidden

## Acceptance criteria
- [ ] Toggle visible on map after optimization
- [ ] "Naive" shows round-robin routes with gray dashed lines
- [ ] "Optimized" shows AI routes with solid colored lines (current behavior)
- [ ] "Both" overlays both — visual contrast is obvious
- [ ] Naive routes use real road polylines (not straight lines)
