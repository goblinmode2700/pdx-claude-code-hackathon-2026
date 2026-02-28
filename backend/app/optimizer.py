"""Claude-powered route optimizer."""

import json
import anthropic
from .models import Ride, Vehicle, OptimizationResult


def build_prompt(rides: list[Ride], vehicles: list[Vehicle]) -> str:
    rides_desc = []
    for r in rides:
        rides_desc.append(
            f"  - {r.id}: pickup={r.pickup_label or f'{r.pickup_lat},{r.pickup_lng}'} → "
            f"dropoff={r.dropoff_label or f'{r.dropoff_lat},{r.dropoff_lng}'}, "
            f"passengers={r.passenger_count}, priority={r.priority.value}, "
            f"window={r.time_window_start} to {r.time_window_end}"
        )

    vehicles_desc = []
    for v in vehicles:
        vehicles_desc.append(
            f"  - {v.id} ({v.name}): at ({v.current_lat}, {v.current_lng}), "
            f"capacity={v.capacity}, status={v.status.value}"
        )

    return f"""You are a fleet dispatch optimizer for a Portland, OR ground transportation company.

Given the following ride requests and available vehicles, create optimal route assignments.

RIDES:
{chr(10).join(rides_desc)}

VEHICLES:
{chr(10).join(vehicles_desc)}

CONSTRAINTS:
- Each vehicle cannot exceed its passenger capacity for any single ride
- Prioritize URGENT and HIGH priority rides — they must be assigned first
- Minimize total travel distance and respect time windows
- A vehicle can handle multiple rides if sequenced efficiently (i.e., dropoff of one ride is near pickup of next)
- Consider geographic clustering — assign nearby rides to the same vehicle

Respond with ONLY valid JSON in this exact format:
{{
  "assignments": [
    {{
      "vehicle_id": "V001",
      "ride_ids_in_order": ["R001", "R005"],
      "reasoning": "Brief explanation of why these rides are grouped and ordered this way"
    }}
  ],
  "overall_strategy": "2-3 sentence summary of your optimization approach",
  "unassigned_rides": ["R999"]
}}

Think carefully about geographic proximity, time windows, and capacity. Every ride should be assigned if possible."""


async def optimize(rides: list[Ride], vehicles: list[Vehicle]) -> tuple[OptimizationResult, str]:
    """Call Claude to optimize routes. Returns (result, prompt_used)."""
    prompt = build_prompt(rides, vehicles)

    client = anthropic.AsyncAnthropic()
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text

    # Strip markdown code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]  # remove first line
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    parsed = json.loads(cleaned)
    result = OptimizationResult(**parsed)

    return result, prompt
