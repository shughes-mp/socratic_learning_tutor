"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ReadinessHeatmap } from "@/components/instructor/readiness-heatmap";
import { LoadingState } from "@/components/ui/loading-state";
import { LOAssessmentCard } from "@/components/LOAssessmentCard";
import {
  getSessionPurposeBadgeClasses,
  getSessionPurposeOption,
  getHeatmapTitle,
} from "@/lib/session-purpose";
import type {
  ApiError,
  LOAssessmentRecord,
  MisconceptionClusterRecord,
  MisconceptionDashboardStats,
  MisconceptionOverrideRecord,
  TeachingRecommendationRecord,
} from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardResponse = {
  clusters: MisconceptionClusterRecord[];
  overrides: MisconceptionOverrideRecord[];
  sessionStats: MisconceptionDashboardStats;
};

type RecommendationsResponse = {
  recommendations: TeachingRecommendationRecord[];
  message?: string;
};

type CheckpointDifficultyRecord = {
  checkpointId: string;
  prompt: string;
  totalStudents: number;
  addressedCount: number;
  masteredCount: number;
  strugglingCount: number;
  averageTurnsSpent: number;
  difficultySignal: "no_data" | "easy" | "moderate" | "hard";
};

interface ReportData {
  id: string;
  sessionId: string;
  content: string;
  stats: string;
  generatedAt: string;
  sessionPurpose?: string;
  loAssessments?: Array<
    LOAssessmentRecord & {
      studentSession: { id: string; studentName: string };
    }
  >;
}

type ReportLOAssessment = NonNullable<ReportData["loAssessments"]>[number];

interface StudentLOAssessmentGroup {
  studentName: string;
  assessments: ReportLOAssessment[];
}

// ─── Section parser (from report page) ────────────────────────────────────────

const SECTION_PATTERNS: Array<{ key: string; patterns: string[] }> = [
  { key: "snapshot", patterns: ["SESSION SNAPSHOT"] },
  { key: "what_to_do", patterns: ["WHAT TO DO NEXT"] },
  {
    key: "heatmap",
    patterns: [
      "READINESS HEATMAP",
      "ACTIVATION HEATMAP",
      "CONSOLIDATION HEATMAP",
      "TRANSFER HEATMAP",
    ],
  },
  {
    key: "gaps",
    patterns: [
      "WHERE YOUR STUDENTS ARE NOT YET READY",
      "WHERE RETRIEVAL WAS WEAK",
      "WHAT REMAINS FRAGILE",
      "WHERE TRANSFER BROKE DOWN",
      "WHERE YOUR STUDENTS NEED HELP",
    ],
  },
  {
    key: "strengths",
    patterns: [
      "WHAT YOUR STUDENTS ARE READY FOR",
      "WHAT YOUR STUDENTS RECALLED WELL",
      "WHAT YOUR STUDENTS CONSOLIDATED",
      "WHERE YOUR STUDENTS SHOWED DEPTH",
      "WHAT YOUR STUDENTS UNDERSTOOD WELL",
    ],
  },
  { key: "per_student", patterns: ["PER-STUDENT NOTES"] },
];

interface ParsedSections {
  [key: string]: string;
  snapshot: string;
  what_to_do: string;
  heatmap: string;
  gaps: string;
  strengths: string;
  per_student: string;
  remainder: string;
}

