# QA Checklist — Fleet Route Optimizer Demo

## App Launch
- [ ] Backend starts on :8000, GET /health returns 200
- [ ] Frontend starts on :5173, loads without console errors
- [ ] Map renders with CARTO tiles centered on Portland

## Scenario Loading
- [ ] Default scenario loads rides + vehicles on map
- [ ] Switching to "Airport Rush" scenario updates map + sidebar
- [ ] Switching back to "Downtown Mix" restores original data
- [ ] Pickup markers (green circles) and dropoff markers (red squares) render correctly
- [ ] Vehicle markers render at correct positions

## Optimization Flow
- [ ] Click "Optimize" → streaming panel appears with live tokens
- [ ] Streaming completes → "Computing road routes..." loading state shows
- [ ] Polylines render as real road-following routes (not straight lines)
- [ ] Each vehicle's route is a different color
- [ ] Reasoning panel shows Claude's strategy + per-vehicle reasoning
- [ ] Comparison stats show naive vs optimized miles + constraint violations

## Before/After Toggle
- [ ] "Naive" view shows dashed gray route polylines
- [ ] "Both" view shows naive AND optimized overlaid
- [ ] "AI Optimized" view shows only optimized routes
- [ ] Switching between views doesn't break map state

## Reservation Logic
- [ ] Downtown Mix scenario has R011 (7 pax) requiring Van Charlie (cap 8)
- [ ] Claude's reasoning explicitly mentions holding/reserving Van for R011
- [ ] Van Charlie is NOT assigned to a generic 1-2 pax ride instead of R011

## Edge Cases
- [ ] Optimize with no API key → haversine fallback works, straight-line polylines
- [ ] Optimize when Claude returns malformed JSON → clean error + retry button
- [ ] Double-clicking Optimize doesn't fire duplicate requests
- [ ] Switching scenarios mid-optimization doesn't crash

## Sidebar Data
- [ ] RidePanel shows all rides with priority badges + time windows
- [ ] VehiclePanel shows assigned rides after optimization
- [ ] Per-vehicle route miles displayed
- [ ] Prompt viewer expands/collapses

## Visual Polish
- [ ] No overlapping UI elements
- [ ] Text is readable (no truncation, no overflow)
- [ ] Savings % is prominently displayed in comparison panel
- [ ] Colors are consistent (vehicle color on map = vehicle color in sidebar)
- [ ] No console errors or warnings during full flow
