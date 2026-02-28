from pydantic import BaseModel
from enum import Enum


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ServiceType(str, Enum):
    TRANSFER = "transfer"
    AIRPORT_ARRIVAL = "airport_arrival"
    AIRPORT_DEPARTURE = "airport_departure"
    HOURLY = "hourly"
    POINT_TO_POINT = "point_to_point"


class VehicleStatus(str, Enum):
    AVAILABLE = "available"
    EN_ROUTE = "en_route"
    ON_TRIP = "on_trip"
    OFF_DUTY = "off_duty"


class VehicleType(str, Enum):
    SEDAN = "sedan"
    SUV = "suv"
    VAN = "van"
    SPRINTER = "sprinter"


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
    service_type: ServiceType = ServiceType.TRANSFER
    luggage_count: int = 0
    notes: str = ""


class Vehicle(BaseModel):
    id: str
    name: str
    current_lat: float
    current_lng: float
    capacity: int
    status: VehicleStatus
    vehicle_type: VehicleType = VehicleType.SEDAN
    luggage_capacity: int = 4


class RouteAssignment(BaseModel):
    vehicle_id: str
    ride_ids_in_order: list[str]
    reasoning: str
    polyline: list[list[float]] = []  # [[lat, lng], ...] for map rendering
    route_miles: float = 0.0


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
    naive_miles: float = 0.0
    optimized_miles: float = 0.0
    naive_violations: int = 0
    optimized_violations: int = 0
