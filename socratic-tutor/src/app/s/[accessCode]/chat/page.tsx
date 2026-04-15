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
      description: true,
      courseContext: true,
      learningGoal: true,
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
      <main className="minerva-page">
        <div className="minerva-shell">
          <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="px-4 py-16 md:px-8 md:py-20">
              <p className="eyebrow eyebrow-rose">Student Access</p>
              <h1 className="section-title mt-5">Session Closed</h1>
              <p className="body-copy muted-copy mt-6 max-w-[34rem]">
                This tutoring session has closed. Please contact your instructor
                if you need access.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <ClientChat 
      accessCode={accessCode} 
      sessionName={session.name} 
      sessionDescription={session.description}
      courseContext={session.courseContext}
      learningGoal={session.learningGoal}
      maxExchanges={session.maxExchanges} 
    />
  );
}
