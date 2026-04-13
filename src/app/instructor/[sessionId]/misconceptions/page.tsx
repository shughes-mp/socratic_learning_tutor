"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  ApiError,
  MisconceptionClusterRecord,
  MisconceptionDashboardStats,
  MisconceptionOverrideRecord,
} from "@/types";

type DashboardResponse = {
  clusters: MisconceptionClusterRecord[];
  overrides: MisconceptionOverrideRecord[];
  sessionStats: MisconceptionDashboardStats;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatTypeLabel(value: string | null) {
  switch (value) {
    case "misread":
      return "Misread the text";
    case "missing_warrant":
      return "Missed the author’s support";
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

export default function MisconceptionDashboardPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [mode, setMode] = useState<"post-session" | "live">("post-session");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clusters, setClusters] = useState<MisconceptionClusterRecord[]>([]);
  const [stats, setStats] = useState<MisconceptionDashboardStats | null>(null);
  const [overrides, setOverrides] = useState<MisconceptionOverrideRecord[]>([]);
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [showAllClusters, setShowAllClusters] = useState(false);
  const [submittingOverride, setSubmittingOverride] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/sessions/${sessionId}/misconceptions/aggregate`
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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load misconception analysis."
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (mode !== "live") {
      return;
    }

    const interval = window.setInterval(fetchDashboard, 30000);
    return () => window.clearInterval(interval);
  }, [fetchDashboard, mode]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const topClusters = useMemo(() => clusters.slice(0, 5), [clusters]);
  const remainingClusters = useMemo(() => clusters.slice(5), [clusters]);

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
          headers: {
            "Content-Type": "application/json",
          },
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

      await fetchDashboard();
    } catch (err) {
      setToast({
        tone: "error",
        message:
          err instanceof Error ? err.message : "Failed to save override.",
      });
    } finally {
      setSubmittingOverride(null);
    }
  }

  return (
    <main className="minerva-page">
      <div className="minerva-shell space-y-6 py-8">
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

        <div className="minerva-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                <Link href="/instructor" className="hover:text-[var(--teal)] transition-colors">
                  Sessions
                </Link>
                <span>/</span>
                <Link
                  href={`/instructor/${sessionId}`}
                  className="hover:text-[var(--teal)] transition-colors"
                >
                  Session workspace
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">Misconceptions</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                Misconception analysis
              </h1>
              <p className="mt-3 max-w-[42rem] text-[15px] leading-7 text-[var(--dim-grey)]">
                Review the patterns students struggled with most, decide which
                ones need class discussion, and filter out interpretations you
                consider acceptable.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("post-session")}
                className={`minerva-button ${
                  mode === "post-session" ? "" : "minerva-button-secondary"
                }`}
              >
                Post-session summary
              </button>
              <button
                type="button"
                onClick={() => setMode("live")}
                className={`minerva-button ${
                  mode === "live" ? "" : "minerva-button-secondary"
                }`}
              >
                Live view
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="minerva-card p-8 text-sm text-[var(--dim-grey)]">
            Loading misconception data...
          </div>
        ) : error ? (
          <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-sm text-[var(--signal)]">
            {error}
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="minerva-card p-5">
                  <p className="eyebrow eyebrow-teal">Session scale</p>
                  <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
                    {stats.totalStudents}
                  </p>
                  <p className="mt-1 text-sm text-[var(--dim-grey)]">
                    students contributed to this analysis
                  </p>
                </div>
                <div className="minerva-card p-5">
                  <p className="eyebrow eyebrow-rose">Logged misconceptions</p>
                  <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
                    {stats.totalMisconceptions}
                  </p>
                  <p className="mt-1 text-sm text-[var(--dim-grey)]">
                    {stats.avgMisconceptionsPerStudent.toFixed(1)} per student on average
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

            {mode === "live" ? (
              <div className="space-y-4">
                <div className="minerva-card p-5">
                  <p className="text-sm text-[var(--dim-grey)]">
                    Live view refreshes every 30 seconds and highlights the
                    highest-prevalence patterns first.
                  </p>
                </div>

                {clusters.slice(0, 3).map((cluster) => (
                  <div key={cluster.id} className="minerva-card p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${getTypeTone(cluster.misconceptionType)}`}
                          >
                            {formatTypeLabel(cluster.misconceptionType)}
                          </span>
                          {cluster.overrideType === "needs_discussion" && (
                            <span className="rounded-full bg-[rgba(223,47,38,0.08)] px-3 py-1 text-[12px] font-semibold text-[var(--signal)]">
                              Marked for discussion
                            </span>
                          )}
                        </div>
                        <h2 className="font-serif text-[30px] leading-[1.02] tracking-[-0.03em] text-[var(--charcoal)]">
                          {cluster.label}
                        </h2>
                        <p className="text-sm text-[var(--dim-grey)]">
                          {cluster.studentCount} students · {formatPercent(cluster.prevalence)} prevalence
                        </p>
                      </div>

                      <div className="text-sm text-[var(--dim-grey)]">
                        Severity{" "}
                        <span className={`font-semibold ${getSeverityTone(cluster.severity)}`}>
                          {cluster.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="minerva-card p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
                        Top misconception clusters
                      </h2>
                      <p className="mt-2 max-w-[44rem] text-sm text-[var(--dim-grey)]">
                        These patterns combine similar student misunderstandings
                        so you can respond to themes instead of isolated quotes.
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
                            {cluster.studentCount} of {cluster.totalStudents} students ·{" "}
                            {formatPercent(cluster.prevalence)} prevalence ·{" "}
                            {formatPercent(cluster.resolutionRate)} resolved during the
                            session
                          </p>

                          <div className="mt-4 rounded-md bg-[rgba(34,34,34,0.03)] px-4 py-3 text-sm italic text-[var(--charcoal)]">
                            “{cluster.representativeExcerpt}”
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
                            <p className="mt-3 text-[var(--dim-grey)]">
                              Estimated median turns to resolve
                            </p>
                            <p className="mt-1 font-semibold text-[var(--charcoal)]">
                              {cluster.medianTurnsToResolve}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOverride(
                                  cluster.label,
                                  "acceptable_interpretation"
                                )
                              }
                              disabled={submittingOverride === cluster.label}
                              className="minerva-button minerva-button-secondary w-full"
                            >
                              Acceptable interpretation
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleOverride(cluster.label, "needs_discussion")
                              }
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
                              {expandedClusterId === cluster.id
                                ? "Hide details"
                                : "Expand details"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandedClusterId === cluster.id && (
                        <div className="mt-6 border-t border-[var(--rule)] pt-5">
                          <p className="text-sm font-semibold text-[var(--charcoal)]">
                            Misconception records in this cluster
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-[var(--dim-grey)]">
                            {cluster.misconceptionIds.map((id) => (
                              <li key={id}>{id}</li>
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
                                <p className="font-medium text-[var(--charcoal)]">
                                  {cluster.label}
                                </p>
                                <p className="mt-1 text-sm text-[var(--dim-grey)]">
                                  {cluster.studentCount} students ·{" "}
                                  {formatPercent(cluster.prevalence)} prevalence
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
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
