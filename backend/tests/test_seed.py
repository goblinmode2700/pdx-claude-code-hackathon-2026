from app.seed import SEED_RIDES, SEED_VEHICLES


def test_seed_rides_valid_portland_coords():
    for r in SEED_RIDES:
        assert 45.3 <= r.pickup_lat <= 45.7, f"{r.id} pickup_lat out of range"
        assert -122.9 <= r.pickup_lng <= -122.4, f"{r.id} pickup_lng out of range"
        assert 45.3 <= r.dropoff_lat <= 45.7, f"{r.id} dropoff_lat out of range"
        assert -122.9 <= r.dropoff_lng <= -122.4, f"{r.id} dropoff_lng out of range"


def test_seed_vehicles_valid():
    for v in SEED_VEHICLES:
        assert v.capacity > 0
        assert v.status is not None


def test_no_duplicate_ids():
    ride_ids = [r.id for r in SEED_RIDES]
    assert len(ride_ids) == len(set(ride_ids))

    vehicle_ids = [v.id for v in SEED_VEHICLES]
    assert len(vehicle_ids) == len(set(vehicle_ids))


def test_seed_data_counts():
    assert len(SEED_RIDES) >= 8
    assert len(SEED_VEHICLES) >= 3
