from app.optimizer import build_prompt, naive_assign
from app.geo import haversine_miles
from app.seed import SEED_RIDES, SEED_VEHICLES, AIRPORT_RUSH_RIDES, AIRPORT_RUSH_VEHICLES, SCENARIOS


def test_build_prompt_includes_all_ride_ids():
    prompt = build_prompt(SEED_RIDES, SEED_VEHICLES)
    for r in SEED_RIDES:
        assert r.id in prompt, f"Missing ride {r.id} in prompt"


def test_build_prompt_includes_all_vehicle_ids():
    prompt = build_prompt(SEED_RIDES, SEED_VEHICLES)
    for v in SEED_VEHICLES:
        assert v.id in prompt, f"Missing vehicle {v.id} in prompt"


def test_build_prompt_includes_constraints():
    prompt = build_prompt(SEED_RIDES, SEED_VEHICLES)
    assert "CONSTRAINTS" in prompt
    assert "capacity" in prompt.lower()
    assert "priority" in prompt.lower()
    assert "luggage" in prompt.lower()


def test_build_prompt_includes_enriched_fields():
    prompt = build_prompt(SEED_RIDES, SEED_VEHICLES)
    assert "service=" in prompt
    assert "luggage=" in prompt
    assert "luggage_capacity=" in prompt


def test_naive_assign_assigns_all_rides():
    assignments, total_miles = naive_assign(SEED_RIDES, SEED_VEHICLES)
    assigned_ids = [rid for a in assignments for rid in a.ride_ids_in_order]
    for r in SEED_RIDES:
        assert r.id in assigned_ids, f"Ride {r.id} not assigned in naive"
    assert total_miles > 0


def test_naive_assign_airport_rush():
    assignments, total_miles = naive_assign(AIRPORT_RUSH_RIDES, AIRPORT_RUSH_VEHICLES)
    assigned_ids = [rid for a in assignments for rid in a.ride_ids_in_order]
    for r in AIRPORT_RUSH_RIDES:
        assert r.id in assigned_ids, f"Ride {r.id} not assigned"
    assert total_miles > 0


def test_haversine_portland_to_pdx():
    # Portland downtown to PDX airport is ~6.5 miles as the crow flies
    dist = haversine_miles(45.5152, -122.6784, 45.5898, -122.5951)
    assert 5 < dist < 10


def test_scenarios_registry():
    assert "downtown_mix" in SCENARIOS
    assert "airport_rush" in SCENARIOS
    for key, s in SCENARIOS.items():
        assert "label" in s
        assert "rides" in s
        assert "vehicles" in s
        assert len(s["rides"]) >= 8
