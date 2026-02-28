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
        <pre
          ref={streamRef}
          className="flex-1 bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono
                     overflow-y-auto whitespace-pre-wrap break-words opacity-50"
        >
          {streamingText}
        </pre>
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
        <pre
          ref={streamRef}
          className="flex-1 bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono
                     overflow-y-auto whitespace-pre-wrap break-words"
        >
          {streamingText}
          <span className="animate-pulse">|</span>
        </pre>
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
            <div className="text-center mt-2 text-lg font-bold text-green-700 bg-green-100 rounded-md py-1.5">
              {milesSaved.toFixed(1)} mi saved
              <span className="text-2xl ml-1">{pctSaved}%</span>
              <span className="text-xs font-medium ml-1">more efficient</span>
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
