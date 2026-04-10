"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ReadinessHeatmap } from "@/components/instructor/readiness-heatmap";

interface ReportData {
  id: string;
  sessionId: string;
  content: string;
  stats: string; // JSON
  generatedAt: string;
}

interface ReportStats {
  studentsCount: number;
  exchanges: number;
  misconceptions: number;
  directAnswers: number;
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
      // Forcing cache busting locally. If forceRefresh is on we can't really force the backend
      // without adding a query param, but the backend uses a 5 min cache based on student activity anyway.
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
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-500 font-medium">Synthesizing interaction data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 min-h-screen">
        <h2 className="text-lg font-bold mb-2">Error</h2>
        <p>{error}</p>
        <Link href={`/instructor/${params.sessionId}`} className="mt-4 block underline">Back to Session</Link>
      </div>
    );
  }

  if (!report) return null;

  const stats = JSON.parse(report.stats) as ReportStats;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link href={`/instructor/${params.sessionId}`} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-2 inline-block">
              &larr; Back to Session Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Instructor Report</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => fetchReport(true)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Report"}
            </button>
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              Export as PDF
            </button>
          </div>
        </header>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Students</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.studentsCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Exchanges</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.exchanges}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Misconceptions</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.misconceptions}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Direct Answers</h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{stats.directAnswers}</p>
          </div>
        </div>

        {/* Readiness Heatmap Widget */}
        <section className="bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-amber-500 inline-block"></span>
            Class Readiness Heatmap
          </h2>
          <ReadinessHeatmap reportContent={report.content} />
        </section>

        {/* Full Report Text Base */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 md:p-12 rounded-3xl shadow-sm">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </section>

      </div>
    </div>
  );
}
