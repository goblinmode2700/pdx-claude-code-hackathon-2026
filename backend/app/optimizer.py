"""Claude-powered route optimizer."""

import json
import asyncio
import anthropic
from .models import Ride, Vehicle, OptimizationResult, RouteAssignment
from .geo import haversine_miles
from .directions import get_route_polyline, get_distance_matrix


def compute_route_miles(assignment: RouteAssignment, rides: list[Ride], vehicles: list[Vehicle]) -> float:
    """Compute total haversine miles for a single vehicle's route."""
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
        total += haversine_miles(cur_lat, cur_lng, ride.pickup_lat, ride.pickup_lng)
        total += haversine_miles(ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng)
        cur_lat, cur_lng = ride.dropoff_lat, ride.dropoff_lng

    return total


def _build_waypoints(assignment: RouteAssignment, rides: list[Ride], vehicles: list[Vehicle]) -> list[tuple[float, float]]:
    """Build ordered waypoints for a vehicle's route: vehicle pos → pickup1 → dropoff1 → pickup2 → dropoff2 ..."""
    ride_map = {r.id: r for r in rides}
    vehicle = next((v for v in vehicles if v.id == assignment.vehicle_id), None)
    if not vehicle:
        return []

    waypoints: list[tuple[float, float]] = [(vehicle.current_lat, vehicle.current_lng)]
    for ride_id in assignment.ride_ids_in_order:
        ride = ride_map.get(ride_id)
        if ride:
            waypoints.append((ride.pickup_lat, ride.pickup_lng))
            waypoints.append((ride.dropoff_lat, ride.dropoff_lng))
    return waypoints


async def enrich_with_polylines(
    assignments: list[RouteAssignment], rides: list[Ride], vehicles: list[Vehicle]
) -> tuple[list[RouteAssignment], float]:
    """Add real road polylines + distances to assignments. Returns (enriched_assignments, total_road_miles)."""
    async def enrich_one(a: RouteAssignment) -> RouteAssignment:
        waypoints = _build_waypoints(a, rides, vehicles)
        polyline, miles = await get_route_polyline(waypoints)
        return RouteAssignment(
            vehicle_id=a.vehicle_id,
            ride_ids_in_order=a.ride_ids_in_order,
            reasoning=a.reasoning,
            polyline=polyline,
            route_miles=round(miles, 1),
        )

    enriched = await asyncio.gather(*[enrich_one(a) for a in assignments])
    total_road_miles = sum(a.route_miles for a in enriched)
    return list(enriched), total_road_miles


def naive_assign(rides: list[Ride], vehicles: list[Vehicle]) -> tuple[list[RouteAssignment], float]:
    """Round-robin FIFO baseline (no geographic optimization). Returns assignments and total miles."""
    sorted_rides = sorted(rides, key=lambda r: r.time_window_start)
    available = [v for v in vehicles if v.status.value == "available"]
    vehicle_loads: dict[str, list[str]] = {v.id: [] for v in available}

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

        priorities = [ride_map[rid].priority.value for rid in a.ride_ids_in_order if rid in ride_map]
        priority_rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        for i in range(len(priorities) - 1):
            if priority_rank.get(priorities[i], 3) > priority_rank.get(priorities[i + 1], 3):
                violations["priority_ordering"] += 1

    return violations


async def _build_drive_time_context(rides: list[Ride], vehicles: list[Vehicle]) -> str | None:
    """Get real drive times between key points to enrich the prompt."""
    # Gather all unique points: vehicle positions + pickup/dropoff locations
    points: list[tuple[float, float]] = []
    point_labels: list[str] = []

    for v in vehicles:
        points.append((v.current_lat, v.current_lng))
        point_labels.append(f"{v.id} (current)")

    for r in rides:
        points.append((r.pickup_lat, r.pickup_lng))
        point_labels.append(f"{r.id} pickup")

    # Only use vehicle positions as origins, ride pickups as destinations
    # to keep the matrix manageable
    vehicle_points = [(v.current_lat, v.current_lng) for v in vehicles]
    pickup_points = [(r.pickup_lat, r.pickup_lng) for r in rides]

    matrix = await get_distance_matrix(vehicle_points, pickup_points)
    if not matrix:
        return None

    lines = ["REAL DRIVE TIMES (vehicle → ride pickup):"]
    for i, v in enumerate(vehicles):
        for j, r in enumerate(rides):
            d = matrix[i][j]
            lines.append(
                f"  {v.id} → {r.id} pickup: {d['distance_miles']:.1f} mi, {d['duration_minutes']:.0f} min"
            )

    return "\n".join(lines)


