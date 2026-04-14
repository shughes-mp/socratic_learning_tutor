"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ReadinessHeatmap } from "@/components/instructor/readiness-heatmap";
import { LOAssessmentCard } from "@/components/LOAssessmentCard";
import type { LOAssessmentRecord } from "@/types";

interface ReportData {
  id: string;
  sessionId: string;
  content: string;
  stats: string;
  generatedAt: string;
  loAssessments?: Array<
    LOAssessmentRecord & {
      studentSession: {
        id: string;
        studentName: string;
      };
    }
  >;
}

interface ReportStats {
  studentsCount: number;
  exchanges: number;
  misconceptions: number;
  directAnswers: number;
}

type ReportLOAssessment = NonNullable<ReportData["loAssessments"]>[number];

interface StudentLOAssessmentGroup {
  studentName: string;
  assessments: ReportLOAssessment[];
}

export default function ReportPage() {
  const params = useParams() as { sessionId: string };
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (forceRefresh = false) => {
    (forceRefresh ? setIsRefreshing : setIsLoading)(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${params.sessionId}/report`);
      if (!res.ok) {
        throw new Error("Failed to generate or fetch report");
      }
      const data = (await res.json()) as ReportData;
      setReport(data);
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
              Building teaching brief...
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
          <Link
            href={`/instructor/${params.sessionId}`}
            className="minerva-button minerva-button-secondary w-max"
          >
            Back to session workspace
          </Link>
        </div>
      </main>
    );
  }

  if (!report) return null;

  const stats = JSON.parse(report.stats) as ReportStats;
  const loAssessmentsByStudent = (report.loAssessments ?? []).reduce(
    (acc, assessment) => {
      const studentId = assessment.studentSession.id;
      const studentName = assessment.studentSession.studentName;

      const group =
        acc[studentId] ??
        (acc[studentId] = {
          studentName,
          assessments: [],
        });

      group.assessments.push(assessment);
      return acc;
    },
    {} as Record<string, StudentLOAssessmentGroup>
  );

  return (
    <main className="minerva-page">
      <div className="minerva-shell space-y-6 py-8">
        <div className="minerva-card p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
                <Link href="/instructor" className="transition-colors hover:text-[var(--teal)]">
                  Sessions
                </Link>
                <span>/</span>
                <Link
                  href={`/instructor/${params.sessionId}`}
                  className="transition-colors hover:text-[var(--teal)]"
                >
                  Session workspace
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">Teaching brief</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                Teaching brief
              </h1>
              <p className="mt-3 text-sm text-[var(--dim-grey)]">
                Generated {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/instructor/${params.sessionId}`}
                className="minerva-button minerva-button-secondary"
              >
                Back to session workspace
              </Link>
              <button
                onClick={() => fetchReport(true)}
                className="minerva-button minerva-button-secondary"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh brief"}
              </button>
              <button onClick={handleExport} className="minerva-button">
                Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="minerva-card p-5">
            <p className="eyebrow eyebrow-teal">Learners</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
              {stats.studentsCount}
            </p>
          </div>
          <div className="minerva-card p-5">
            <p className="eyebrow eyebrow-olive">Total Exchanges</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
              {stats.exchanges}
            </p>
          </div>
          <div className="minerva-card p-5">
            <p className="eyebrow eyebrow-rose">Common misunderstandings</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
              {stats.misconceptions}
            </p>
          </div>
          <div className="minerva-card p-5">
            <p className="eyebrow eyebrow-teal">Hints needed</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--charcoal)]">
              {stats.directAnswers}
            </p>
            <p className="mt-1 text-[11px] text-[var(--dim-grey)]">
              Times the tutor gave a direct answer
            </p>
          </div>
        </div>

        <section className="minerva-card p-6 md:p-8">
          <h2 className="font-serif text-[34px] leading-[1] tracking-[-0.03em] text-[var(--charcoal)]">
            Class readiness heatmap
          </h2>
          <div className="mt-6">
            <ReadinessHeatmap reportContent={report.content} />
          </div>
        </section>

        <section className="minerva-card p-8 md:p-12">
          <div className="prose prose-slate max-w-none text-[var(--charcoal)]">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </section>

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
                  <div>
                    <h4 className="text-base font-semibold text-[var(--charcoal)]">
                      {group.studentName}
                    </h4>
                  </div>
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
