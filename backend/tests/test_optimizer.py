from app.optimizer import build_prompt
from app.seed import SEED_RIDES, SEED_VEHICLES


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
