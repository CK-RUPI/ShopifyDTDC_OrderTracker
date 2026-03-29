"use client";

import { TrackingEvent } from "@/lib/data/types";

interface TrackingTimelineProps {
  events: TrackingEvent[];
}

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No tracking events yet. Click &quot;Refresh Tracking&quot; to fetch updates.
      </p>
    );
  }

  // Show most recent first
  const sortedEvents = [...events].reverse();

  return (
    <div className="py-4 px-2">
      <div className="relative">
        {sortedEvents.map((event, index) => (
          <div key={index} className="flex gap-4 pb-4 last:pb-0">
            {/* Timeline dot and line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  index === 0 ? "bg-blue-500" : "bg-gray-300"
                }`}
              />
              {index < sortedEvents.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-1" />
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 -mt-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{event.status}</span>
                <span className="text-xs text-gray-400">
                  {event.location}
                  {event.branch ? ` - ${event.branch}` : ""}
                </span>
              </div>
              {event.description && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {event.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {formatTimestamp(event.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const date = new Date(ts.replace(" ", "T"));
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}
