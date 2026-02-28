import type { Vehicle, RouteAssignment } from "../types";
import { VEHICLE_COLORS } from "../lib/utils";

interface VehiclePanelProps {
  vehicles: Vehicle[];
  assignments: RouteAssignment[];
}

export function VehiclePanel({ vehicles, assignments }: VehiclePanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Vehicles ({vehicles.length})
      </h2>
      <div className="flex flex-col gap-1.5">
        {vehicles.map((v) => {
          const assignment = assignments.find((a) => a.vehicle_id === v.id);
          const color = VEHICLE_COLORS[v.id] || "#6b7280";
          return (
            <div
              key={v.id}
              className="rounded-lg border bg-white p-3 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: color }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{v.name}</span>
                <span className="text-xs font-mono text-gray-400">{v.id}</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>Cap: {v.capacity}</span>
                <span>Lug: {v.luggage_capacity}</span>
                <span className="capitalize">{v.vehicle_type}</span>
              </div>
              {assignment && (
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium">
                      {assignment.ride_ids_in_order.join(" → ")}
                    </span>
                    {assignment.route_miles > 0 && (
                      <span className="font-semibold text-indigo-600">
                        {assignment.route_miles} mi
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 italic">{assignment.reasoning}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
