"""FastAPI application."""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models import OptimizeRequest, OptimizeResponse, OptimizationResult
from .seed import SCENARIOS
from .optimizer import optimize, optimize_stream

app = FastAPI(title="Fleet Route Optimizer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/scenarios")
async def list_scenarios() -> dict:
    """List available scenarios."""
    return {
        "scenarios": {
            key: {"label": s["label"], "description": s["description"]}
            for key, s in SCENARIOS.items()
        }
    }


@app.get("/seed")
async def get_seed(scenario: str = "downtown_mix") -> dict:
    """Return scenario data. Defaults to downtown_mix."""
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"Unknown scenario: {scenario}. Options: {list(SCENARIOS.keys())}")
    s = SCENARIOS[scenario]
    return {
        "rides": [r.model_dump() for r in s["rides"]],
        "vehicles": [v.model_dump() for v in s["vehicles"]],
    }


@app.post("/optimize")
async def optimize_routes(request: OptimizeRequest) -> OptimizeResponse:
    """Accept rides + vehicles, return assignments + reasoning + mile comparison."""
    data = await optimize(request.rides, request.vehicles)
    return OptimizeResponse(
        result=data["result"],
        prompt_used=data["prompt"],
        naive_miles=round(data["naive_miles"], 1),
        optimized_miles=round(data["optimized_miles"], 1),
        naive_violations=data["naive_violations"],
        optimized_violations=data["optimized_violations"],
        naive_assignments=data["naive_assignments"],
    )


@app.post("/optimize-stream")
async def optimize_routes_stream(request: OptimizeRequest):
    """Stream Claude's reasoning tokens, then send the final result."""
    return StreamingResponse(
        optimize_stream(request.rides, request.vehicles),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
