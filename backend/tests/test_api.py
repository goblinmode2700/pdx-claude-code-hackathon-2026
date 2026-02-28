import pytest
from httpx import AsyncClient, ASGITransport
from app.api import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_seed_returns_data(client):
    resp = await client.get("/seed")
    assert resp.status_code == 200
    data = resp.json()
    assert "rides" in data
    assert "vehicles" in data
    assert len(data["rides"]) >= 8
    assert len(data["vehicles"]) >= 3