function parseReportSections(content: string): ParsedSections {
  const result: ParsedSections = {
    snapshot: "",
    what_to_do: "",
    heatmap: "",
    gaps: "",
    strengths: "",
    per_student: "",
    remainder: "",
  };

  const markers: Array<{ index: number; key: string; length: number }> = [];

  for (const { key, patterns } of SECTION_PATTERNS) {
    for (const pattern of patterns) {
      const regex = new RegExp(
        `(^|\\n)(#{1,3}\\s*)?${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      );
      const match = content.match(regex);
      if (match && match.index !== undefined) {
        const lineStart = match.index + (match[1] === "\n" ? 1 : 0);
        markers.push({ index: lineStart, key, length: match[0].trim().length });
        break;
      }
    }
  }

  if (markers.length === 0) {
    result.remainder = content;
    return result;
  }

  markers.sort((a, b) => a.index - b.index);

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const sectionStart = content.indexOf("\n", current.index) + 1;
    const sectionEnd = next ? next.index : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd).trim();
    (result as Record<string, string>)[current.key] = sectionContent;
  }

  if (markers[0].index > 0) {
    result.remainder = content.slice(0, markers[0].index).trim();
  }

  return result;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isLiveMode(purpose: string) {
  return purpose === "during_class_prep" || purpose === "during_class_reflection";
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatTypeLabel(value: string | null) {
  switch (value) {
    case "misread":
      return "Misread the text";
    case "missing_warrant":
      return "Missed the author's support";
    case "wrong_inference":
      return "Drew the wrong conclusion";
    case "overgeneralization":
      return "Overgeneralized the claim";
    case "ignored_counterevidence":
      return "Ignored qualifying evidence";
    default:
      return "Unclassified";
  }
}

function getTypeTone(value: string | null) {
  switch (value) {
    case "misread":
      return "bg-[rgba(223,47,38,0.08)] text-[var(--signal)]";
    case "missing_warrant":
      return "bg-[rgba(144,111,18,0.10)] text-[#906f12]";
    case "wrong_inference":
      return "bg-[rgba(114,133,3,0.12)] text-[var(--olive)]";
    case "overgeneralization":
      return "bg-[rgba(17,120,144,0.10)] text-[var(--teal)]";
    case "ignored_counterevidence":
      return "bg-[rgba(34,34,34,0.06)] text-[var(--charcoal)]";
    default:
      return "bg-[rgba(34,34,34,0.06)] text-[var(--dim-grey)]";
  }
}

function getSeverityTone(value: "low" | "medium" | "high") {
  switch (value) {
    case "high":
      return "text-[var(--signal)]";
    case "medium":
      return "text-[#906f12]";
    case "low":
      return "text-[var(--teal)]";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionAnalysisPage() {
  const params = useParams() as { sessionId: string };
  const sessionId = params.sessionId;

  // ── Layout state ──
  const [sessionPurpose, setSessionPurpose] = useState<string>("pre_class");
  const [viewMode, setViewMode] = useState<"default" | "live" | "brief">("default");

  // ── Misconception data (always loads immediately) ──
  const [clusters, setClusters] = useState<MisconceptionClusterRecord[]>([]);
  const [stats, setStats] = useState<MisconceptionDashboardStats | null>(null);
  const [overrides, setOverrides] = useState<MisconceptionOverrideRecord[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [clusterError, setClusterError] = useState("");

  // ── Cluster interaction state ──
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [showAllClusters, setShowAllClusters] = useState(false);
  const [submittingOverride, setSubmittingOverride] = useState<string | null>(null);

  // ── Recommendations ──
  const [recommendations, setRecommendations] = useState<TeachingRecommendationRecord[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);
  const [detailedView, setDetailedView] = useState(true);

  // ── Checkpoint difficulty ──
  const [checkpointDifficulty, setCheckpointDifficulty] = useState<CheckpointDifficultyRecord[]>([]);

  // ── Report data (async generation) ──
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  // ── Derived ──
  const live = isLiveMode(sessionPurpose);
  const effectiveView = viewMode === "default" ? (live ? "live" : "brief") : viewMode;
  const topClusters = useMemo(() => clusters.slice(0, 5), [clusters]);
  const remainingClusters = useMemo(() => clusters.slice(5), [clusters]);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchClusters = useCallback(async () => {
    try {
      setLoadingClusters(true);
      setClusterError("");
      const response = await fetch(
        `/api/sessions/${sessionId}/misconceptions/aggregate`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | DashboardResponse
        | ApiError
        | null;

      if (!response.ok || !data || !("clusters" in data)) {
        throw new Error(
          (data && "error" in data && data.error) ||
            "Failed to load misconception analysis."
        );
      }

      setClusters(data.clusters);
      setStats(data.sessionStats);
      setOverrides(data.overrides);
    } catch (err) {
      setClusterError(
        err instanceof Error ? err.message : "Failed to load misconception analysis."
      );
    } finally {
      setLoadingClusters(false);
    }
  }, [sessionId]);

  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/recommendations`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | RecommendationsResponse
        | ApiError
        | null;

      if (!response.ok || !data || !("recommendations" in data)) return;

      setRecommendations(data.recommendations);
      setRecommendationMessage(data.message ?? "");
    } catch {
      // Recommendations are supplementary — swallow errors
    }
  }, [sessionId]);

  const fetchReport = useCallback(
    async (forceRefresh = false) => {
      (forceRefresh ? setIsRefreshing : setLoadingReport)(true);
      setReportError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/report`);
        if (!res.ok) throw new Error("Failed to generate or fetch report");
        const data = (await res.json()) as ReportData;
        setReport(data);
      } catch (err) {
        setReportError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoadingReport(false);
        setIsRefreshing(false);
      }
    },
    [sessionId]
  );

  // ── Initial load ──
  useEffect(() => {
    // Session purpose
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.sessionPurpose) setSessionPurpose(data.sessionPurpose);
      })
      .catch(() => {});

    // Clusters + recommendations + checkpoint difficulty (always load)
    fetchClusters();
    fetchRecommendations();

    fetch(`/api/sessions/${sessionId}/checkpoints/difficulty`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCheckpointDifficulty(data);
      })
      .catch(() => {});
  }, [fetchClusters, fetchRecommendations, sessionId]);

  // ── Load report when in brief view ──
  useEffect(() => {
    if (effectiveView === "brief" && !report && !loadingReport && !reportError) {
      fetchReport();
    }
  }, [effectiveView, report, loadingReport, reportError, fetchReport]);

  // ── Live polling for during-class ──
  useEffect(() => {
    if (effectiveView !== "live") return;
    const interval = window.setInterval(fetchClusters, 30000);
    return () => window.clearInterval(interval);
  }, [effectiveView, fetchClusters]);

  // ── Toast timeout ──
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function handleOverride(
    clusterLabel: string,
    overrideType: "acceptable_interpretation" | "needs_discussion"
  ) {
    try {
      setSubmittingOverride(clusterLabel);
      const response = await fetch(
        `/api/sessions/${sessionId}/misconceptions/override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clusterLabel, overrideType }),
        }
      );
      const data = (await response.json().catch(() => null)) as
        | { override?: MisconceptionOverrideRecord; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save override.");
      }

      setToast({
        tone: "success",
        message:
          overrideType === "acceptable_interpretation"
            ? "Marked as an acceptable interpretation."
            : "Marked for class discussion.",
      });
      await fetchClusters();
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to save override.",
      });
    } finally {
      setSubmittingOverride(null);
    }
  }

  async function handleGenerateRecommendations() {
    try {
      setLoadingRecommendations(true);
      const response = await fetch(
        `/api/sessions/${sessionId}/recommendations`,
        { method: "POST" }
      );
      const data = (await response.json().catch(() => null)) as
        | RecommendationsResponse
        | ApiError
        | null;

      if (!response.ok || !data || !("recommendations" in data)) {
        throw new Error(
          (data && "error" in data && data.error) || "Failed to generate recommendations."
        );
      }

      setRecommendations(data.recommendations);
      setRecommendationMessage(data.message ?? "");
      setExpandedRecommendationId(null);
      setToast({
        tone: "success",
        message:
          data.recommendations.length > 0
            ? "Teaching recommendations generated."
            : data.message || "No recommendations were generated.",
      });
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to generate recommendations.",
      });
    } finally {
      setLoadingRecommendations(false);
    }
  }

  async function handleRecommendationAction(
    recommendationId: string,
    action: "used" | "dismissed" | "edited",
    note?: string
  ) {
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/recommendations/${recommendationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instructorAction: action, instructorNote: note }),
        }
      );
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Failed to update recommendation.");

      await fetchRecommendations();
      setToast({
        tone: "success",
        message:
          action === "used"
            ? "Recommendation marked as used."
            : action === "dismissed"
              ? "Recommendation dismissed."
              : "Recommendation updated.",
      });
    } catch (err) {
      setToast({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to update recommendation.",
      });
    }
  }

  const handleExport = () => {
    window.location.href = `/api/sessions/${sessionId}/report/export`;
  };

  // ─── Report-derived data ────────────────────────────────────────────────────

  const sections = report ? parseReportSections(report.content) : null;
  const heatmapTitle = getHeatmapTitle(sessionPurpose) ?? "Readiness Heatmap";
  const purposeOption = getSessionPurposeOption(sessionPurpose);

  const loAssessmentsByStudent = useMemo(() => {
    if (!report?.loAssessments) return {};
    return report.loAssessments.reduce(
      (acc, assessment) => {
        const studentId = assessment.studentSession.id;
        const studentName = assessment.studentSession.studentName;
        const group = acc[studentId] ?? (acc[studentId] = { studentName, assessments: [] });
        group.assessments.push(assessment);
        return acc;
      },
      {} as Record<string, StudentLOAssessmentGroup>
    );
  }, [report?.loAssessments]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="minerva-page">
      <div className="minerva-shell space-y-6 py-8">
        {/* Toast */}
        {toast && (
          <div className="fixed right-5 top-5 z-50 max-w-sm">
            <div
              className={`rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                toast.tone === "success"
                  ? "border-[rgba(17,120,144,0.22)] bg-[rgba(255,255,255,0.94)] text-[var(--charcoal)]"
                  : "border-[rgba(223,47,38,0.28)] bg-[rgba(255,255,255,0.96)] text-[var(--signal)]"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="minerva-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                <Link href="/instructor" className="transition-colors hover:text-[var(--teal)]">
                  Sessions
                </Link>
                <span>/</span>
                <Link
                  href={`/instructor/${sessionId}`}
                  className="transition-colors hover:text-[var(--teal)]"
                >
                  Setup
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">Session analysis</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                Session analysis
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getSessionPurposeBadgeClasses(sessionPurpose)}`}
                >
                  {purposeOption.shortLabel}
                </span>
                <p className="text-[15px] leading-7 text-[var(--dim-grey)]">
                  {effectiveView === "live"
                    ? "Misconception patterns updating in real time."
                    : report
                      ? `Generated ${new Date(report.generatedAt).toLocaleString()}`
                      : "Misconception analysis and teaching recommendations."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/instructor/${sessionId}`}
                className="minerva-button minerva-button-secondary"
              >
                Back to setup
              </Link>

              {/* Mode toggle */}
              <button
                type="button"
                onClick={() => setViewMode(effectiveView === "live" ? "brief" : "live")}
                className="minerva-button minerva-button-secondary"
              >
                {effectiveView === "live" ? "View full brief" : "View live patterns"}
              </button>

              {effectiveView === "brief" && report && (
                <>
                  <button
                    onClick={() => fetchReport(true)}
                    className="minerva-button minerva-button-secondary"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Refreshing…" : "Refresh brief"}
                  </button>
                  <button onClick={handleExport} className="minerva-button">
                    Export PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* LIVE ANALYTICS LAYOUT                                               */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {effectiveView === "live" && (
          <>
            {/* Live indicator */}
            <div className="minerva-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-[var(--rule)] px-6 py-4 md:px-8">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--teal)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                  Live pattern detection · refreshes every 30 s
                </p>
              </div>

              <div className="px-6 py-5 md:px-8">
                {loadingClusters ? (
                  <LoadingState message="Loading misconception data…" />
                ) : clusterError ? (
                  <p className="text-sm text-[var(--signal)]">{clusterError}</p>
                ) : (
                  <>
                    {/* Stats row */}
                    {stats && (
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
                            {stats.totalStudents}
                          </p>
                          <p className="mt-1 text-xs text-[var(--dim-grey)]">learners</p>
                        </div>
                        <div>
                          <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
                            {clusters.length}
                          </p>
                          <p className="mt-1 text-xs text-[var(--dim-grey)]">
                            misconception pattern{clusters.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div>
                          <p className="text-[28px] font-bold leading-none text-[var(--charcoal)]">
                            {formatPercent(stats.overallResolutionRate)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--dim-grey)]">resolved</p>
                        </div>
                      </div>
                    )}

                    {/* Live cluster cards (top 5, compact) */}
                    {clusters.length === 0 ? (
                      <p className="mt-4 text-sm text-[var(--dim-grey)]">
                        No misconceptions logged yet. Patterns will appear as learners engage.
                      </p>
                    ) : (
                      <div className="mt-6 space-y-3">
                        {clusters.slice(0, 5).map((cluster) => (
                          <div
                            key={cluster.id}
                            className="flex flex-col gap-3 rounded-xl border border-[var(--rule)] bg-white p-4 md:flex-row md:items-start md:justify-between"
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTypeTone(cluster.misconceptionType)}`}
                                >
                                  {formatTypeLabel(cluster.misconceptionType)}
                                </span>
                                <span className="text-xs text-[var(--dim-grey)]">
                                  {cluster.studentCount} learner{cluster.studentCount !== 1 ? "s" : ""} ·{" "}
                                  {formatPercent(cluster.prevalence)} · severity{" "}
                                  <span className={`font-semibold ${getSeverityTone(cluster.severity)}`}>
                                    {cluster.severity}
                                  </span>
                                </span>
                                {cluster.overrideType === "needs_discussion" && (
                                  <span className="rounded-full bg-[rgba(223,47,38,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[var(--signal)]">
                                    For discussion
                                  </span>
                                )}
                                {cluster.overrideType === "acceptable_interpretation" && (
                                  <span className="rounded-full bg-[rgba(34,34,34,0.06)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim-grey)]">
                                    Acceptable
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-[var(--charcoal)]">
                                {cluster.label}
                              </p>
                            </div>
                            {!cluster.overrideType && (
                              <div className="flex flex-shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOverride(cluster.label, "acceptable_interpretation")}
                                  disabled={submittingOverride === cluster.label}
                                  className="minerva-button minerva-button-secondary text-xs"
                                  style={{ minHeight: "36px", padding: "0 14px" }}
                                >
                                  Acceptable
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverride(cluster.label, "needs_discussion")}
                                  disabled={submittingOverride === cluster.label}
                                  className="minerva-button text-xs"
                                  style={{ minHeight: "36px", padding: "0 14px" }}
                                >
                                  Discuss in class
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {clusters.length > 5 && (
                          <p className="text-xs text-[var(--dim-grey)]">
                            + {clusters.length - 5} more pattern{clusters.length - 5 !== 1 ? "s" : ""}. Switch
                            to the full brief to see all.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* COMPREHENSIVE BRIEF LAYOUT                                          */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        {effectiveView === "brief" && (
          <>
            {/* ── Report sections (async) ── */}
            {loadingReport ? (
              <div className="minerva-card p-8">
                <LoadingState message="Building instructor recommendations…" />
              </div>
            ) : reportError ? (
              <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-sm text-[var(--signal)]">
                {reportError}
              </div>
            ) : sections ? (
              <>
                {/* Session snapshot */}
                {sections.snapshot && (
                  <section className="minerva-card p-6 md:p-8">
                    <div className="prose prose-slate max-w-none text-sm text-[var(--charcoal)]">
                      <ReactMarkdown>{sections.snapshot}</ReactMarkdown>
                    </div>
                  </section>
                )}

                {/* What to do next — elevated */}
                {sections.what_to_do && (
                  <section className="minerva-card border-l-4 border-[var(--teal)] p-6 md:p-8">
                    <h2 className="font-serif text-[28px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                      What to do next
                    </h2>
                    <div className="prose prose-slate mt-4 max-w-none text-[var(--charcoal)]">
                      <ReactMarkdown>{sections.what_to_do}</ReactMarkdown>
                    </div>
                  </section>
                )}

                {/* Heatmap */}
                {report && (
                  <section className="minerva-card p-6 md:p-8">
                    <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                      {heatmapTitle}
                    </h2>
                    <div className="mt-6">
                      <ReadinessHeatmap reportContent={report.content} sessionPurpose={sessionPurpose} />
                    </div>
                  </section>
                )}

                {/* Gaps */}
                {sections.gaps && (
                  <section className="minerva-card p-6 md:p-8">
                    <div className="prose prose-slate max-w-none text-[var(--charcoal)]">
                      <ReactMarkdown>{sections.gaps}</ReactMarkdown>
                    </div>
                  </section>
                )}

                {/* Strengths */}
                {sections.strengths && (
                  <section className="minerva-card p-6 md:p-8">
                    <div className="prose prose-slate max-w-none text-[var(--charcoal)]">
                      <ReactMarkdown>{sections.strengths}</ReactMarkdown>
                    </div>
                  </section>
                )}
              </>
            ) : null}

            {/* ── Misconception clusters (always available) ── */}
            {loadingClusters ? (
              <div className="minerva-card p-8">
                <LoadingState message="Loading misconception data…" />
              </div>
            ) : clusterError ? (
              <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-sm text-[var(--signal)]">
                {clusterError}
              </div>
            ) : (
              <>
                {/* Stats row */}
                {stats && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="minerva-card p-5">
                      <p className="eyebrow eyebrow-teal">Session scale</p>
                      <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
                        {stats.totalStudents}
                      </p>
                      <p className="mt-1 text-sm text-[var(--dim-grey)]">
                        learners contributed to this analysis
                      </p>
                    </div>
                    <div className="minerva-card p-5">
                      <p className="eyebrow eyebrow-rose">Logged misconceptions</p>
                      <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
                        {stats.totalMisconceptions}
                      </p>
                      <p className="mt-1 text-sm text-[var(--dim-grey)]">
                        {stats.avgMisconceptionsPerStudent.toFixed(1)} per learner on average
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--dim-grey)]">
                        Individual instances (clustered into {clusters.length} patterns below)
                      </p>
                    </div>
                    <div className="minerva-card p-5">
                      <p className="eyebrow eyebrow-olive">Resolution rate</p>
                      <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
                        {formatPercent(stats.overallResolutionRate)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--dim-grey)]">
                        across the misconception patterns shown here
                      </p>
                    </div>
                  </div>
                )}

                {/* Question difficulty */}
                {checkpointDifficulty.length > 0 && (
                  <section className="minerva-card p-6 md:p-8">
                    <h2 className="font-serif text-[30px] leading-[1.02] tracking-[-0.03em] text-[var(--charcoal)]">
                      Question difficulty
                    </h2>
                    <p className="mt-2 max-w-[42rem] text-sm text-[var(--dim-grey)]">
                      How each question performed across the class. Hard questions may indicate content areas that need more support.
                    </p>
                    <div className="mt-6 space-y-3">
                      {checkpointDifficulty.map((checkpoint) => (
                        <div
                          key={checkpoint.checkpointId}
                          className="flex items-start gap-4 rounded-lg border border-[var(--rule)] p-4"
                        >
                          <div
                            className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ${
                              checkpoint.difficultySignal === "hard"
                                ? "bg-[var(--signal)]"
                                : checkpoint.difficultySignal === "moderate"
                                  ? "bg-[#906f12]"
                                  : checkpoint.difficultySignal === "easy"
                                    ? "bg-[var(--teal)]"
                                    : "bg-[var(--rule)]"
                            }`}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--charcoal)]">
                              {checkpoint.prompt}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[var(--dim-grey)]">
                              <span>
                                {checkpoint.addressedCount}/{checkpoint.totalStudents} attempted
                              </span>
                              <span>{checkpoint.masteredCount} mastered</span>
                              {checkpoint.strugglingCount > 0 && (
                                <span className="text-[var(--signal)]">
                                  {checkpoint.strugglingCount} struggling
                                </span>
                              )}
                              <span>Avg {checkpoint.averageTurnsSpent} turns</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Misconception cluster cards */}
                <div className="minerva-card p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                        Misconception patterns
                      </h2>
                      <p className="mt-2 max-w-[44rem] text-sm text-[var(--dim-grey)]">
                        Similar learner misunderstandings grouped so you can respond to themes instead of isolated quotes.
                      </p>
                    </div>
                    <p className="text-xs text-[var(--dim-grey)]">
                      {overrides.length} instructor override{overrides.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {topClusters.length === 0 ? (
                  <div className="minerva-card p-6 text-sm text-[var(--dim-grey)]">
                    No misconceptions have been logged for this session yet.
                  </div>
                ) : (
                  topClusters.map((cluster) => (
                    <div key={cluster.id} className="minerva-card p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${getTypeTone(cluster.misconceptionType)}`}
                            >
                              {formatTypeLabel(cluster.misconceptionType)}
                            </span>
                            {cluster.overrideType === "needs_discussion" && (
                              <span className="rounded-full bg-[rgba(223,47,38,0.08)] px-3 py-1 text-[12px] font-semibold text-[var(--signal)]">
                                Marked for class discussion
                              </span>
                            )}
                          </div>

                          <h3 className="mt-4 font-serif text-[30px] leading-[1.04] tracking-[-0.03em] text-[var(--charcoal)]">
                            {cluster.label}
                          </h3>

                          <p className="mt-3 text-sm text-[var(--dim-grey)]">
                            {cluster.studentCount} of {cluster.totalStudents} learners ·{" "}
                            {formatPercent(cluster.prevalence)} prevalence ·{" "}
                            {formatPercent(cluster.resolutionRate)} resolved during the session
                          </p>

                          <div className="mt-4 rounded-md bg-[rgba(34,34,34,0.03)] px-4 py-3 text-sm italic text-[var(--charcoal)]">
                            &ldquo;{cluster.representativeExcerpt}&rdquo;
                          </div>

                          {(cluster.passageAnchor || cluster.topicThread) && (
                            <p className="mt-3 text-xs text-[var(--dim-grey)]">
                              {cluster.passageAnchor
                                ? `Reading anchor: ${cluster.passageAnchor}`
                                : `Topic thread: ${cluster.topicThread}`}
                            </p>
                          )}
                        </div>

                        <div className="w-full space-y-4 lg:max-w-[16rem]">
                          <div className="rounded-md border border-[var(--rule)] px-4 py-3 text-sm">
                            <p className="text-[var(--dim-grey)]">Severity</p>
                            <p className={`mt-1 font-semibold ${getSeverityTone(cluster.severity)}`}>
                              {cluster.severity}
                            </p>
                            <p className="mt-3 text-[var(--dim-grey)]">Median turns to resolve</p>
                            <p className="mt-1 font-semibold text-[var(--charcoal)]">
                              {cluster.medianTurnsToResolve ?? "—"}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOverride(cluster.label, "acceptable_interpretation")
                              }
                              disabled={submittingOverride === cluster.label}
                              className="minerva-button minerva-button-secondary w-full"
                            >
                              Acceptable interpretation
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOverride(cluster.label, "needs_discussion")}
                              disabled={submittingOverride === cluster.label}
                              className="minerva-button w-full"
                            >
                              Needs class discussion
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedClusterId((current) =>
                                  current === cluster.id ? null : cluster.id
                                )
                              }
                              className="minerva-button minerva-button-secondary w-full"
                            >
                              {expandedClusterId === cluster.id ? "Hide details" : "Expand details"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandedClusterId === cluster.id && (
                        <div className="mt-6 border-t border-[var(--rule)] pt-5">
                          <p className="text-sm font-semibold text-[var(--charcoal)]">
                            Examples in this cluster
                          </p>
                          <ul className="mt-3 space-y-3 text-sm text-[var(--dim-grey)]">
                            {cluster.records.map((record) => (
                              <li
                                key={record.id}
                                className="rounded-md bg-[rgba(34,34,34,0.03)] px-4 py-3"
                              >
                                <p className="text-[var(--charcoal)]">
                                  &ldquo;{record.canonicalClaim || record.description}&rdquo;
                                </p>
                                {record.studentMessage && (
                                  <p className="mt-2 text-xs text-[var(--dim-grey)]">
                                    Learner&apos;s words: &ldquo;{record.studentMessage}&rdquo;
                                  </p>
                                )}
                                <p className="mt-2 text-xs text-[var(--dim-grey)]">
                                  {record.resolved ? "Resolved during session" : "Still unresolved"}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {remainingClusters.length > 0 && (
                  <div className="minerva-card p-6">
                    <button
                      type="button"
                      onClick={() => setShowAllClusters((current) => !current)}
                      className="minerva-button minerva-button-secondary"
                    >
                      {showAllClusters
                        ? "Hide remaining clusters"
                        : `Show all ${clusters.length} clusters`}
                    </button>

                    {showAllClusters && (
                      <div className="mt-5 space-y-3">
                        {remainingClusters.map((cluster) => (
                          <div
                            key={cluster.id}
                            className="rounded-lg border border-[var(--rule)] px-4 py-3"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="font-medium text-[var(--charcoal)]">{cluster.label}</p>
                                <p className="mt-1 text-sm text-[var(--dim-grey)]">
                                  {cluster.studentCount} learners · {formatPercent(cluster.prevalence)}{" "}
                                  prevalence
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${getTypeTone(cluster.misconceptionType)}`}
                              >
                                {formatTypeLabel(cluster.misconceptionType)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Teaching recommendations ── */}
                <div className="border-t border-[var(--rule)] pt-8">
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                        Teaching recommendations
                      </h2>
                      <p className="mt-2 max-w-[46rem] text-sm text-[var(--dim-grey)]">
                        Text-grounded active learning moves derived from the misconception patterns above.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[var(--dim-grey)]">
                        <input
                          type="checkbox"
                          checked={detailedView}
                          onChange={(event) => setDetailedView(event.target.checked)}
                          className="mr-2"
                        />
                        Detailed view
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRecommendations}
                        disabled={loadingRecommendations}
                        className="minerva-button"
                      >
                        {loadingRecommendations
                          ? "Generating…"
                          : recommendations.length > 0
                            ? "Regenerate"
                            : "Generate recommendations"}
                      </button>
                    </div>
                  </div>

                  {recommendations.length === 0 ? (
                    <div className="minerva-card p-6">
                      <p className="text-sm text-[var(--dim-grey)]">
                        {loadingRecommendations
                          ? "Analyzing misconceptions and drafting active learning moves…"
                          : recommendationMessage ||
                            "No teaching recommendations have been generated yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {recommendations.map((recommendation) => (
                        <div key={recommendation.id} className="minerva-card p-6">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-serif text-[30px] leading-[1.04] tracking-[-0.03em] text-[var(--charcoal)]">
                                {recommendation.whatToAddress}
                              </h3>
                              <p className="mt-2 text-sm italic text-[var(--dim-grey)]">
                                Why it matters: {recommendation.whyItMatters}
                              </p>
                            </div>
                            <div className="text-xs text-[var(--dim-grey)]">
                              Confidence{" "}
                              <span className="font-semibold text-[var(--charcoal)]">
                                {recommendation.confidence}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-md bg-[rgba(34,34,34,0.03)] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                              Evidence
                            </p>
                            <ul className="mt-3 space-y-2 text-sm text-[var(--charcoal)]">
                              {recommendation.evidence.map((item, index) => (
                                <li key={`${recommendation.id}-evidence-${index}`}>• {item}</li>
                              ))}
                            </ul>
                          </div>

                          {detailedView && (
                            <div className="mt-5">
                              <div className="flex flex-wrap gap-2 border-b border-[var(--rule)] pb-3">
                                {[
                                  { key: "fiveMin", label: "5 min" },
                                  { key: "fifteenMin", label: "15 min" },
                                  { key: "thirtyMin", label: "30 min" },
                                ].map(({ key, label }) => {
                                  const tabId = `${recommendation.id}-${key}`;
                                  return (
                                    <button
                                      key={tabId}
                                      type="button"
                                      onClick={() =>
                                        setExpandedRecommendationId((current) =>
                                          current === tabId ? null : tabId
                                        )
                                      }
                                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                                        expandedRecommendationId === tabId
                                          ? "bg-[var(--teal)] text-white"
                                          : "bg-[rgba(34,34,34,0.05)] text-[var(--dim-grey)]"
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>

                              {[
                                { key: "fiveMin", title: "5-minute move", move: recommendation.moves.fiveMin },
                                { key: "fifteenMin", title: "15-minute move", move: recommendation.moves.fifteenMin },
                                { key: "thirtyMin", title: "30-minute move", move: recommendation.moves.thirtyMin },
                              ].map(({ key, title, move }) => {
                                const tabId = `${recommendation.id}-${key}`;
                                if (expandedRecommendationId !== tabId) return null;
                                return (
                                  <div key={tabId} className="mt-4 rounded-lg border border-[var(--rule)] px-4 py-4">
                                    <p className="text-sm font-semibold text-[var(--charcoal)]">{title}</p>
                                    <p className="mt-2 text-sm text-[var(--charcoal)]">{move.description}</p>
                                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                                      Facilitation script
                                    </p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--dim-grey)]">
                                      {move.script}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="mt-5 border-t border-[var(--rule)] pt-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <p className="text-xs text-[var(--dim-grey)]">
                                Source clusters: {recommendation.sourceClusters.join(", ")}
                              </p>
                              {!recommendation.instructorAction ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecommendationAction(recommendation.id, "used")
                                    }
                                    className="minerva-button"
                                  >
                                    Use this
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const note =
                                        typeof window !== "undefined"
                                          ? window.prompt("Optional note:")
                                          : "";
                                      void handleRecommendationAction(
                                        recommendation.id,
                                        "dismissed",
                                        note || undefined
                                      );
                                    }}
                                    className="minerva-button minerva-button-secondary"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              ) : (
                                <div className="rounded-full bg-[rgba(34,34,34,0.05)] px-3 py-1 text-sm text-[var(--charcoal)]">
                                  {recommendation.instructorAction === "used" && "Used"}
                                  {recommendation.instructorAction === "dismissed" && "Dismissed"}
                                  {recommendation.instructorAction === "edited" && "Edited"}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Per-student notes + LO assessments (from report) ── */}
            {sections?.per_student && (
              <section className="minerva-card p-6 md:p-8">
                <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                  Per-student notes
                </h2>
                <div className="prose prose-slate mt-4 max-w-none text-[var(--charcoal)]">
                  <ReactMarkdown>{sections.per_student}</ReactMarkdown>
                </div>
              </section>
            )}

            {sections?.remainder && (
              <section className="minerva-card p-8 md:p-12">
                <div className="prose prose-slate max-w-none text-[var(--charcoal)]">
                  <ReactMarkdown>{sections.remainder}</ReactMarkdown>
                </div>
              </section>
            )}

            {Object.keys(loAssessmentsByStudent).length > 0 && (
              <section className="minerva-card p-8 md:p-12">
                <h3 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                  Learning outcome review
                </h3>
                <p className="mt-3 max-w-[44rem] text-sm text-[var(--dim-grey)]">
                  These assessments are formative and AI-generated. They reflect observed engagement during the
                  tutoring session and should be reviewed by the instructor before informing any grading decisions.
                </p>
                <div className="mt-8 space-y-8">
                  {Object.entries(loAssessmentsByStudent).map(([studentId, group]) => (
                    <div key={studentId} className="space-y-3">
                      <h4 className="text-base font-semibold text-[var(--charcoal)]">
                        {group.studentName}
                      </h4>
                      <div className="space-y-3">
                        {(group.assessments ?? []).map((assessment) => (
                          <LOAssessmentCard key={assessment.id} assessment={assessment} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
