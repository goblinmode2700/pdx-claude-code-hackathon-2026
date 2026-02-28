export type ServiceType = "transfer" | "airport_arrival" | "airport_departure" | "hourly" | "point_to_point";
export type VehicleTypeEnum = "sedan" | "suv" | "van" | "sprinter";

export interface Ride {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  time_window_start: string;
  time_window_end: string;
  passenger_count: number;
  priority: "low" | "medium" | "high" | "urgent";
  pickup_label: string;
  dropoff_label: string;
  service_type: ServiceType;
  luggage_count: number;
  notes: string;
}

export interface Vehicle {
  id: string;
  name: string;
  current_lat: number;
  current_lng: number;
  capacity: number;
  status: "available" | "en_route" | "on_trip" | "off_duty";
  vehicle_type: VehicleTypeEnum;
  luggage_capacity: number;
}

export interface RouteAssignment {
  vehicle_id: string;
  ride_ids_in_order: string[];
  reasoning: string;
  polyline: number[][];  // [[lat, lng], ...] from Google Directions
  route_miles: number;
}

export interface OptimizationResult {
  assignments: RouteAssignment[];
  overall_strategy: string;
  unassigned_rides: string[];
}

export interface OptimizeResponse {
  result: OptimizationResult;
  prompt_used: string;
  naive_miles: number;
  optimized_miles: number;
  naive_violations: number;
  optimized_violations: number;
  naive_assignments: RouteAssignment[];
}

export interface ScenarioInfo {
  label: string;
  description: string;
}

export interface SeedData {
  rides: Ride[];
  vehicles: Vehicle[];
}
