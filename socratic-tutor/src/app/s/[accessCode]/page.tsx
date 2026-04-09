import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import StudentEntryForm from "./student-entry-form";

interface PageProps {
  params: Promise<{ accessCode: string }>;
}

export default async function StudentEntryPage({ params }: PageProps) {
  const { accessCode } = await params;

  const session = await prisma.session.findUnique({
    where: { accessCode },
    select: {
      id: true,
      name: true,
      description: true,
      closesAt: true,
    },
  });

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Invalid Access Code
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This link doesn&apos;t match any active session. Please check with
            your instructor for the correct link.
          </p>
        </div>
      </div>
    );
  }

  // Check if session is closed
  if (session.closesAt && new Date(session.closesAt) < new Date()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Session Closed
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This tutoring session has closed. Please contact your instructor if
            you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {session.name}
          </h1>
          {session.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {session.description}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
          <StudentEntryForm
            sessionId={session.id}
            accessCode={accessCode}
          />
        </div>

        <p className="text-xs text-center text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
          This tutor will ask you questions to help you develop your own
          understanding of the readings. After a few genuine attempts, it will
          provide a direct answer if you are stuck.
        </p>
      </div>
    </div>
  );
}
