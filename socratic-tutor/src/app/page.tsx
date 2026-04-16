import Link from "next/link";

const steps = [
  {
    step: "01",
    title: "Create the session",
    body: "Name it, choose when learners will use it, upload your reading, and set a learning goal.",
  },
  {
    step: "02",
    title: "Share the link",
    body: "Learners join with an access code — no account needed. The tutor guides them through questions that demand reasoning, not recall.",
  },
  {
    step: "03",
    title: "Review the evidence",
    body: "See how each learner reasoned, where misconceptions surfaced, and what to prioritize when you teach.",
  },
];

const capabilities = [
  {
    label: "Grounded in your materials",
    accent: "var(--teal)",
    description:
      "The tutor draws exclusively from the readings you upload. Learners engage with your content — not generic AI output.",
  },
  {
    label: "Assessments stay protected",
    accent: "var(--olive)",
    description:
      "Upload exam or assessment questions separately. The tutor coaches learners toward understanding without surfacing the answer.",
  },
  {
    label: "Actionable after every session",
    accent: "var(--rose)",
    description:
      "Misconceptions, confidence patterns, topic mastery, and a teaching brief — generated for every learner, ready before your next class.",
  },
];

export default function HomePage() {
  return (
    <main className="minerva-page">
      <div className="minerva-shell">

        {/* ── Header ───────────────────────────────────────────────────── */}
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

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-16 md:px-8 md:py-24 lg:py-32">
            <p className="eyebrow eyebrow-teal">For Instructors</p>
            <h1 className="lead-copy mt-5 max-w-[16ch]">
              See how your learners think — then teach accordingly.
            </h1>
            <p className="body-copy mt-6 max-w-[38rem]">
              Socratic Tutor runs guided conversations with your learners,
              grounded in your own materials. You get a clear picture of what
              they understand, where misconceptions live, and what needs your
              attention next.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
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
              Five minutes to set up. Learners join with an access code — no account required.
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]"
        >
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-20">
            <p className="eyebrow eyebrow-teal">How It Works</p>
            <h2 className="section-title mt-5 max-w-[14ch]">
              Three steps to a clear picture of your class.
            </h2>

            <div className="proof-grid mt-12 grid grid-cols-1 md:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="px-5 py-6">
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
          </div>
        </section>

        {/* ── Key capabilities ──────────────────────────────────────────── */}
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-14 md:px-8 md:py-20">
            <p className="eyebrow eyebrow-olive">What Sets This Apart</p>
            <div className="mt-8 grid grid-cols-1 gap-0 divide-y divide-[var(--rule)] md:grid-cols-3 md:gap-0 md:divide-x md:divide-y-0">
              {capabilities.map((item) => (
                <div key={item.label} className="px-5 py-6 md:first:pl-0">
                  <p
                    className="text-[14px] font-extrabold leading-snug"
                    style={{ color: item.accent }}
                  >
                    {item.label}
                  </p>
                  <p className="mt-3 text-[14px] leading-6 text-[var(--dim-grey)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
          <div className="hidden border-r border-[var(--rule)] md:block" />
          <div className="px-4 py-16 md:px-8 md:py-24">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
              <div>
                <p className="lead-copy max-w-[18ch]">
                  Know where your learners stand before you teach next.
                </p>
                <p className="body-copy muted-copy mt-5 max-w-[36rem]">
                  One session, one reading, one goal. Takes five minutes —
                  and gives you evidence you can act on immediately.
                </p>
              </div>
              <div className="md:justify-self-end">
                <Link
                  href="/instructor"
                  className="minerva-button w-full min-h-[56px] md:w-[240px]"
                >
                  Create a Session
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
