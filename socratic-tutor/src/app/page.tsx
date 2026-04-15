import Link from "next/link";

const quickFacts = [
  {
    label: "Who uses it",
    value: "Instructors who want to see how learners think — at any point in the learning cycle",
    color: "var(--teal)",
  },
  {
    label: "What learners do",
    value: "Work through guided questions grounded in the course reading, explaining their reasoning as they go",
    color: "var(--olive)",
  },
  {
    label: "What instructors see",
    value: "Where learners are confident, where misconceptions appear, and what to address next",
    color: "var(--rose)",
  },
];

const workflow = [
  {
    step: "01",
    title: "Create the session",
    body: "Name the session, choose its purpose in the learning cycle, upload your reading, and set a learning goal.",
  },
  {
    step: "02",
    title: "Share the link",
    body: "Learners join with an access code — no account needed. The tutor guides them through questions that require explanation and reasoning.",
  },
  {
    step: "03",
    title: "Review the evidence",
    body: "See how each learner reasoned, where misconceptions surfaced, and what to prioritize when you meet.",
  },
];

const capabilities = [
  {
    label: "Grounded tutoring",
    color: "var(--teal)",
    description:
      "The tutor draws on the readings you upload. Learners engage with your content directly, guided by Socratic questioning.",
  },
  {
    label: "Assessment protection",
    color: "var(--olive)",
    description:
      "Upload assessment materials separately. The tutor guides learners toward understanding without revealing answers.",
  },
  {
    label: "Learning signals",
    color: "var(--rose)",
    description:
      "Every session surfaces misconceptions, confidence patterns, and topic mastery — evidence that tells you where to focus.",
  },
];

const proofRows = [
  {
    title: "What instructors control",
    detail: "session purpose, readings, learning goals, key questions, prerequisite context",
  },
  {
    title: "What learners experience",
    detail: "prior-knowledge prompts, Socratic questioning, follow-up checks, and reflection",
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
            <h1 className="lead-copy mt-5 max-w-[14ch]">
              See how your learners think — then teach accordingly.
            </h1>

            <p className="body-copy mt-7 max-w-[38rem]">
              Socratic Tutor helps instructors understand learner thinking at
              any point in the learning cycle. Set up a session, share a link,
              and get a clear picture of what learners understand, where
              they&apos;re confused, and what needs attention.
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
              Setup takes under five minutes. Upload a reading, set a goal,
              share a link — learners join with an access code, no account required.
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
              Built around evidence you can act on.
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-0">
              <div className="md:border-r md:border-[var(--rule)] md:pr-8">
                <p className="eyebrow eyebrow-teal">For Learners</p>
                <p className="body-copy mt-5 max-w-[29rem]">
                  Learners begin by explaining what they already know, then work
                  through questions grounded in the reading. The tutor asks for
                  reasoning first — they can&apos;t skip straight to the answer.
                </p>
              </div>
              <div className="md:pl-8">
                <p className="eyebrow eyebrow-teal">For Instructors</p>
                <p className="body-copy mt-5 max-w-[32rem]">
                  Instructors see how each learner reasoned, where misconceptions
                  appeared, and which topics need follow-up. Every session produces
                  a teaching brief designed to inform what happens next.
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
                  Purposeful tutoring, grounded in your materials.
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
                  Know where your learners are before you walk into class.
                </p>
                <p className="body-copy muted-copy mt-6 max-w-[38rem]">
                  Start with one session, one reading, and one goal. The app
                  works best when learner thinking is visible enough to shape
                  what you do next.
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
