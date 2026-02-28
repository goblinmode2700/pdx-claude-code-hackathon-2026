import type { Ride, RouteAssignment } from "../types";
import { PRIORITY_COLORS, VEHICLE_COLORS } from "../lib/utils";

interface RidePanelProps {
  rides: Ride[];
  assignments: RouteAssignment[];
}

function getAssignedVehicle(rideId: string, assignments: RouteAssignment[]): string | null {
  for (const a of assignments) {
    if (a.ride_ids_in_order.includes(rideId)) return a.vehicle_id;
  }
  return null;
}

export function RidePanel({ rides, assignments }: RidePanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Ride Queue ({rides.length})
      </h2>
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {rides.map((ride) => {
          const vehicleId = getAssignedVehicle(ride.id, assignments);
          const borderColor = vehicleId ? VEHICLE_COLORS[vehicleId] : "transparent";
          return (
            <div
              key={ride.id}
              className="rounded-lg border bg-white p-3 shadow-sm transition-all"
              style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold">{ride.id}</span>
                <span
                  className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: PRIORITY_COLORS[ride.priority] }}
                >
                  {ride.priority}
                </span>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>
                  <span className="text-green-600 font-medium">P</span>{" "}
                  {ride.pickup_label || `${ride.pickup_lat.toFixed(3)}, ${ride.pickup_lng.toFixed(3)}`}
                </div>
                <div>
                  <span className="text-red-600 font-medium">D</span>{" "}
                  {ride.dropoff_label || `${ride.dropoff_lat.toFixed(3)}, ${ride.dropoff_lng.toFixed(3)}`}
                </div>
                <div className="flex gap-3 pt-0.5 text-gray-400">
                  <span>{ride.passenger_count} pax</span>
                  <span>
                    {new Date(ride.time_window_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" - "}
                    {new Date(ride.time_window_end).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              {vehicleId && (
                <div
                  className="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block text-white"
                  style={{ backgroundColor: VEHICLE_COLORS[vehicleId] }}
                >
                  {vehicleId}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
