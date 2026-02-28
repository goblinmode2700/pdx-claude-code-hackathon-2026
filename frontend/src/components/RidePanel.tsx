import type { Ride, Vehicle, RouteAssignment } from "../types";
import { PRIORITY_COLORS, VEHICLE_COLORS } from "../lib/utils";

interface RidePanelProps {
  rides: Ride[];
  vehicles: Vehicle[];
  assignments: RouteAssignment[];
}

function getAssignedVehicle(rideId: string, assignments: RouteAssignment[]): string | null {
  for (const a of assignments) {
    if (a.ride_ids_in_order.includes(rideId)) return a.vehicle_id;
  }
  return null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function RidePanel({ rides, vehicles, assignments }: RidePanelProps) {
  const hasAssignments = assignments.length > 0;
  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Ride Requests ({rides.length})
      </h2>
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {rides.map((ride) => {
          const vehicleId = getAssignedVehicle(ride.id, assignments);
          const vehicle = vehicleId ? vehicleMap[vehicleId] : null;
          const isAssigned = !!vehicleId;
          const borderColor = isAssigned ? VEHICLE_COLORS[vehicleId!] : undefined;

          return (
            <div
              key={ride.id}
              className={`rounded-lg border p-2.5 transition-all ${
                hasAssignments && !isAssigned
                  ? "bg-gray-50 opacity-50 border-gray-200"
                  : isAssigned
                    ? "bg-white shadow-sm"
                    : "bg-white border-gray-200"
              }`}
              style={isAssigned ? { borderLeftWidth: 4, borderLeftColor: borderColor } : undefined}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold">{ride.id}</span>
                <span
                  className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: PRIORITY_COLORS[ride.priority] }}
                >
                  {ride.priority}
                </span>
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <div>
                  <span className="text-green-600 font-semibold text-[10px] uppercase">Pickup: </span>
                  {ride.pickup_label || `${ride.pickup_lat.toFixed(3)}, ${ride.pickup_lng.toFixed(3)}`}
                </div>
                <div>
                  <span className="text-red-500 font-semibold text-[10px] uppercase">Dropoff: </span>
                  {ride.dropoff_label || `${ride.dropoff_lat.toFixed(3)}, ${ride.dropoff_lng.toFixed(3)}`}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-gray-500">
                  <span>{ride.passenger_count} passenger{ride.passenger_count !== 1 ? "s" : ""}</span>
                  {ride.luggage_count > 0 && <span>{ride.luggage_count} bag{ride.luggage_count !== 1 ? "s" : ""}</span>}
                  {ride.service_type !== "transfer" && (
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-px rounded capitalize">
                      {ride.service_type.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                <div className="text-gray-400">
                  Window: {formatTime(ride.time_window_start)} - {formatTime(ride.time_window_end)}
                </div>
              </div>

              {ride.notes && (
                <div className="text-[10px] text-amber-600 mt-1.5 italic">{ride.notes}</div>
              )}

              {isAssigned && vehicle && (
                <div
                  className="mt-2 text-[10px] font-semibold px-2 py-1 rounded inline-flex items-center gap-1 text-white"
                  style={{ backgroundColor: VEHICLE_COLORS[vehicleId!] }}
                >
                  <span>Assigned: {vehicleId} - {vehicle.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
