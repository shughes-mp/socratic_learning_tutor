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
            <p className="eyebrow eyebrow-rose">Session unavailable</p>
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
      _count: {
        select: { readings: true },
      },
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

  if (session._count.readings === 0) {
    return (
      <SessionMessage
        title="Session Not Ready Yet"
        description="Your instructor is still setting up this session. Check back shortly or ask your instructor when it will be available."
      />
    );
  }

  return (
    <main className="minerva-page">
      <div className="minerva-shell">
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_360px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">Reading Session</p>
            <h1 className="section-title mt-5 max-w-[11ch]">{session.name}</h1>
            {session.description && (
              <p className="body-copy muted-copy mt-6 max-w-[26rem]">
                {session.description}
              </p>
            )}
            <div className="mt-8 space-y-3 max-w-[28rem]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--dim-grey)]">
                How this works
              </p>
              <ul className="space-y-2.5">
                {[
                  "Start by sharing what you already know about the topic.",
                  "The tutor will ask questions — not give you answers directly.",
                  "Take your time with each response. Quality matters more than speed.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(17,120,144,0.12)]">
                      <svg className="w-2.5 h-2.5 text-[var(--teal)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-[14px] leading-6 text-[var(--charcoal)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
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
