import pytest
from pydantic import ValidationError
from app.models import Ride, Vehicle, OptimizationResult, Priority, VehicleStatus


def test_ride_valid():
    r = Ride(
        id="R001",
        pickup_lat=45.52,
        pickup_lng=-122.68,
        dropoff_lat=45.49,
        dropoff_lng=-122.67,
        time_window_start="2026-02-28T10:00:00",
        time_window_end="2026-02-28T10:30:00",
        passenger_count=2,
        priority=Priority.HIGH,
    )
    assert r.id == "R001"
    assert r.passenger_count == 2


def test_ride_rejects_bad_priority():
    with pytest.raises(ValidationError):
        Ride(
            id="R001",
            pickup_lat=45.52,
            pickup_lng=-122.68,
            dropoff_lat=45.49,
            dropoff_lng=-122.67,
            time_window_start="2026-02-28T10:00:00",
            time_window_end="2026-02-28T10:30:00",
            passenger_count=2,
            priority="INVALID",
        )


def test_vehicle_valid():
    v = Vehicle(
        id="V001",
        name="Sedan",
        current_lat=45.52,
        current_lng=-122.68,
        capacity=4,
        status=VehicleStatus.AVAILABLE,
    )
    assert v.capacity == 4


def test_optimization_result_parses():
    data = {
        "assignments": [
            {
                "vehicle_id": "V001",
                "ride_ids_in_order": ["R001", "R002"],
                "reasoning": "Nearby pickups",
            }
        ],
        "overall_strategy": "Cluster by geography",
        "unassigned_rides": [],
    }
    result = OptimizationResult(**data)
    assert len(result.assignments) == 1
    assert result.assignments[0].ride_ids_in_order == ["R001", "R002"]
