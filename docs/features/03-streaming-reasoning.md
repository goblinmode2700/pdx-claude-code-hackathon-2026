# Feature 03: Streaming Claude Reasoning

**Status: SPEC**

## What it does
Instead of waiting 10-15 seconds for Claude's full response then rendering it all at once, stream the reasoning text into the right panel in real-time. The user sees Claude "thinking" live — tokens appearing as they arrive. Big UX improvement for demo.

## Data flow
1. Backend: new `POST /optimize-stream` endpoint using FastAPI StreamingResponse
2. Backend streams SSE events: `{"type": "token", "text": "..."}` as Claude generates, then `{"type": "result", "data": {...}}` with the full parsed result at the end
3. Frontend: use EventSource or fetch with ReadableStream to consume SSE
4. ReasoningPanel renders streaming text in a "thinking" block, then swaps to structured result when complete
5. Map + comparison panel update only when the final `result` event arrives

## Files modified
- `backend/app/optimizer.py` — add `optimize_stream()` async generator that yields SSE events
- `backend/app/api.py` — new `POST /optimize-stream` endpoint with StreamingResponse
- `frontend/src/App.tsx` — new `handleOptimizeStream()` that reads SSE, manages streaming state
- `frontend/src/components/ReasoningPanel.tsx` — render streaming text during loading, transition to structured result

## Edge cases / fallbacks
- If streaming fails mid-way, fall back to regular `/optimize` endpoint
- Claude's raw stream includes the JSON structure — need to show the reasoning parts readably while still parsing the final JSON
- Keep existing `/optimize` endpoint working (non-streaming fallback)

## Acceptance criteria
- [ ] Clicking Optimize shows text appearing in real-time in the reasoning panel
- [ ] Final structured result (assignments, strategy, comparison) renders after stream completes
- [ ] Map updates with routes only after stream is fully done
- [ ] Regular /optimize endpoint still works as fallback
