import { prisma } from "@/lib/db";
import StudentEntryForm from "./student-entry-form";

interface PageProps {
  params: Promise<{ accessCode: string }>;
}

function SessionMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="minerva-page">
      <div className="minerva-shell">
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-16 md:px-8 md:py-20">
            <p className="eyebrow eyebrow-rose">Student Access</p>
            <h1 className="section-title mt-5">{title}</h1>
            <p className="body-copy muted-copy mt-6 max-w-[33rem]">
              {description}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
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
      <SessionMessage
        title="Invalid Access Code"
        description="This link does not match an active session. Please check with your instructor for the correct invitation."
      />
    );
  }

  if (session.closesAt && new Date(session.closesAt) < new Date()) {
    return (
      <SessionMessage
        title="Session Closed"
        description="This tutoring session is no longer accepting new students. Please contact your instructor if you need access."
      />
    );
  }

  return (
    <main className="minerva-page">
      <div className="minerva-shell">
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_360px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">Student Entry</p>
            <h1 className="section-title mt-5 max-w-[11ch]">{session.name}</h1>
            {session.description && (
              <p className="body-copy muted-copy mt-6 max-w-[26rem]">
                {session.description}
              </p>
            )}
            <p className="body-copy mt-8 max-w-[28rem]">
              You will be asked to explain what you think, respond to guided
              prompts, and work toward your own understanding before the tutor
              offers direct explanations.
            </p>
          </div>

          <div className="px-4 py-14 md:px-8 md:py-16">
            <div className="minerva-card p-6 md:p-8">
              <StudentEntryForm sessionId={session.id} accessCode={accessCode} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
