import Link from "next/link";

const pillars = [
  {
    label: "Guided Reasoning",
    color: "var(--teal)",
    description:
      "Students are led through structured questions before the tutor gives direct explanations.",
  },
  {
    label: "Faculty Oversight",
    color: "var(--olive)",
    description:
      "Instructors create sessions, upload materials, and review student progress with replay and reports.",
  },
  {
    label: "Impact Signals",
    color: "var(--rose)",
    description:
      "Misconceptions, confidence, and topic mastery are surfaced so sessions generate useful teaching evidence.",
  },
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
          <div className="grid grid-cols-1 md:grid-cols-[156px_304px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="px-4 py-12 md:px-8 md:py-16">
              <p className="eyebrow eyebrow-teal">Solution</p>
              <div className="mt-20 w-fit">
                <div className="mb-5 flex h-18 w-18 items-center justify-center rounded-full border border-[var(--rule)] bg-white/70 text-[28px] font-semibold">
                  S
                </div>
                <p className="font-serif text-[46px] leading-[0.9] tracking-[-0.04em]">
                  Socratic
                  <br />
                  Tutor
                </p>
              </div>

              <div className="mt-14 space-y-0">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.label}
                    className="border-y border-[var(--rule)] px-0 py-4"
                  >
                    <p
                      className="text-[18px] font-extrabold leading-tight"
                      style={{ color: pillar.color }}
                    >
                      {pillar.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
              <h1 className="lead-copy max-w-[14ch]">
                A deeply guided reading and reflection environment for
                higher-stakes learning.
              </h1>
              <p className="body-copy muted-copy mt-8 max-w-[35rem]">
                Socratic Tutor helps instructors turn readings into structured,
                evidence-rich conversations. Students enter a session, explain
                what they think, work through guided questions, and leave behind
                a clearer record of mastery, confusion, and growth.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link href="/instructor" className="minerva-button">
                  Create a Session
                </Link>
                <span className="text-[12px] font-medium text-[var(--dim-grey)]">
                  Students join with the link shared by their instructor.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-20">
            <p className="eyebrow eyebrow-teal">
              Institutional Architecture For Learning
            </p>
            <h2 className="section-title mt-5 max-w-[12ch]">
              Connect course preparation to observable learning moves.
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-0">
              <div className="md:border-r md:border-[var(--rule)] md:pr-8">
                <p className="eyebrow eyebrow-teal">Our Approach</p>
                <p className="body-copy mt-5 max-w-[28rem]">
                  Sessions are grounded in instructor-uploaded readings and
                  optional protected assessments. The tutor begins with prior
                  knowledge, asks for reasoning, and adapts based on attempts,
                  confidence, and misconception signals.
                </p>
              </div>
              <div className="md:pl-8">
                <p className="eyebrow eyebrow-teal">Why It Matters</p>
                <p className="body-copy mt-5 max-w-[33rem]">
                  Instead of reducing study time to answer retrieval, the app
                  makes student thinking visible. Instructors get a cleaner view
                  of where preparation is strong, where it breaks down, and what
                  concepts need intervention.
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
                <p className="eyebrow eyebrow-olive">Faculty Development</p>
                <h2 className="section-title mt-5 max-w-[12ch]">
                  Build sessions that coach understanding rather than reward
                  answer hunting.
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
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
              <div>
                <p className="lead-copy max-w-[18ch]">
                  Better preparation becomes visible when learners have to think
                  in public.
                </p>
                <p className="body-copy muted-copy mt-6 max-w-[38rem]">
                  Create a session, upload readings, share the student link, and
                  review reports that capture patterns in confidence,
                  misconceptions, and topic mastery.
                </p>
              </div>
              <div className="md:justify-self-end">
                <Link href="/instructor" className="minerva-button w-full md:w-[220px]">
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
