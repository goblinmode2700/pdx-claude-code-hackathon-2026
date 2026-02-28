import { useState, useEffect, useCallback } from "react";
import type { Ride, Vehicle, OptimizeResponse, ScenarioInfo, RouteAssignment } from "./types";
import { RouteMap } from "./components/RouteMap";
import { RidePanel } from "./components/RidePanel";
import { VehiclePanel } from "./components/VehiclePanel";
import { ReasoningPanel } from "./components/ReasoningPanel";

type RouteView = "optimized" | "naive" | "both";

function App() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [optimizeResponse, setOptimizeResponse] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Record<string, ScenarioInfo>>({});
  const [activeScenario, setActiveScenario] = useState("downtown_mix");
  const [routeView, setRouteView] = useState<RouteView>("optimized");

  // Load scenarios list
  useEffect(() => {
    fetch("/api/scenarios")
      .then((r) => r.json())
      .then((data) => setScenarios(data.scenarios))
      .catch(() => {});
  }, []);

  // Load seed data when scenario changes
  useEffect(() => {
    setOptimizeResponse(null);
    setError(null);
    setRouteView("optimized");
    fetch(`/api/seed?scenario=${activeScenario}`)
      .then((r) => r.json())
      .then((data) => {
        setRides(data.rides);
        setVehicles(data.vehicles);
      })
      .catch((e) => setError(`Failed to load seed data: ${e.message}`));
  }, [activeScenario]);

  const handleOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rides, vehicles }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data: OptimizeResponse = await res.json();
      setOptimizeResponse(data);
      setRouteView("optimized");
    } catch (e) {
      setError(`Optimization failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [rides, vehicles]);

  // Compute which assignments to show on map based on toggle
  const visibleAssignments = optimizeResponse?.result.assignments ?? [];
  const naiveAssignments = optimizeResponse?.naive_assignments ?? [];

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
          {/* Scenario selector */}
          <select
            value={activeScenario}
            onChange={(e) => setActiveScenario(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(scenarios).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>

          {/* Error with retry */}
          {error && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>
              <button
                onClick={handleOptimize}
                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md hover:bg-red-200 transition-colors"
              >
                Retry
              </button>
            </div>
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
          <RidePanel rides={rides} assignments={visibleAssignments} />
          <VehiclePanel vehicles={vehicles} assignments={visibleAssignments} />
        </aside>

        {/* Center — map */}
        <main className="flex-1 p-3 relative">
          <RouteMap
            rides={rides}
            vehicles={vehicles}
            assignments={routeView === "naive" ? naiveAssignments : visibleAssignments}
            naiveAssignments={routeView === "both" ? naiveAssignments : []}
            loading={loading}
          />
          {/* Route view toggle — only show after optimization */}
          {optimizeResponse && !loading && (
            <div className="absolute top-5 right-5 z-[1000] bg-white rounded-lg shadow-lg border p-1 flex gap-0.5">
              {(["naive", "both", "optimized"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setRouteView(view)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    routeView === view
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {view === "naive" ? "Naive" : view === "optimized" ? "AI Optimized" : "Both"}
                </button>
              ))}
            </div>
          )}
        </main>

        {/* Right sidebar — reasoning */}
        <aside className="w-80 border-l bg-gray-50/50 p-3">
          <ReasoningPanel
            result={optimizeResponse?.result ?? null}
            loading={loading}
            naiveMiles={optimizeResponse?.naive_miles ?? null}
            optimizedMiles={optimizeResponse?.optimized_miles ?? null}
            naiveViolations={optimizeResponse?.naive_violations ?? null}
            optimizedViolations={optimizeResponse?.optimized_violations ?? null}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
