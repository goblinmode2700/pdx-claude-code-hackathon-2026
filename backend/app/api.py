"""FastAPI application."""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import OptimizeRequest, OptimizeResponse, Ride, Vehicle
from .seed import SEED_RIDES, SEED_VEHICLES
from .optimizer import optimize

app = FastAPI(title="Fleet Route Optimizer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/seed")
async def get_seed() -> dict:
    """Return sample scenario data."""
    return {
        "rides": [r.model_dump() for r in SEED_RIDES],
        "vehicles": [v.model_dump() for v in SEED_VEHICLES],
    }


@app.post("/optimize")
async def optimize_routes(request: OptimizeRequest) -> OptimizeResponse:
    """Accept rides + vehicles, return assignments + reasoning."""
    result, prompt = await optimize(request.rides, request.vehicles)
    return OptimizeResponse(result=result, prompt_used=prompt)


@app.get("/health")
async def health():
    return {"status": "ok"}
