import type { OptimizationResult } from "../types";

interface ReasoningPanelProps {
  result: OptimizationResult | null;
  loading: boolean;
}

export function ReasoningPanel({ result, loading }: ReasoningPanelProps) {
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

  return (
    <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-180px)]">
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