def build_prompt(rides: list[Ride], vehicles: list[Vehicle], drive_times: str | None = None) -> str:
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

    drive_times_section = ""
    if drive_times:
        drive_times_section = f"\n{drive_times}\n"

    return f"""You are a fleet dispatch optimizer for a Portland, OR ground transportation company.

Given the following ride requests and available vehicles, create optimal route assignments.

RIDES:
{chr(10).join(rides_desc)}

VEHICLES:
{chr(10).join(vehicles_desc)}
{drive_times_section}
HARD CONSTRAINTS (must not violate):
- Each vehicle cannot exceed its passenger capacity for any single ride
- Vehicle luggage capacity must fit the ride's luggage count
- Vehicle must be available (status=available)

OPTIMIZATION RULES (in priority order):
1. RESERVATION LOGIC (critical — read carefully):
   Before assigning ANY rides, scan the full batch and identify rides that REQUIRE a specific vehicle's capability (e.g., high passenger count that only one vehicle can handle, heavy luggage that only one vehicle fits). RESERVE those vehicles for those rides, even if the vehicle is geographically closer to a simpler ride. Do NOT waste a specialized vehicle on a generic ride when a specialized ride needs it later. In your reasoning, explicitly call out reservation decisions: "Reserved [vehicle] for [ride] because it is the only vehicle that can handle [constraint]."

2. PRIORITY: Assign URGENT and HIGH priority rides first — they get first pick of vehicles.

3. GEOGRAPHIC CLUSTERING: Group nearby rides on the same vehicle. Sequence rides so dropoff of one is near pickup of the next to minimize deadhead miles.

4. TIME WINDOWS: Respect pickup windows. For airport departures, ensure enough travel time to reach the airport before the flight.

5. LOAD BALANCING: Spread rides across vehicles. Avoid overloading one vehicle while others sit idle.

6. Use the real drive times provided (if available) instead of straight-line distance estimates.

Respond with ONLY valid JSON in this exact format:
{{
  "assignments": [
    {{
      "vehicle_id": "V001",
      "ride_ids_in_order": ["R001", "R005"],
      "reasoning": "Explain grouping AND any reservation decisions. E.g.: Reserved Van for R011 (7 pax) since it's the only vehicle with capacity >= 7. Assigned sedan to nearby R001+R005 cluster instead."
    }}
  ],
  "overall_strategy": "2-3 sentence summary including which vehicles were reserved and why",
  "unassigned_rides": ["R999"]
}}

Think step by step: first identify which rides REQUIRE specific vehicles, reserve those, then optimize the remaining assignments by proximity and time. Every ride should be assigned if possible."""


async def optimize_stream(rides: list[Ride], vehicles: list[Vehicle]):
    """Streaming version of optimize. Yields SSE events as Claude generates tokens."""
    import asyncio as _asyncio

    # Start drive times + naive baseline in parallel
    drive_times_task = _asyncio.create_task(_build_drive_time_context(rides, vehicles))

    naive_assignments, _ = naive_assign(rides, vehicles)
    naive_violations = count_constraint_violations(naive_assignments, rides, vehicles)

    drive_times = await drive_times_task
    prompt = build_prompt(rides, vehicles, drive_times)

    # Stream Claude's response
    client = anthropic.AsyncAnthropic()
    full_text = ""

    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text
            yield f"data: {json.dumps({'type': 'token', 'text': text})}\n\n"

    # Parse the completed response
    try:
        cleaned = full_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

        parsed = json.loads(cleaned)
        result = OptimizationResult(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to parse Claude response: {str(e)}'})}\n\n"
        return

    # Signal that we're now computing road routes
    yield f"data: {json.dumps({'type': 'status', 'message': 'Computing road routes...'})}\n\n"

    # Enrich with polylines (both optimized and naive)
    enriched_assignments, optimized_road_miles = await enrich_with_polylines(
        result.assignments, rides, vehicles
    )
    result.assignments = enriched_assignments

    naive_enriched, naive_road_miles = await enrich_with_polylines(naive_assignments, rides, vehicles)
    optimized_violations = count_constraint_violations(result.assignments, rides, vehicles)

    final_data = {
        "result": result.model_dump(),
        "prompt_used": prompt,
        "naive_miles": round(naive_road_miles, 1),
        "optimized_miles": round(optimized_road_miles, 1),
        "naive_violations": sum(naive_violations.values()),
        "optimized_violations": sum(optimized_violations.values()),
        "naive_assignments": [a.model_dump() for a in naive_enriched],
    }

    yield f"data: {json.dumps({'type': 'result', 'data': final_data})}\n\n"


async def optimize(rides: list[Ride], vehicles: list[Vehicle]) -> dict:
    """Call Claude to optimize routes. Returns full comparison data."""
    # Get real drive times for the prompt (async, non-blocking)
    drive_times = await _build_drive_time_context(rides, vehicles)

    prompt = build_prompt(rides, vehicles, drive_times)

    # Compute naive baseline (haversine)
    naive_assignments, naive_miles_haversine = naive_assign(rides, vehicles)
    naive_violations = count_constraint_violations(naive_assignments, rides, vehicles)

    # Enrich naive with real road distances
    naive_enriched, naive_road_miles = await enrich_with_polylines(naive_assignments, rides, vehicles)

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

    # Enrich with real road polylines + distances
    enriched_assignments, optimized_road_miles = await enrich_with_polylines(
        result.assignments, rides, vehicles
    )
    result.assignments = enriched_assignments

    optimized_violations = count_constraint_violations(result.assignments, rides, vehicles)

    return {
        "result": result,
        "prompt": prompt,
        "naive_miles": round(naive_road_miles, 1),
        "optimized_miles": round(optimized_road_miles, 1),
        "naive_violations": sum(naive_violations.values()),
        "optimized_violations": sum(optimized_violations.values()),
        "naive_assignments": naive_enriched,
    }
