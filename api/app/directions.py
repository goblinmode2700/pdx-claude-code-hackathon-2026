"""Google Maps Directions + Distance Matrix integration with haversine fallback."""

import os
import httpx
from .geo import haversine_miles


def _get_api_key() -> str | None:
    return os.environ.get("GOOGLE_MAPS_API_KEY")


def _decode_polyline(encoded: str) -> list[list[float]]:
    """Decode a Google Maps encoded polyline string into [[lat, lng], ...]."""
    points = []
    index = 0
    lat = 0
    lng = 0
    while index < len(encoded):
        # Decode latitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lat += (~(result >> 1) if (result & 1) else (result >> 1))

        # Decode longitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lng += (~(result >> 1) if (result & 1) else (result >> 1))

        points.append([lat / 1e5, lng / 1e5])
    return points


async def get_route_polyline(
    waypoints: list[tuple[float, float]],
) -> tuple[list[list[float]], float]:
    """Get route polyline and distance (miles) for a sequence of waypoints.

    Returns (polyline_coords, total_miles).
    Falls back to straight lines + haversine if API unavailable.
    """
    if len(waypoints) < 2:
        return [[w[0], w[1]] for w in waypoints], 0.0

    api_key = _get_api_key()
    if not api_key:
        return _straight_line_fallback(waypoints)

    origin = f"{waypoints[0][0]},{waypoints[0][1]}"
    destination = f"{waypoints[-1][0]},{waypoints[-1][1]}"

    params: dict[str, str] = {
        "origin": origin,
        "destination": destination,
        "key": api_key,
    }

    # Add intermediate waypoints if any
    if len(waypoints) > 2:
        intermediate = "|".join(f"{w[0]},{w[1]}" for w in waypoints[1:-1])
        params["waypoints"] = intermediate

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params=params,
            )
            data = resp.json()

        if data.get("status") != "OK" or not data.get("routes"):
            return _straight_line_fallback(waypoints)

        route = data["routes"][0]
        # Decode overview polyline
        polyline = _decode_polyline(route["overview_polyline"]["points"])

        # Sum leg distances
        total_meters = sum(leg["distance"]["value"] for leg in route["legs"])
        total_miles = total_meters / 1609.344

        return polyline, total_miles

    except Exception:
        return _straight_line_fallback(waypoints)


async def get_distance_matrix(
    origins: list[tuple[float, float]],
    destinations: list[tuple[float, float]],
) -> list[list[dict]] | None:
    """Get drive time + distance matrix. Returns None on failure (use haversine fallback).

    Returns matrix[i][j] = {"distance_miles": float, "duration_minutes": float}
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    origins_str = "|".join(f"{o[0]},{o[1]}" for o in origins)
    destinations_str = "|".join(f"{d[0]},{d[1]}" for d in destinations)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    "origins": origins_str,
                    "destinations": destinations_str,
                    "key": api_key,
                },
            )
            data = resp.json()

        if data.get("status") != "OK":
            return None

        matrix = []
        for row in data["rows"]:
            row_data = []
            for element in row["elements"]:
                if element.get("status") != "OK":
                    row_data.append({"distance_miles": 0, "duration_minutes": 0})
                else:
                    row_data.append({
                        "distance_miles": element["distance"]["value"] / 1609.344,
                        "duration_minutes": element["duration"]["value"] / 60,
                    })
            matrix.append(row_data)
        return matrix

    except Exception:
        return None


def _straight_line_fallback(
    waypoints: list[tuple[float, float]],
) -> tuple[list[list[float]], float]:
    """Fallback: straight lines between waypoints with haversine distance."""
    coords = [[w[0], w[1]] for w in waypoints]
    total = 0.0
    for i in range(len(waypoints) - 1):
        total += haversine_miles(
            waypoints[i][0], waypoints[i][1],
            waypoints[i + 1][0], waypoints[i + 1][1],
        )
    return coords, total
