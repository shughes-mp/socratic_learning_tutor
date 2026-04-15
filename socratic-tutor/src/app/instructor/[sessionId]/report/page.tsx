"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ReadinessHeatmap } from "@/components/instructor/readiness-heatmap";
import { LOAssessmentCard } from "@/components/LOAssessmentCard";
import { getSessionPurposeBadgeClasses, getSessionPurposeOption, getHeatmapTitle } from "@/lib/session-purpose";
import type { LOAssessmentRecord } from "@/types";

interface ReportData {
  id: string;
  sessionId: string;
  content: string;
  stats: string;
  generatedAt: string;
  sessionPurpose?: string;
  loAssessments?: Array<
    LOAssessmentRecord & {
      studentSession: {
        id: string;
        studentName: string;
      };
    }
  >;
}

type ReportLOAssessment = NonNullable<ReportData["loAssessments"]>[number];

interface StudentLOAssessmentGroup {
  studentName: string;
  assessments: ReportLOAssessment[];
}

// ─── Section parser ────────────────────────────────────────────────────────────
// Splits report markdown by known section headers and returns them keyed by a
// normalised label. We render them in the new priority order:
// snapshot → what_to_do → heatmap → gaps → strengths → per_student → (rest)

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

  // Build a list of all section markers with their positions
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
        break; // first pattern that matches wins
      }
    }
  }

  if (markers.length === 0) {
    result.remainder = content;
    return result;
  }

  markers.sort((a, b) => a.index - b.index);

  // Extract each section's content
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const sectionStart = content.indexOf("\n", current.index) + 1;
    const sectionEnd = next ? next.index : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd).trim();
    (result as Record<string, string>)[current.key] = sectionContent;
  }

  // Anything before the first marker is preamble
  if (markers[0].index > 0) {
    result.remainder = content.slice(0, markers[0].index).trim();
  }

  return result;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const params = useParams() as { sessionId: string };
  const [report, setReport] = useState<ReportData | null>(null);
  const [sessionPurpose, setSessionPurpose] = useState<string>("pre_class");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (forceRefresh = false) => {
    (forceRefresh ? setIsRefreshing : setIsLoading)(true);
    setError(null);
    try {
      const [reportRes, sessionRes] = await Promise.all([
        fetch(`/api/sessions/${params.sessionId}/report`),
        fetch(`/api/sessions/${params.sessionId}`),
      ]);

      if (!reportRes.ok) throw new Error("Failed to generate or fetch report");
      const data = (await reportRes.json()) as ReportData;
      setReport(data);

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setSessionPurpose(sessionData.sessionPurpose ?? "pre_class");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId]);

  const handleExport = async () => {
    window.location.href = `/api/sessions/${params.sessionId}/report/export`;
  };

  if (isLoading) {
    return (
      <main className="minerva-page">
        <div className="minerva-shell">
          <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="px-4 py-16 text-[var(--dim-grey)] md:px-8 md:py-20">
              Building teaching brief…
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="minerva-page">
        <div className="minerva-shell space-y-6 py-8">
          <div className="border border-[rgba(223,47,38,0.24)] bg-[rgba(223,47,38,0.08)] px-4 py-3 text-sm text-[var(--signal)]">
            {error}
          </div>
          <Link href={`/instructor/${params.sessionId}`} className="minerva-button minerva-button-secondary w-max">
            Back to session workspace
          </Link>
        </div>
      </main>
    );
  }

  if (!report) return null;

  const purposeOption = getSessionPurposeOption(sessionPurpose);
  const heatmapTitle = getHeatmapTitle(sessionPurpose) ?? "Readiness Heatmap";
  const sections = parseReportSections(report.content);

  const loAssessmentsByStudent = (report.loAssessments ?? []).reduce(
    (acc, assessment) => {
      const studentId = assessment.studentSession.id;
      const studentName = assessment.studentSession.studentName;
      const group = acc[studentId] ?? (acc[studentId] = { studentName, assessments: [] });
      group.assessments.push(assessment);
      return acc;
    },
    {} as Record<string, StudentLOAssessmentGroup>
  );

  return (
    <main className="minerva-page">
      <div className="minerva-shell space-y-6 py-8">
        {/* Header */}
        <div className="minerva-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                <Link href="/instructor" className="transition-colors hover:text-[var(--teal)]">
                  Sessions
                </Link>
                <span>/</span>
                <Link href={`/instructor/${params.sessionId}`} className="transition-colors hover:text-[var(--teal)]">
                  Session workspace
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">Teaching brief</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching brief
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getSessionPurposeBadgeClasses(sessionPurpose)}`}
                >
                  {purposeOption.shortLabel}
                </span>
                <p className="text-sm text-[var(--dim-grey)]">
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/instructor/${params.sessionId}`} className="minerva-button minerva-button-secondary">
                Back to workspace
              </Link>
              <button onClick={() => fetchReport(true)} className="minerva-button minerva-button-secondary" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing…" : "Refresh brief"}
              </button>
              <button onClick={handleExport} className="minerva-button">
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* Session snapshot */}
        {sections.snapshot && (
          <section className="minerva-card p-6 md:p-8">
            <div className="prose prose-slate max-w-none text-sm text-[var(--charcoal)]">
              <ReactMarkdown>{sections.snapshot}</ReactMarkdown>
            </div>
          </section>
        )}

        {/* What to do next — ELEVATED to top */}
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
        <section className="minerva-card p-6 md:p-8">
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            {heatmapTitle}
          </h2>
          <div className="mt-6">
            <ReadinessHeatmap reportContent={report.content} sessionPurpose={sessionPurpose} />
          </div>
        </section>

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

        {/* Per-student */}
        {sections.per_student && (
          <section className="minerva-card p-6 md:p-8">
            <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Per-student notes
            </h2>
            <div className="prose prose-slate mt-4 max-w-none text-[var(--charcoal)]">
              <ReactMarkdown>{sections.per_student}</ReactMarkdown>
            </div>
          </section>
        )}

        {/* Any remainder not captured by section parser */}
        {sections.remainder && (
          <section className="minerva-card p-8 md:p-12">
            <div className="prose prose-slate max-w-none text-[var(--charcoal)]">
              <ReactMarkdown>{sections.remainder}</ReactMarkdown>
            </div>
          </section>
        )}

        {/* Learning outcome review */}
        {Object.keys(loAssessmentsByStudent).length > 0 && (
          <section className="minerva-card p-8 md:p-12">
            <h3 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
              Learning outcome review
            </h3>
            <p className="mt-3 max-w-[44rem] text-sm text-[var(--dim-grey)]">
              These assessments are formative and AI-generated. They reflect observed engagement during the tutoring
              session and should be reviewed by the instructor before informing any grading decisions.
            </p>
            <div className="mt-8 space-y-8">
              {Object.entries(loAssessmentsByStudent).map(([studentId, group]) => (
                <div key={studentId} className="space-y-3">
                  <h4 className="text-base font-semibold text-[var(--charcoal)]">{group.studentName}</h4>
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
      </div>
    </main>
  );
}
