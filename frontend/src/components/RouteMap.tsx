import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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

function createIcon(color: string, shape: "circle" | "square" | "car") {
  const svg =
    shape === "circle"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="${color}" stroke="white" stroke-width="2"/></svg>`
      : shape === "square"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect x="2" y="2" width="16" height="16" rx="3" fill="${color}" stroke="white" stroke-width="2"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/><text x="14" y="19" font-size="14" fill="white" text-anchor="middle" font-family="sans-serif">🚐</text></svg>`;
  return L.divIcon({
    html: svg,
    iconSize: shape === "car" ? [28, 28] : [20, 20],
    iconAnchor: shape === "car" ? [14, 14] : [10, 10],
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

interface RouteMapProps {
  rides: Ride[];
  vehicles: Vehicle[];
  assignments: RouteAssignment[];
}

export function RouteMap({ rides, vehicles, assignments }: RouteMapProps) {
  const rideMap = new Map(rides.map((r) => [r.id, r]));

  // Build route lines per vehicle
  const routeLines = assignments.map((a) => {
    const vehicle = vehicles.find((v) => v.id === a.vehicle_id);
    const color = VEHICLE_COLORS[a.vehicle_id] || "#6b7280";
    const points: [number, number][] = [];

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
    return { vehicleId: a.vehicle_id, color, points };
  });

  return (
    <MapContainer center={PORTLAND_CENTER} zoom={12} className="h-full w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds rides={rides} vehicles={vehicles} />

      {/* Pickup markers (circles) */}
      {rides.map((r) => (
        <Marker
          key={`pickup-${r.id}`}
          position={[r.pickup_lat, r.pickup_lng]}
          icon={createIcon("#22c55e", "circle")}
        >
          <Popup>
            <strong>{r.id} Pickup</strong>
            <br />
            {r.pickup_label}
            <br />
            {r.passenger_count} pax | {r.priority}
          </Popup>
        </Marker>
      ))}

      {/* Dropoff markers (squares) */}
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
            Cap: {v.capacity} | {v.status}
          </Popup>
        </Marker>
      ))}

      {/* Route lines */}
      {routeLines.map((rl) => (
        <Polyline
          key={`route-${rl.vehicleId}`}
          positions={rl.points}
          pathOptions={{
            color: rl.color,
            weight: 3,
            opacity: 0.8,
            dashArray: "8 4",
          }}
        />
      ))}
    </MapContainer>
  );
}
