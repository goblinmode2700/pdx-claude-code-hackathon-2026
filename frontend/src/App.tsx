import { useState, useEffect, useCallback } from "react";
import type { Ride, Vehicle, OptimizationResult } from "./types";
import { RouteMap } from "./components/RouteMap";
import { RidePanel } from "./components/RidePanel";
import { VehiclePanel } from "./components/VehiclePanel";
import { ReasoningPanel } from "./components/ReasoningPanel";

function App() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load seed data on mount
  useEffect(() => {
    fetch("/api/seed")
      .then((r) => r.json())
      .then((data) => {
        setRides(data.rides);
        setVehicles(data.vehicles);
      })
      .catch((e) => setError(`Failed to load seed data: ${e.message}`));
  }, []);

  const handleOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rides, vehicles }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data.result);
    } catch (e) {
      setError(`Optimization failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [rides, vehicles]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">Fleet Route Optimizer</h1>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            PDX Hackathon 2026
          </span>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>
          )}
          <button
            onClick={handleOptimize}
            disabled={loading || rides.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                       hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors shadow-sm"
          >
            {loading ? "Optimizing..." : "Optimize Routes"}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — rides + vehicles */}
        <aside className="w-72 border-r bg-gray-50/50 p-3 overflow-y-auto flex flex-col gap-4">
          <RidePanel rides={rides} assignments={result?.assignments ?? []} />
          <VehiclePanel vehicles={vehicles} assignments={result?.assignments ?? []} />
        </aside>

        {/* Center — map */}
        <main className="flex-1 p-3">
          <RouteMap
            rides={rides}
            vehicles={vehicles}
            assignments={result?.assignments ?? []}
          />
        </main>

        {/* Right sidebar — reasoning */}
        <aside className="w-80 border-l bg-gray-50/50 p-3">
          <ReasoningPanel result={result} loading={loading} />
        </aside>
      </div>
    </div>
  );
}

export default App;
