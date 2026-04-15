"use client";

import { useMemo, useState } from "react";
import type { LOAssessmentRecord } from "@/types";

const statusColors: Record<string, string> = {
  not_observed: "bg-[rgba(34,34,34,0.05)] text-[var(--dim-grey)]",
  insufficient_evidence: "bg-[rgba(144,111,18,0.10)] text-[#906f12]",
  emerging: "bg-[rgba(223,47,38,0.08)] text-[var(--signal)]",
  meets: "bg-[rgba(17,120,144,0.10)] text-[var(--teal)]",
  exceeds: "bg-[rgba(114,133,3,0.12)] text-[var(--olive)]",
};

const statusLabels: Record<string, string> = {
  not_observed: "Not Observed",
  insufficient_evidence: "Insufficient Evidence",
  emerging: "Emerging",
  meets: "Meets",
  exceeds: "Exceeds",
};

const confidenceDotColor: Record<string, string> = {
  low: "bg-[var(--signal)]",
  medium: "bg-[#906f12]",
  high: "bg-[var(--teal)]",
};

interface LOAssessmentCardProps {
  assessment: LOAssessmentRecord;
}

export function LOAssessmentCard({ assessment }: LOAssessmentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const processMetrics = useMemo(() => {
    if (!assessment.processMetrics) return null;

    try {
      return JSON.parse(assessment.processMetrics) as {
        hintRungs?: number;
        misconceptionCount?: number;
        misconceptionsResolved?: number;
        checkpointsAddressed?: number;
      };
    } catch {
      return null;
    }
  }, [assessment.processMetrics]);

  return (
    <div className="rounded-2xl border border-[var(--rule)] bg-white p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--charcoal)]">
            {assessment.learningOutcome}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[assessment.status] ?? statusColors.not_observed}`}
            >
              {statusLabels[assessment.status] ?? assessment.status}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[var(--dim-grey)]">
              <span
                className={`h-2.5 w-2.5 rounded-full ${confidenceDotColor[assessment.confidence] ?? confidenceDotColor.medium}`}
                title={`${assessment.confidence} confidence`}
              />
              <span className="capitalize">{assessment.confidence} confidence</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded((value) => !value)}
          className="rounded-md p-1 transition hover:bg-[rgba(34,34,34,0.05)]"
          aria-label="Expand evidence"
        >
          <svg
            className={`h-4 w-4 text-[var(--dim-grey)] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-[var(--rule)] pt-3 text-sm">
          {assessment.evidenceSummary && (
            <div>
              <p className="mb-1 font-medium text-[var(--charcoal)]">
                Evidence
              </p>
              <p className="text-xs leading-6 text-[var(--dim-grey)]">
                {assessment.evidenceSummary}
              </p>
            </div>
          )}

          {processMetrics && (
            <div className="rounded-xl bg-[rgba(34,34,34,0.03)] p-3 text-xs leading-5 text-[var(--dim-grey)]">
              <p className="mb-1 font-medium text-[var(--charcoal)]">
                Process Metrics
              </p>
              {processMetrics.misconceptionCount !== undefined && (
                <p>
                  Misconceptions: {processMetrics.misconceptionsResolved ?? 0}/
                  {processMetrics.misconceptionCount} resolved
                </p>
              )}
              {processMetrics.checkpointsAddressed !== undefined && (
                <p>Questions addressed: {processMetrics.checkpointsAddressed}</p>
              )}
              {processMetrics.hintRungs !== undefined && processMetrics.hintRungs > 0 && (
                <p>Highest hint rung used: {processMetrics.hintRungs}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
