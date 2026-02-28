import { useState, useEffect, useRef } from "react";
import type { OptimizationResult } from "../types";

interface ReasoningPanelProps {
  result: OptimizationResult | null;
  loading: boolean;
  streamingText: string;
  streamStatus: string | null;
  naiveMiles: number | null;
  optimizedMiles: number | null;
  naiveViolations: number | null;
  optimizedViolations: number | null;
  promptUsed: string | null;
}

export function ReasoningPanel({
  result,
  loading,
  streamingText,
  streamStatus,
  naiveMiles,
  optimizedMiles,
  naiveViolations,
  optimizedViolations,
  promptUsed,
}: ReasoningPanelProps) {
  const streamRef = useRef<HTMLPreElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Auto-scroll streaming text
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText]);

  if (loading && streamStatus) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Claude is reasoning...
          </h2>
        </div>
        <div
          ref={streamRef as React.RefObject<HTMLDivElement>}
          className="flex-1 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-gray-800
                     overflow-y-auto whitespace-pre-wrap break-words leading-relaxed opacity-60"
        >
          {streamingText}
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-sm text-indigo-700 font-medium">{streamStatus}</span>
        </div>
      </div>
    );
  }

  if (loading && streamingText) {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Claude is reasoning...
          </h2>
        </div>
        <div
          ref={streamRef as React.RefObject<HTMLDivElement>}
          className="flex-1 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-gray-800
                     overflow-y-auto whitespace-pre-wrap break-words leading-relaxed"
        >
          {streamingText}
          <span className="animate-pulse text-indigo-500">|</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">Connecting to Claude...</span>
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
        <div className="border rounded-lg overflow-hidden">
          {/* Savings hero */}
          {milesSaved != null && milesSaved > 0 && (
            <div className="bg-green-600 text-white text-center py-3 px-3">
              <div className="text-3xl font-black tracking-tight">{pctSaved}%</div>
              <div className="text-sm font-medium opacity-90">more efficient</div>
              <div className="text-xs opacity-75 mt-0.5">{milesSaved.toFixed(1)} miles saved</div>
            </div>
          )}
          {milesSaved != null && milesSaved <= 0 && naiveViolations != null && naiveViolations > optimizedViolations! && (
            <div className="bg-green-600 text-white text-center py-3 px-3">
              <div className="text-3xl font-black tracking-tight">{naiveViolations - optimizedViolations!}</div>
              <div className="text-sm font-medium opacity-90">fewer violations</div>
            </div>
          )}
          {/* Stats rows */}
          <div className="divide-y">
            <div className="flex items-center justify-between px-3 py-2 bg-red-50">
              <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Round-Robin</span>
              <div className="text-right">
                <span className="text-lg font-bold text-red-600">{naiveMiles} mi</span>
                {naiveViolations != null && naiveViolations > 0 && (
                  <span className="text-[10px] text-red-400 ml-2">
                    {naiveViolations} violation{naiveViolations !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-green-50">
              <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">AI Optimized</span>
              <div className="text-right">
                <span className="text-lg font-bold text-green-700">{optimizedMiles} mi</span>
                {optimizedViolations != null && (
                  <span className="text-[10px] text-green-500 ml-2">
                    {optimizedViolations === 0 ? "0 violations" : `${optimizedViolations} violation${optimizedViolations !== 1 ? "s" : ""}`}
                  </span>
                )}
              </div>
            </div>
          </div>
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
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm">
              {a.vehicle_id}: {a.ride_ids_in_order.join(" → ")}
            </span>
            {a.route_miles > 0 && (
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                {a.route_miles} mi
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">{a.reasoning}</p>
        </div>
      ))}

      {result.unassigned_rides.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <strong>Unassigned:</strong> {result.unassigned_rides.join(", ")}
        </div>
      )}

      {/* Prompt viewer */}
      {promptUsed && (
        <div className="border-t pt-3 mt-1">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <span className={`inline-block transition-transform ${showPrompt ? "rotate-90" : ""}`}>
              ▶
            </span>
            View Prompt Sent to Claude
          </button>
          {showPrompt && (
            <pre className="mt-2 bg-gray-50 border rounded-lg p-3 text-[10px] font-mono text-gray-600
                            overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {promptUsed}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
