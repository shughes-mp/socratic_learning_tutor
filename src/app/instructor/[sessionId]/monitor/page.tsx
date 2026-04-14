"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ExchangeReplay } from "@/components/instructor/exchange-replay";
import type { ConfidenceCheck, Message, Misconception } from "@prisma/client";

interface StudentSummary {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messageCount: number;
  misconceptionCount: number;
  lastActiveAt: string | Date;
  latestEngagementFlag: string | null;
  hasRecentEngagementConcern: boolean;
  isWaitingForStudentReply: boolean;
  secondsSinceLastMessage: number | null;
}

interface StudentSessionData {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messages: Array<Message & { createdAt: string | Date; hidden?: boolean }>;
  misconceptions: Misconception[];
  confidenceChecks: ConfidenceCheck[];
  topicMastery: Array<{
    id: string;
    topicThread: string;
    status: string;
    criteriamet: string;
    hintLadderRung: number;
  }>;
}

export default function StudentMonitorPage() {
  const params = useParams() as { sessionId: string };
  const [mode, setMode] = useState<"snapshot" | "live">("snapshot");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<StudentSessionData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${params.sessionId}/students/summary`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStudents(data);
      }
    } catch (err) {
      console.error("Failed to fetch learner progress:", err);
    } finally {
      setIsLoading(false);
    }
  }, [params.sessionId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (mode !== "live") return;
    const interval = window.setInterval(fetchStudents, 15000);
    return () => window.clearInterval(interval);
  }, [fetchStudents, mode]);

  const toggleStudent = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }

    setExpandedId(id);
    setExpandedDetail(null);
    setLoadingDetail(true);

    try {
      const res = await fetch(
        `/api/sessions/${params.sessionId}/students?studentSessionId=${id}`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setExpandedDetail(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch learner detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (isLoading) {
    return (
      <main className="minerva-page">
        <div className="minerva-shell">
          <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="px-4 py-16 text-[var(--dim-grey)] md:px-8 md:py-20">
              Loading learner progress...
            </div>
          </section>
        </div>
      </main>
    );
  }

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
                <span className="text-[var(--charcoal)]">Learner progress</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                Learner progress
              </h1>
              <p className="mt-3 max-w-[42rem] text-[15px] leading-7 text-[var(--dim-grey)]">
                Review who joined the session, how far each learner got, and the
                interaction trace behind that progress.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/instructor/${params.sessionId}`}
                className="minerva-button minerva-button-secondary"
              >
                Back to session workspace
              </Link>
              <button
                type="button"
                onClick={() => setMode("snapshot")}
                className={`minerva-button ${
                  mode === "snapshot" ? "" : "minerva-button-secondary"
                }`}
              >
                Snapshot
              </button>
              <button
                type="button"
                onClick={() => setMode("live")}
                className={`minerva-button ${
                  mode === "live" ? "" : "minerva-button-secondary"
                }`}
              >
                Live monitoring
              </button>
            </div>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="minerva-card p-8">
            <h2 className="font-serif text-[30px] leading-[1.02] tracking-[-0.03em] text-[var(--charcoal)]">
              No learner activity yet
            </h2>
            <p className="mt-3 max-w-[34rem] text-sm text-[var(--dim-grey)]">
              When learners join with the session link, their progress and
              interaction traces will appear here.
            </p>
          </div>
        ) : (
          <>
            {mode === "live" &&
              students.length > 0 &&
              (() => {
                const concernCount = students.filter(
                  (student) => student.hasRecentEngagementConcern
                ).length;
                const waitingLong = students.filter(
                  (student) =>
                    student.isWaitingForStudentReply &&
                    (student.secondsSinceLastMessage ?? 0) > 180
                ).length;

                if (concernCount === 0 && waitingLong === 0) {
                  return (
                    <div className="minerva-card flex items-center gap-3 p-4">
                      <span className="h-3 w-3 rounded-full bg-[var(--teal)]" />
                      <p className="text-sm text-[var(--charcoal)]">
                        All learners are on task
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="minerva-card flex items-center gap-3 border-l-4 border-[#906f12] p-4">
                    <p className="text-sm text-[var(--charcoal)]">
                      {concernCount > 0 && (
                        <span className="font-medium text-[#906f12]">
                          {concernCount} learner{concernCount !== 1 ? "s" : ""} showing
                          engagement concerns.{" "}
                        </span>
                      )}
                      {waitingLong > 0 && (
                        <span className="font-medium text-[var(--dim-grey)]">
                          {waitingLong} waiting 3+ minutes for a reply.
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}

            <div className="minerva-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--dim-grey)]">
                <thead className="border-b border-[var(--rule)] bg-[rgba(34,34,34,0.02)]">
                  <tr>
                    <th className="px-6 py-4">Learner</th>
                    <th className="px-6 py-4">Exchanges</th>
                    <th className="px-6 py-4">Misconceptions detected</th>
                    <th className="px-6 py-4">Engagement</th>
                    <th className="px-6 py-4">Last active</th>
                    <th className="px-6 py-4 text-right">Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {students.map((student) => {
                    const exchanges = Math.floor(student.messageCount / 2);
                    const isExpanded = expandedId === student.id;
                    const lastActive = student.lastActiveAt;

                    return (
                      <React.Fragment key={student.id}>
                        <tr
                          className={`transition-colors hover:bg-[rgba(34,34,34,0.02)] ${
                            isExpanded ? "bg-[rgba(17,120,144,0.05)]" : ""
                          }`}
                        >
                          <td className="px-6 py-4 font-medium text-[var(--charcoal)]">
                            {student.studentName}
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-md bg-[rgba(34,34,34,0.05)] px-2.5 py-1 font-medium text-[var(--charcoal)]">
                              {exchanges}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {student.misconceptionCount > 0 ? (
                              <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(223,47,38,0.08)] px-2.5 py-1 font-medium text-[var(--signal)]">
                                <span className="h-2 w-2 rounded-full bg-[var(--signal)]" />
                                {student.misconceptionCount}
                              </span>
                            ) : (
                              <span className="text-[var(--dim-grey)]">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {student.hasRecentEngagementConcern ? (
                              <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(144,111,18,0.10)] px-2.5 py-1 text-xs font-medium text-[#906f12]">
                                <span className="h-2 w-2 rounded-full bg-[#906f12]" />
                                {student.latestEngagementFlag === "disengaged"
                                  ? "Disengaged"
                                  : student.latestEngagementFlag === "shallow"
                                    ? "Low effort"
                                    : student.latestEngagementFlag === "off_topic"
                                      ? "Off topic"
                                      : student.latestEngagementFlag === "hostile"
                                        ? "Hostile"
                                        : "Needs attention"}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--teal)]">On task</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-[var(--dim-grey)]">
                            <div className="flex flex-col">
                              <span>
                                {new Date(lastActive).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {student.isWaitingForStudentReply &&
                                student.secondsSinceLastMessage !== null &&
                                student.secondsSinceLastMessage > 180 && (
                                  <span className="mt-0.5 text-[10px] font-medium text-[#906f12]">
                                    Waiting {Math.floor(student.secondsSinceLastMessage / 60)}m
                                    {" "}for reply
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => toggleStudent(student.id)}
                              className="text-sm font-medium text-[var(--teal)] transition-colors hover:text-[var(--charcoal)]"
                            >
                              {isExpanded ? "Hide trace" : "View trace"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td
                              colSpan={6}
                              className="border-t border-[var(--rule)] bg-[rgba(34,34,34,0.02)] p-0"
                            >
                              <div className="mx-6 my-5 max-w-4xl border-l-2 border-[var(--teal)] bg-white p-8">
                                <h4 className="eyebrow eyebrow-teal mb-6">Interaction Trace</h4>
                                {loadingDetail ? (
                                  <div className="flex items-center gap-2 py-4 text-sm text-[var(--dim-grey)]">
                                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[var(--teal)]" />
                                    Loading trace...
                                  </div>
                                ) : expandedDetail?.id === student.id ? (
                                  <>
                                    {expandedDetail.topicMastery.length > 0 && (
                                      <div className="mb-4 rounded-lg border border-[var(--rule)] bg-[rgba(34,34,34,0.02)] p-4">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--dim-grey)]">
                                          Topic mastery
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {expandedDetail.topicMastery.map((topicMastery) => (
                                            <span
                                              key={topicMastery.id}
                                              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                                                topicMastery.status === "mastered"
                                                  ? "bg-[rgba(17,120,144,0.10)] text-[var(--teal)]"
                                                  : topicMastery.status === "direct_answer_given"
                                                    ? "bg-[rgba(144,111,18,0.10)] text-[#906f12]"
                                                    : topicMastery.status === "in_progress"
                                                      ? "bg-[rgba(34,34,34,0.06)] text-[var(--charcoal)]"
                                                      : "bg-[rgba(223,47,38,0.08)] text-[var(--signal)]"
                                              }`}
                                            >
                                              {topicMastery.topicThread}:{" "}
                                              {topicMastery.status.replace(/_/g, " ")}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <ExchangeReplay
                                      messages={expandedDetail.messages}
                                      misconceptions={expandedDetail.misconceptions}
                                      confidenceChecks={expandedDetail.confidenceChecks}
                                    />
                                  </>
                                ) : (
                                  <p className="text-sm text-[var(--dim-grey)]">
                                    Failed to load trace.
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
