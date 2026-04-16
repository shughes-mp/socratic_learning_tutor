"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ExchangeReplay } from "@/components/instructor/exchange-replay";
import { LoadingState } from "@/components/ui/loading-state";
import { getSessionPurposeBadgeClasses, getSessionPurposeOption } from "@/lib/session-purpose";
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
  latestRubricScore?: string | null;
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
  const [sessionPurpose, setSessionPurpose] = useState<string>("pre_class");

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${params.sessionId}/students/summary`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStudents(data);
      }
    } catch (err) {
      console.error("Failed to fetch student progress:", err);
    } finally {
      setIsLoading(false);
    }
  }, [params.sessionId]);

  useEffect(() => {
    fetchStudents();
    fetch(`/api/sessions/${params.sessionId}`)
      .then((res) => res.json())
      .then((data) => { if (data?.sessionPurpose) setSessionPurpose(data.sessionPurpose); })
      .catch(() => {});
  }, [fetchStudents, params.sessionId]);

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
      console.error("Failed to fetch student detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (isLoading) {
    return <LoadingState variant="page" message="Loading learner progress…" />;
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
                  Setup
                </Link>
                <span>/</span>
                <span className="text-[var(--charcoal)]">Learner progress</span>
              </nav>
              <h1 className="mt-4 font-serif text-[42px] leading-[0.96] tracking-[-0.03em] text-[var(--charcoal)]">
                Learner progress
              </h1>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getSessionPurposeBadgeClasses(sessionPurpose)}`}
                >
                  {getSessionPurposeOption(sessionPurpose).shortLabel}
                </span>
                <p className="text-[15px] leading-7 text-[var(--dim-grey)]">
                  See who joined, how far each learner got, and the conversation behind their progress.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/instructor/${params.sessionId}`}
                className="minerva-button minerva-button-secondary"
              >
                Back to setup
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
                Real-time monitoring
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
              conversations will appear here.
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
                    <th className="px-6 py-4">Action Flags</th>
                    <th className="px-6 py-4">Rubric projection</th>
                    <th className="px-6 py-4">Misconceptions</th>
                    <th className="px-6 py-4">Last active</th>
                    <th className="px-6 py-4 text-right">Conversation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {students.map((student) => {
                    const turns = Math.floor(student.messageCount / 2);
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
                            <div className="flex flex-col gap-1.5 items-start">
                              {student.isWaitingForStudentReply &&
                              student.secondsSinceLastMessage !== null &&
                              student.secondsSinceLastMessage > 180 ? (
                                <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(223,47,38,0.08)] px-2.5 py-1 text-xs font-medium text-[var(--signal)]">
                                  <span className="h-2 w-2 rounded-full bg-[var(--signal)]" />
                                  Needs help
                                </span>
                              ) : null}
                              {student.hasRecentEngagementConcern ? (
                                <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(144,111,18,0.10)] px-2.5 py-1 text-xs font-medium text-[#906f12]">
                                  <span className="h-2 w-2 rounded-full bg-[#906f12]" />
                                  Engagement block
                                </span>
                              ) : null}
                              {!student.hasRecentEngagementConcern && (!student.isWaitingForStudentReply || (student.secondsSinceLastMessage && student.secondsSinceLastMessage <= 180)) ? (
                                <span className="text-xs text-[var(--dim-grey)] text-opacity-60">—</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {student.latestRubricScore ? (
                               <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                                student.latestRubricScore === '0_no_submission' || student.latestRubricScore === 'not_observed' ? 'bg-[rgba(34,34,34,0.05)] text-[var(--dim-grey)]' :
                                student.latestRubricScore === '1_beginning' || student.latestRubricScore === 'emerging' ? 'bg-[rgba(223,47,38,0.08)] text-[var(--signal)]' :
                                student.latestRubricScore === '2_developing' || student.latestRubricScore === 'insufficient_evidence' ? 'bg-[rgba(144,111,18,0.10)] text-[#906f12]' :
                                student.latestRubricScore === '3_proficient' || student.latestRubricScore === 'meets' ? 'bg-[rgba(17,120,144,0.10)] text-[var(--teal)]' :
                                'bg-[rgba(114,133,3,0.12)] text-[var(--olive)]'
                               }`}>
                                 {student.latestRubricScore === '0_no_submission' ? 'Score: 0 / 4' :
                                  student.latestRubricScore === '1_beginning' ? 'Score: 1 / 4' :
                                  student.latestRubricScore === '2_developing' ? 'Score: 2 / 4' :
                                  student.latestRubricScore === '3_proficient' ? 'Score: 3 / 4' :
                                  student.latestRubricScore === '4_advanced' ? 'Score: 4 / 4' :
                                  student.latestRubricScore.replace('_', ' ')}
                               </span>
                            ) : (
                               <span className="text-xs text-[var(--dim-grey)] opacity-60 italic">Pending report</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {student.misconceptionCount > 0 ? (
                              <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(144,111,18,0.10)] px-2.5 py-1 text-xs font-medium text-[#906f12]">
                                <span className="h-2 w-2 rounded-full bg-[#906f12]" />
                                {student.misconceptionCount} unresolved
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--dim-grey)] text-opacity-60">—</span>
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
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => toggleStudent(student.id)}
                              className="text-sm font-medium text-[var(--teal)] transition-colors hover:text-[var(--charcoal)]"
                            >
                              {isExpanded ? "Hide conversation" : "View conversation"}
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
                                <h4 className="eyebrow eyebrow-teal mb-6">Full Conversation</h4>
                                {loadingDetail ? (
                                  <div className="py-4">
                                    <LoadingState message="Loading conversation…" />
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
                                    Failed to load conversation.
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
