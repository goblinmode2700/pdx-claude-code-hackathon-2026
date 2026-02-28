"""Claude-powered route optimizer."""

import json
import math
import anthropic
from .models import Ride, Vehicle, OptimizationResult, RouteAssignment


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in miles between two lat/lng points."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def compute_route_miles(assignment: RouteAssignment, rides: list[Ride], vehicles: list[Vehicle]) -> float:
    """Compute total miles for a single vehicle's route."""
    ride_map = {r.id: r for r in rides}
    vehicle = next((v for v in vehicles if v.id == assignment.vehicle_id), None)
    if not vehicle:
        return 0.0

    total = 0.0
    cur_lat, cur_lng = vehicle.current_lat, vehicle.current_lng

    for ride_id in assignment.ride_ids_in_order:
        ride = ride_map.get(ride_id)
        if not ride:
            continue
        # Drive to pickup
        total += haversine_miles(cur_lat, cur_lng, ride.pickup_lat, ride.pickup_lng)
        # Drive to dropoff
        total += haversine_miles(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng)
        cur_lat, cur_lng = ride.dropoff_lat, ride.dropoff_lng

    return total


def naive_assign(rides: list[Ride], vehicles: list[Vehicle]) -> tuple[list[RouteAssignment], float]:
    """Round-robin FIFO baseline (no geographic optimization). Returns assignments and total miles."""
    sorted_rides = sorted(rides, key=lambda r: r.time_window_start)
    available = [v for v in vehicles if v.status.value == "available"]
    vehicle_loads: dict[str, list[str]] = {v.id: [] for v in available}

    # Simple round-robin: deal rides to vehicles like cards
    for i, ride in enumerate(sorted_rides):
        vid = available[i % len(available)].id
        vehicle_loads[vid].append(ride.id)

    assignments = [
        RouteAssignment(
            vehicle_id=vid,
            ride_ids_in_order=ride_ids,
            reasoning="Round-robin FIFO assignment (no optimization)",
        )
        for vid, ride_ids in vehicle_loads.items()
        if ride_ids
    ]

    total_miles = sum(compute_route_miles(a, rides, vehicles) for a in assignments)
    return assignments, total_miles


def count_constraint_violations(assignments: list[RouteAssignment], rides: list[Ride], vehicles: list[Vehicle]) -> dict:
    """Count constraint violations for a set of assignments."""
    ride_map = {r.id: r for r in rides}
    vehicle_map = {v.id: v for v in vehicles}
    violations = {"capacity": 0, "luggage": 0, "priority_ordering": 0}

    for a in assignments:
        v = vehicle_map.get(a.vehicle_id)
        if not v:
            continue
        for rid in a.ride_ids_in_order:
            r = ride_map.get(rid)
            if not r:
                continue
            if r.passenger_count > v.capacity:
                violations["capacity"] += 1
            if r.luggage_count > v.luggage_capacity:
                violations["luggage"] += 1

        # Check if urgent/high rides come before low/medium
        priorities = [ride_map[rid].priority.value for rid in a.ride_ids_in_order if rid in ride_map]
        priority_rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        for i in range(len(priorities) - 1):
            if priority_rank.get(priorities[i], 3) > priority_rank.get(priorities[i + 1], 3):
                violations["priority_ordering"] += 1

    return violations


def build_prompt(rides: list[Ride], vehicles: list[Vehicle]) -> str:
    rides_desc = []
    for r in rides:
        parts = [
            f"  - {r.id}: pickup={r.pickup_label or f'{r.pickup_lat},{r.pickup_lng}'} → "
            f"dropoff={r.dropoff_label or f'{r.dropoff_lat},{r.dropoff_lng}'}",
            f"    passengers={r.passenger_count}, luggage={r.luggage_count}, "
            f"priority={r.priority.value}, service={r.service_type.value}",
            f"    window={r.time_window_start} to {r.time_window_end}",
        ]
        if r.notes:
            parts.append(f"    notes: {r.notes}")
        rides_desc.append("\n".join(parts))

    vehicles_desc = []
    for v in vehicles:
        vehicles_desc.append(
            f"  - {v.id} ({v.name}, {v.vehicle_type.value}): at ({v.current_lat}, {v.current_lng}), "
            f"pax_capacity={v.capacity}, luggage_capacity={v.luggage_capacity}, status={v.status.value}"
        )

    return f"""You are a fleet dispatch optimizer for a Portland, OR ground transportation company.

Given the following ride requests and available vehicles, create optimal route assignments.

RIDES:
{chr(10).join(rides_desc)}

VEHICLES:
{chr(10).join(vehicles_desc)}

CONSTRAINTS:
- Each vehicle cannot exceed its passenger capacity for any single ride
- Consider luggage capacity — vehicles with limited luggage space should not be assigned heavy-luggage rides
- Prioritize URGENT and HIGH priority rides — they must be assigned first
- Minimize total travel distance and respect time windows
- A vehicle can handle multiple rides if sequenced efficiently (i.e., dropoff of one ride is near pickup of next)
- Consider geographic clustering — assign nearby rides to the same vehicle
- For airport departure rides, ensure pickup time allows enough travel time to reach the airport before the flight

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

Think carefully about geographic proximity, time windows, capacity, and luggage. Every ride should be assigned if possible."""


async def optimize(rides: list[Ride], vehicles: list[Vehicle]) -> dict:
    """Call Claude to optimize routes. Returns full comparison data."""
    prompt = build_prompt(rides, vehicles)

    # Compute naive baseline
    naive_assignments, naive_miles = naive_assign(rides, vehicles)
    naive_violations = count_constraint_violations(naive_assignments, rides, vehicles)

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
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    parsed = json.loads(cleaned)
    result = OptimizationResult(**parsed)

    # Compute optimized miles and violations
    optimized_miles = sum(compute_route_miles(a, rides, vehicles) for a in result.assignments)
    optimized_violations = count_constraint_violations(result.assignments, rides, vehicles)

    return {
        "result": result,
        "prompt": prompt,
        "naive_miles": naive_miles,
        "optimized_miles": optimized_miles,
        "naive_violations": sum(naive_violations.values()),
        "optimized_violations": sum(optimized_violations.values()),
    }
