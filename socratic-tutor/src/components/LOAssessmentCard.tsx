"use client";

import { useMemo, useState } from "react";
import type { LOAssessmentRecord } from "@/types";

const statusColors: Record<string, string> = {
  not_observed:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  insufficient_evidence:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  emerging:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  meets:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  exceeds:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const statusLabels: Record<string, string> = {
  not_observed: "Not Observed",
  insufficient_evidence: "Insufficient Evidence",
  emerging: "Emerging",
  meets: "Meets",
  exceeds: "Exceeds",
};

const confidenceDotColor: Record<string, string> = {
  low: "bg-red-500",
  medium: "bg-amber-500",
  high: "bg-emerald-500",
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {assessment.learningOutcome}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[assessment.status] ?? statusColors.not_observed}`}
            >
              {statusLabels[assessment.status] ?? assessment.status}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
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
          className="rounded-md p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Expand evidence"
        >
          <svg
            className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${
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
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          {assessment.evidenceSummary && (
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">
                Evidence
              </p>
              <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                {assessment.evidenceSummary}
              </p>
            </div>
          )}

          {processMetrics && (
            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">
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
