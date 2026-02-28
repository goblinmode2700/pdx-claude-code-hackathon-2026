from pydantic import BaseModel
from enum import Enum


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class VehicleStatus(str, Enum):
    AVAILABLE = "available"
    EN_ROUTE = "en_route"
    ON_TRIP = "on_trip"
    OFF_DUTY = "off_duty"


class Ride(BaseModel):
    id: str
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    time_window_start: str  # ISO format, keeping it simple
    time_window_end: str
    passenger_count: int
    priority: Priority
    pickup_label: str = ""
    dropoff_label: str = ""


class Vehicle(BaseModel):
    id: str
    name: str
    current_lat: float
    current_lng: float
    capacity: int
    status: VehicleStatus


class RouteAssignment(BaseModel):
    vehicle_id: str
    ride_ids_in_order: list[str]
    reasoning: str


class OptimizationResult(BaseModel):
    assignments: list[RouteAssignment]
    overall_strategy: str
    unassigned_rides: list[str] = []


class OptimizeRequest(BaseModel):
    rides: list[Ride]
    vehicles: list[Vehicle]


class OptimizeResponse(BaseModel):
    result: OptimizationResult
    prompt_used: str  # show the prompt for transparency
