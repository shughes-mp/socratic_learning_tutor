import Link from "next/link";

const pillars = [
  {
    label: "Guided Reasoning",
    color: "var(--teal)",
    description:
      "Students respond to structured prompts before the tutor offers direct explanations.",
  },
  {
    label: "Faculty Oversight",
    color: "var(--olive)",
    description:
      "Instructors create sessions, upload materials, and review progress with replay and reports.",
  },
  {
    label: "Impact Signals",
    color: "var(--rose)",
    description:
      "Confidence, misconceptions, and topic mastery become visible as students work.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Create a session",
    body: "Set the learning goal, add context, and define the reading experience you want students to enter.",
  },
  {
    step: "02",
    title: "Share the student link",
    body: "Students join with a simple access code and begin by explaining what they already know.",
  },
  {
    step: "03",
    title: "Review the evidence",
    body: "See where reasoning was strong, where misconceptions persisted, and what should be revisited in class.",
  },
];

const proofPoints = [
  "Instructor-created sessions",
  "Reading-grounded AI tutoring",
  "Protected assessment support",
  "Replay, reports, and mastery signals",
];

export default function HomePage() {
  return (
    <main className="minerva-page">
      <div className="minerva-shell">
        <header className="top-rule bottom-rule grid min-h-[74px] grid-cols-1 items-center gap-4 px-0 md:grid-cols-[156px_1fr_160px]">
          <div className="hidden md:block" />
          <div className="px-4 py-5 md:px-8">
            <p className="text-[12px] font-extrabold tracking-[0.01em]">
              Socratic Tutor
            </p>
          </div>
          <div className="px-4 py-5 md:px-8 md:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim-grey)]">
              Learning System
            </p>
          </div>
        </header>

        <section className="relative overflow-hidden">
          <div className="hero-orb" />
          <div className="grid grid-cols-1 md:grid-cols-[156px_256px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />

            <div className="px-4 py-12 md:px-8 md:py-16">
              <p className="eyebrow eyebrow-teal">For Instructors</p>
              <div className="mt-14 w-fit">
                <div className="mb-5 flex h-18 w-18 items-center justify-center rounded-full border border-[var(--rule)] bg-white/70 text-[28px] font-semibold">
                  S
                </div>
                <p className="font-serif text-[46px] leading-[0.9] tracking-[-0.04em]">
                  Socratic
                  <br />
                  Tutor
                </p>
              </div>

              <div className="mt-12 space-y-0">
                {proofPoints.map((point, index) => (
                  <div
                    key={point}
                    className="border-y border-[var(--rule)] px-0 py-4"
                  >
                    <p
                      className="text-[17px] font-bold leading-tight"
                      style={{
                        color:
                          index === 0
                            ? "var(--teal)"
                            : index === 1
                              ? "var(--olive)"
                              : index === 2
                                ? "var(--rose)"
                                : "var(--charcoal)",
                      }}
                    >
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-copy px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
              <h1 className="lead-copy max-w-[12ch]">
                Create guided reading sessions that make student thinking
                visible.
              </h1>
              <p className="body-copy mt-8 max-w-[37rem]">
                Socratic Tutor is a live web app for instructors. Upload
                readings, invite students into a guided chat, and review where
                they were confident, confused, or still incomplete before class.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/instructor"
                  className="minerva-button min-h-[56px] px-8 text-[14px]"
                >
                  Create a Session
                </Link>
                <div className="text-[13px] leading-6 text-[var(--dim-grey)]">
                  Students join with a shared link.
                  <br />
                  Instructors manage readings, reports, and activity.
                </div>
              </div>

              <div className="proof-grid mt-10 grid grid-cols-1 md:grid-cols-3">
                {workflow.map((item) => (
                  <div key={item.step} className="px-5 py-5">
                    <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--dim-grey)]">
                      {item.step}
                    </p>
                    <p className="mt-3 text-[18px] font-bold leading-tight text-[var(--charcoal)]">
                      {item.title}
                    </p>
                    <p className="mt-3 text-[14px] leading-6 text-[var(--dim-grey)]">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="minerva-card mt-8 max-w-[44rem] p-5 md:p-6">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
                  <div className="border-b border-[var(--rule)] pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
                    <p className="eyebrow eyebrow-teal">What You Get</p>
                    <p className="mt-4 font-serif text-[30px] leading-[1.02] tracking-[-0.03em]">
                      Product proof, not just positioning.
                    </p>
                  </div>
                  <div className="space-y-3 text-[14px] leading-6 text-[var(--charcoal)]">
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--rule)] pb-3">
                      <span className="font-semibold">Session setup</span>
                      <span className="text-[var(--dim-grey)]">
                        title, context, readings, assessments
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--rule)] pb-3">
                      <span className="font-semibold">Student experience</span>
                      <span className="text-[var(--dim-grey)]">
                        prior knowledge, guided prompts, reflection
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-semibold">Instructor review</span>
                      <span className="text-[var(--dim-grey)]">
                        replay, misconception signals, summary reports
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-20">
            <p className="eyebrow eyebrow-teal">Why It Works</p>
            <h2 className="section-title mt-5 max-w-[11ch]">
              The interface is built around reasoning, not answer retrieval.
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-0">
              <div className="md:border-r md:border-[var(--rule)] md:pr-8">
                <p className="eyebrow eyebrow-teal">Learning Design</p>
                <p className="body-copy mt-5 max-w-[28rem]">
                  Sessions begin by asking students what they think before the
                  tutor moves into the reading itself. The system tracks genuine
                  attempts, confidence checks, and revisit opportunities so the
                  conversation becomes more diagnostic over time.
                </p>
              </div>
              <div className="md:pl-8">
                <p className="eyebrow eyebrow-teal">Teaching Value</p>
                <p className="body-copy mt-5 max-w-[33rem]">
                  Instead of guessing whether students completed the work,
                  instructors can review traces of understanding: where students
                  stalled, where they improved, and which concepts need more
                  attention in live teaching.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-20">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div>
                <p className="eyebrow eyebrow-olive">System Capabilities</p>
                <h2 className="section-title mt-5 max-w-[12ch]">
                  A more useful pre-class workflow for both students and faculty.
                </h2>
              </div>
              <div className="metric-list">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.label}
                    className="grid grid-cols-1 gap-3 px-5 py-6 md:grid-cols-[180px_1fr]"
                  >
                    <p
                      className="text-[15px] font-extrabold"
                      style={{ color: pillar.color }}
                    >
                      {pillar.label}
                    </p>
                    <p className="body-copy text-[15px]">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-16 md:px-8 md:py-20">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
              <div>
                <p className="lead-copy max-w-[18ch]">
                  See who is prepared, what they misunderstood, and where the
                  next discussion should begin.
                </p>
                <p className="body-copy muted-copy mt-6 max-w-[38rem]">
                  Create a session, upload the reading, invite your students,
                  and use the resulting reports to guide stronger teaching.
                </p>
              </div>
              <div className="md:justify-self-end">
                <Link
                  href="/instructor"
                  className="minerva-button w-full min-h-[56px] md:w-[240px]"
                >
                  Start Building
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
