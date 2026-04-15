import Link from "next/link";

const quickFacts = [
  {
    label: "Who uses it",
    value: "Instructors who want to understand how students think — before, during, and after class",
    color: "var(--teal)",
  },
  {
    label: "What students do",
    value: "Explain their reasoning and work through guided questions that require real thinking",
    color: "var(--olive)",
  },
  {
    label: "What instructors see",
    value: "Misconceptions, confidence patterns, full conversation replays, and a teaching brief",
    color: "var(--rose)",
  },
];

const workflow = [
  {
    step: "01",
    title: "Create the session",
    body: "Choose where in the learning cycle this session fits. Add the materials, a learning goal, and any context the tutor needs.",
  },
  {
    step: "02",
    title: "Share the student link",
    body: "Students join with a simple access code — no account required. They explain what they know and work through questions that require real reasoning.",
  },
  {
    step: "03",
    title: "Review the evidence",
    body: "See how students reasoned, where misconceptions appeared, and what to address before or during your next class.",
  },
];

const capabilities = [
  {
    label: "Grounded tutoring",
    color: "var(--teal)",
    description:
      "The tutor works from instructor-uploaded materials instead of improvising from generic knowledge. Students are guided through your content, not around it.",
  },
  {
    label: "Assessment protection",
    color: "var(--olive)",
    description:
      "Upload protected assessment materials so the tutor coaches students toward understanding without revealing the answers directly.",
  },
  {
    label: "Learning signals",
    color: "var(--rose)",
    description:
      "Every session surfaces misconceptions, confidence patterns, and topic mastery — giving instructors something to act on, not just a completion log.",
  },
];

const proofRows = [
  {
    title: "What instructors control",
    detail: "session purpose, materials, learning goals, key questions, prerequisite context, exchange limit",
  },
  {
    title: "What students experience",
    detail: "prior-knowledge prompts, guided Socratic questioning, follow-up checks, and reflection",
  },
  {
    title: "What the app reveals",
    detail: "misconceptions, confidence patterns, conversation replays, and a teaching brief",
  },
];

export default function HomePage() {
  return (
    <main className="minerva-page">
      <div className="minerva-shell">
        <header className="top-rule bottom-rule grid min-h-[74px] grid-cols-1 items-center gap-4 px-0 md:grid-cols-[156px_1fr_220px]">
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

        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_280px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />

          <aside className="px-4 py-12 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">At a Glance</p>
            <div className="mt-8 space-y-0">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="border-y border-[var(--rule)] px-0 py-4"
                >
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim-grey)]">
                    {fact.label}
                  </p>
                  <p
                    className="mt-2 text-[16px] font-bold leading-snug"
                    style={{ color: fact.color }}
                  >
                    {fact.value}
                  </p>
                </div>
              ))}
            </div>
          </aside>

          <div className="px-4 py-12 md:px-8 md:py-16">
            <p className="eyebrow eyebrow-teal">What This Product Does</p>
            <h1 className="lead-copy mt-5 max-w-[12ch]">
              Turn student thinking into evidence you can teach from.
            </h1>

            <p className="body-copy mt-7 max-w-[38rem]">
              Socratic Tutor is a web app for instructors. Set up a session for
              any point in the learning cycle — before class, during class, or
              after — and get a clear picture of where students are confident,
              confused, or incomplete.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/instructor"
                className="minerva-button min-h-[56px] px-8 text-[14px]"
              >
                Create a Session
              </Link>
              <a
                href="#how-it-works"
                className="minerva-button minerva-button-secondary min-h-[56px] px-8 text-[14px]"
              >
                See How It Works
              </a>
            </div>

            <p className="mt-5 text-[13px] leading-6 text-[var(--dim-grey)]">
              Setup takes under five minutes. Upload materials, set a goal,
              share a link — students join with an access code, no account required.
            </p>

            <div className="proof-grid mt-10 grid grid-cols-1 md:grid-cols-3">
              {workflow.map((item) => (
                <div key={item.step} className="px-5 py-5">
                  <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--dim-grey)]">
                    STEP {item.step}
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

            <div className="minerva-card mt-8 max-w-[48rem] p-6">
              <p className="eyebrow eyebrow-teal">What&rsquo;s Included</p>
              <div className="mt-5 space-y-4">
                {proofRows.map((row, index) => (
                  <div
                    key={row.title}
                    className={`grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr] ${
                      index < proofRows.length - 1
                        ? "border-b border-[var(--rule)] pb-4"
                        : ""
                    }`}
                  >
                    <p className="text-[15px] font-bold text-[var(--charcoal)]">
                      {row.title}
                    </p>
                    <p className="text-[14px] leading-6 text-[var(--dim-grey)]">
                      {row.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]"
        >
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-20">
            <p className="eyebrow eyebrow-teal">How It Works</p>
            <h2 className="section-title mt-5 max-w-[13ch]">
              Designed around evidence you can actually act on.
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-0">
              <div className="md:border-r md:border-[var(--rule)] md:pr-8">
                <p className="eyebrow eyebrow-teal">For Students</p>
                <p className="body-copy mt-5 max-w-[29rem]">
                  Students start by stating what they already know, then work through
                  questions tied to the uploaded materials. The tutor asks for reasoning
                  first — students can&apos;t skip straight to the answer.
                </p>
              </div>
              <div className="md:pl-8">
                <p className="eyebrow eyebrow-teal">For Instructors</p>
                <p className="body-copy mt-5 max-w-[32rem]">
                  Instructors don&apos;t just see whether students logged in.
                  They see how students reasoned, where misconceptions appeared,
                  and what topics need follow-up — before they walk into class.
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
                <p className="eyebrow eyebrow-olive">Key Capabilities</p>
                <h2 className="section-title mt-5 max-w-[12ch]">
                  Purposeful tutoring, not generic chat.
                </h2>
              </div>
              <div className="metric-list">
                {capabilities.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-1 gap-3 px-5 py-6 md:grid-cols-[180px_1fr]"
                  >
                    <p
                      className="text-[15px] font-extrabold"
                      style={{ color: item.color }}
                    >
                      {item.label}
                    </p>
                    <p className="body-copy text-[15px]">{item.description}</p>
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
                  Arrive at class knowing where students are — not guessing.
                </p>
                <p className="body-copy muted-copy mt-6 max-w-[38rem]">
                  Start with one session, one goal, and one set of materials.
                  The app is most useful when student thinking is visible
                  enough to shape what you actually do next.
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
