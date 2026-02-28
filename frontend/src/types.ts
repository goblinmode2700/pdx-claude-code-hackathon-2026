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
}

export interface Vehicle {
  id: string;
  name: string;
  current_lat: number;
  current_lng: number;
  capacity: number;
  status: "available" | "en_route" | "on_trip" | "off_duty";
}

export interface RouteAssignment {
  vehicle_id: string;
  ride_ids_in_order: string[];
  reasoning: string;
}

export interface OptimizationResult {
  assignments: RouteAssignment[];
  overall_strategy: string;
  unassigned_rides: string[];
}

export interface SeedData {
  rides: Ride[];
  vehicles: Vehicle[];
}
