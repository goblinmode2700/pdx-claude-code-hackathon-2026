import type { OptimizationResult } from "../types";

interface ReasoningPanelProps {
  result: OptimizationResult | null;
  loading: boolean;
  naiveMiles: number | null;
  optimizedMiles: number | null;
  naiveViolations: number | null;
  optimizedViolations: number | null;
}

export function ReasoningPanel({
  result,
  loading,
  naiveMiles,
  optimizedMiles,
  naiveViolations,
  optimizedViolations,
}: ReasoningPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">Claude is thinking...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm px-4 text-center">
        <p>Hit <strong>Optimize</strong> to let Claude analyze the ride queue and assign optimal routes.</p>
      </div>
    );
  }

  const showComparison = naiveMiles != null && optimizedMiles != null;
  const milesSaved = showComparison ? naiveMiles! - optimizedMiles! : null;
  const pctSaved = showComparison && naiveMiles! > 0
    ? Math.round((milesSaved! / naiveMiles!) * 100)
    : null;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-180px)]">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Naive vs AI Optimized
      </h2>

      {/* Comparison card */}
      {showComparison && (
        <div className="bg-gradient-to-r from-red-50 to-green-50 border rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase font-semibold text-red-500 tracking-wide">Round-Robin</div>
              <div className="text-xl font-bold text-red-600">{naiveMiles} mi</div>
              {naiveViolations != null && naiveViolations > 0 && (
                <div className="text-[10px] text-red-500 mt-0.5">
                  {naiveViolations} constraint violation{naiveViolations !== 1 ? "s" : ""}
                </div>
              )}
              {naiveViolations === 0 && (
                <div className="text-[10px] text-gray-400 mt-0.5">0 violations</div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-green-600 tracking-wide">AI Optimized</div>
              <div className="text-xl font-bold text-green-700">{optimizedMiles} mi</div>
              {optimizedViolations != null && (
                <div className="text-[10px] text-green-600 mt-0.5">
                  {optimizedViolations === 0 ? "0 violations" : `${optimizedViolations} violation${optimizedViolations !== 1 ? "s" : ""}`}
                </div>
              )}
            </div>
          </div>
          {milesSaved != null && milesSaved > 0 && (
            <div className="text-center mt-2 text-sm font-semibold text-green-700 bg-green-100 rounded-md py-1">
              {milesSaved.toFixed(1)} miles saved ({pctSaved}% more efficient)
            </div>
          )}
          {milesSaved != null && milesSaved <= 0 && naiveViolations != null && naiveViolations > optimizedViolations! && (
            <div className="text-center mt-2 text-sm font-semibold text-green-700 bg-green-100 rounded-md py-1">
              {naiveViolations - optimizedViolations!} fewer constraint violations
            </div>
          )}
        </div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Claude's Strategy
      </h2>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-900">
        {result.overall_strategy}
      </div>

      {result.assignments.map((a) => (
        <div key={a.vehicle_id} className="bg-white border rounded-lg p-3 shadow-sm">
          <div className="font-semibold text-sm mb-1">
            {a.vehicle_id}: {a.ride_ids_in_order.join(" → ")}
          </div>
          <p className="text-xs text-gray-600">{a.reasoning}</p>
        </div>
      ))}

      {result.unassigned_rides.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <strong>Unassigned:</strong> {result.unassigned_rides.join(", ")}
        </div>
      )}
    </div>
  );
}
