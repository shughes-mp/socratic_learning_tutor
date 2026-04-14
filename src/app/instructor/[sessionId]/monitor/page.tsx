"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ExchangeReplay } from "@/components/instructor/exchange-replay";
import type { ConfidenceCheck, Message, Misconception } from "@prisma/client";

interface StudentSessionData {
  id: string;
  studentName: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  messages: Array<Message & { createdAt: string | Date; hidden?: boolean }>;
  misconceptions: Misconception[];
  confidenceChecks: ConfidenceCheck[];
}

export default function StudentMonitorPage() {
  const params = useParams() as { sessionId: string };
  const [students, setStudents] = useState<StudentSessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/sessions/${params.sessionId}/students`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setStudents(data);
        }
      } catch (err) {
        console.error("Failed to fetch learner progress:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [params.sessionId]);

  const toggleStudent = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
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

            <Link
              href={`/instructor/${params.sessionId}`}
              className="minerva-button minerva-button-secondary"
            >
              Back to session workspace
            </Link>
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
          <div className="minerva-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--dim-grey)]">
                <thead className="border-b border-[var(--rule)] bg-[rgba(34,34,34,0.02)]">
                  <tr>
                    <th className="px-6 py-4">Learner</th>
                    <th className="px-6 py-4">Exchanges</th>
                    <th className="px-6 py-4">Common misunderstandings</th>
                    <th className="px-6 py-4">Last active</th>
                    <th className="px-6 py-4 text-right">Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {students.map((student) => {
                    const exchanges = Math.floor(student.messages.length / 2);
                    const isExpanded = expandedId === student.id;
                    let lastActive = student.startedAt;
                    if (student.messages.length > 0) {
                      lastActive = student.messages[student.messages.length - 1].createdAt;
                    }

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
                            {student.misconceptions.length > 0 ? (
                              <span className="flex w-max items-center gap-1.5 rounded-md bg-[rgba(223,47,38,0.08)] px-2.5 py-1 font-medium text-[var(--signal)]">
                                <span className="h-2 w-2 rounded-full bg-[var(--signal)]" />
                                {student.misconceptions.length}
                              </span>
                            ) : (
                              <span className="text-[var(--dim-grey)]">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-[var(--dim-grey)]">
                            {new Date(lastActive).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
                              colSpan={5}
                              className="border-t border-[var(--rule)] bg-[rgba(34,34,34,0.02)] p-0"
                            >
                              <div className="mx-6 my-5 max-w-4xl border-l-2 border-[var(--teal)] bg-white p-8">
                                <h4 className="eyebrow eyebrow-teal mb-6">Interaction Trace</h4>
                                <ExchangeReplay
                                  messages={student.messages}
                                  misconceptions={student.misconceptions}
                                />
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
        )}
      </div>
    </main>
  );
}
