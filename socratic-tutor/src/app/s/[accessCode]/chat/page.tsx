import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ClientChat } from "./client-chat";

interface PageProps {
  params: Promise<{ accessCode: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { accessCode } = await params;

  const session = await prisma.session.findUnique({
    where: { accessCode },
    select: {
      id: true,
      name: true,
      maxExchanges: true,
      closesAt: true,
    },
  });

  if (!session) {
    notFound();
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
            This tutoring session has closed. Please contact your instructor if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClientChat 
      accessCode={accessCode} 
      sessionName={session.name} 
      maxExchanges={session.maxExchanges} 
    />
  );
}
