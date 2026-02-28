import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { Ride, Vehicle, RouteAssignment } from "../types";
import { VEHICLE_COLORS } from "../lib/utils";

// Fix default marker icons
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

function createIcon(color: string, shape: "circle" | "square" | "car", pulsing = false) {
  const pulseStyle = pulsing ? 'style="animation: pulse 1.2s ease-in-out infinite"' : '';
  const svg =
    shape === "circle"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2.5" ${pulseStyle}/><text x="12" y="16" font-size="10" fill="white" text-anchor="middle" font-weight="bold" font-family="sans-serif">P</text></svg>`
      : shape === "square"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect x="2" y="2" width="16" height="16" rx="3" fill="${color}" stroke="white" stroke-width="2" ${pulseStyle}/><text x="10" y="14" font-size="9" fill="white" text-anchor="middle" font-weight="bold" font-family="sans-serif">D</text></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5" ${pulseStyle}/><text x="16" y="21" font-size="15" fill="white" text-anchor="middle" font-family="sans-serif">&#x1F690;</text></svg>`;
  return L.divIcon({
    html: svg,
    iconSize: shape === "car" ? [32, 32] : shape === "circle" ? [24, 24] : [20, 20],
    iconAnchor: shape === "car" ? [16, 16] : shape === "circle" ? [12, 12] : [10, 10],
    className: "",
  });
}

const PORTLAND_CENTER: [number, number] = [45.5152, -122.6784];

function FitBounds({ rides, vehicles }: { rides: Ride[]; vehicles: Vehicle[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [
      ...rides.flatMap((r) => [
        [r.pickup_lat, r.pickup_lng] as [number, number],
        [r.dropoff_lat, r.dropoff_lng] as [number, number],
      ]),
      ...vehicles.map((v) => [v.current_lat, v.current_lng] as [number, number]),
    ];
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    }
  }, [rides, vehicles, map]);
  return null;
}

interface RouteLine {
  vehicleId: string;
  vehicleName: string;
  color: string;
  points: [number, number][];
  rideIds: string[];
  miles: number;
}

function buildRouteLines(
  assignments: RouteAssignment[],
  rides: Ride[],
  vehicles: Vehicle[],
  colorOverride?: string,
): RouteLine[] {
  const rideMap = new Map(rides.map((r) => [r.id, r]));
  return assignments.map((a) => {
    const vehicle = vehicles.find((v) => v.id === a.vehicle_id);
    const color = colorOverride || VEHICLE_COLORS[a.vehicle_id] || "#6b7280";

    let points: [number, number][];
    if (a.polyline && a.polyline.length > 0) {
      points = a.polyline.map((p) => [p[0], p[1]] as [number, number]);
    } else {
      points = [];
      if (vehicle) {
        points.push([vehicle.current_lat, vehicle.current_lng]);
      }
      for (const rideId of a.ride_ids_in_order) {
        const ride = rideMap.get(rideId);
        if (ride) {
          points.push([ride.pickup_lat, ride.pickup_lng]);
          points.push([ride.dropoff_lat, ride.dropoff_lng]);
        }
      }
    }

    return {
      vehicleId: a.vehicle_id,
      vehicleName: vehicle?.name ?? a.vehicle_id,
      color,
      points,
      rideIds: a.ride_ids_in_order,
      miles: a.route_miles,
    };
  });
}

interface RouteMapProps {
  rides: Ride[];
  vehicles: Vehicle[];
  assignments: RouteAssignment[];
  naiveAssignments?: RouteAssignment[];
  loading?: boolean;
}

export function RouteMap({ rides, vehicles, assignments, naiveAssignments = [], loading }: RouteMapProps) {
  const routeLines = buildRouteLines(assignments, rides, vehicles);
  const naiveLines = buildRouteLines(naiveAssignments, rides, vehicles, "#9ca3af");
  const hasRoutes = routeLines.length > 0;

  return (
    <MapContainer center={PORTLAND_CENTER} zoom={12} className="h-full w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds rides={rides} vehicles={vehicles} />

      {/* Naive route lines (dashed gray, rendered underneath) */}
      {naiveLines.map((rl) => (
        <Polyline
          key={`naive-${rl.vehicleId}`}
          positions={rl.points}
          pathOptions={{
            color: rl.color,
            weight: 3,
            opacity: 0.5,
            dashArray: "8 6",
          }}
        >
          <Tooltip sticky>
            <span style={{ fontSize: 11 }}>Naive: {rl.vehicleName}</span>
          </Tooltip>
        </Polyline>
      ))}

      {/* Optimized route lines (solid colored, on top) */}
      {routeLines.map((rl) => (
        <Polyline
          key={`route-${rl.vehicleId}`}
          positions={rl.points}
          pathOptions={{
            color: rl.color,
            weight: 4,
            opacity: 0.85,
          }}
        >
          <Tooltip sticky>
            <div style={{ fontSize: 11, lineHeight: 1.4 }}>
              <strong>{rl.vehicleName}</strong>
              <br />
              {rl.rideIds.join(" → ")}
              {rl.miles > 0 && <><br />{rl.miles} mi</>}
            </div>
          </Tooltip>
        </Polyline>
      ))}

      {/* Pickup markers (circles with P) */}
      {rides.map((r) => (
        <Marker
          key={`pickup-${r.id}`}
          position={[r.pickup_lat, r.pickup_lng]}
          icon={createIcon("#22c55e", "circle", loading)}
        >
          <Popup>
            <strong>{r.id} Pickup</strong>
            <br />
            {r.pickup_label}
            <br />
            {r.passenger_count} passengers | {r.priority}
          </Popup>
        </Marker>
      ))}

      {/* Dropoff markers (squares with D) */}
      {rides.map((r) => (
        <Marker
          key={`dropoff-${r.id}`}
          position={[r.dropoff_lat, r.dropoff_lng]}
          icon={createIcon("#ef4444", "square")}
        >
          <Popup>
            <strong>{r.id} Dropoff</strong>
            <br />
            {r.dropoff_label}
          </Popup>
        </Marker>
      ))}

      {/* Vehicle markers */}
      {vehicles.map((v) => (
        <Marker
          key={`vehicle-${v.id}`}
          position={[v.current_lat, v.current_lng]}
          icon={createIcon(VEHICLE_COLORS[v.id] || "#6b7280", "car")}
        >
          <Popup>
            <strong>{v.name}</strong> ({v.id})
            <br />
            Capacity: {v.capacity} | {v.vehicle_type}
          </Popup>
        </Marker>
      ))}

      {/* Vehicle legend (bottom-left) */}
      {vehicles.length > 0 && !loading && (
        <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: "none" }}>
          <div
            className="leaflet-control"
            style={{
              pointerEvents: "auto",
              background: "white",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {vehicles.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: VEHICLE_COLORS[v.id] || "#6b7280",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong>{v.id}</strong> {v.name}
                </span>
              </div>
            ))}
            {hasRoutes && (
              <>
                <div style={{ borderTop: "1px solid #e5e7eb", margin: "2px 0" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#22c55e" }}>
                  <span style={{ fontSize: 13 }}>&#9679;</span> Pickup
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444" }}>
                  <span style={{ fontSize: 11 }}>&#9632;</span> Dropoff
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MapContainer>
  );
}
