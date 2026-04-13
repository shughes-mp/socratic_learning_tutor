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
  messages: Array<Message & { createdAt: string | Date }>;
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
        if (Array.isArray(data)) setStudents(data);
      } catch (err) {
        console.error("Failed to fetch student data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [params.sessionId]);

  const toggleStudent = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <Link href={`/instructor/${params.sessionId}`} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-4 inline-block">
          &larr; Back to Session Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">Student Activity Monitor</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-2xl bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <svg className="w-5 h-5 inline-block mr-2 text-indigo-500 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          This view shows session themes and engagement data. Full transcripts are available on request but are primarily used to identify broad misunderstandings.
        </p>

        {students.length === 0 ? (
          <div className="text-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No student activity yet.</h3>
            <p className="text-slate-500 mt-2">When students join the session using the access code, their activity will appear here.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-2xl">Student Name</th>
                    <th className="px-6 py-4">Total Exchanges</th>
                    <th className="px-6 py-4">Misconceptions Logged</th>
                    <th className="px-6 py-4">Last Active</th>
                    <th className="px-6 py-4 text-right rounded-tr-2xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {students.map((student) => {
                    const exchanges = Math.floor(student.messages.length / 2);
                    const isExpanded = expandedId === student.id;

                    // Get last active time roughly based on last message
                    let lastActive = student.startedAt;
                    if (student.messages.length > 0) {
                      lastActive = student.messages[student.messages.length - 1].createdAt;
                    }

                    return (
                      <React.Fragment key={student.id}>
                        <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                            {student.studentName}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md font-medium text-slate-700 dark:text-slate-300">{exchanges}</span>
                          </td>
                          <td className="px-6 py-4">
                            {student.misconceptions.length > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-md flex items-center w-max gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                {student.misconceptions.length}
                              </span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {new Date(lastActive).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => toggleStudent(student.id)}
                              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium text-sm"
                            >
                              {isExpanded ? "Hide Trace" : "View Replay"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 p-0">
                              <div className="p-8 border-l-2 border-indigo-500 ml-6 my-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm max-w-4xl">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Interaction Trace</h4>
                                <ExchangeReplay messages={student.messages} misconceptions={student.misconceptions} />
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
    </div>
  );
}
