/**
 * LoadingState — A branded loading indicator for the Minerva design system.
 *
 * Uses a gentle CSS pulse animation on a teal accent line, paired with a
 * short serif message in Cormorant Garamond. Designed to feel like part of
 * the editorial layout rather than a tech UI overlay.
 *
 * Variants:
 *  - "page"   → Full-page state inside the minerva-shell grid layout.
 *  - "inline" → A compact indicator for embedding inside cards or panels.
 *  - "button" → A tiny indicator for inline button text replacement.
 */

interface LoadingStateProps {
  /** The message to display. Defaults to "Loading…" */
  message?: string;
  /**
   * - `"page"`: Full-page loading state inside the standard minerva grid.
   * - `"inline"`: Compact loading state for embedding in cards or panels.
   * - `"button"`: Minimal dot + text for use inside a button.
   */
  variant?: "page" | "inline" | "button";
}

export function LoadingState({
  message = "Loading…",
  variant = "inline",
}: LoadingStateProps) {
  if (variant === "page") {
    return (
      <main className="minerva-page">
        <div className="minerva-shell">
          <section className="section-rule grid grid-cols-1 md:grid-cols-[156px_minmax(0,1fr)]">
            <div className="hidden border-r border-[var(--rule)] md:block" />
            <div className="flex items-center gap-4 px-4 py-16 md:px-8 md:py-20">
              <span className="loading-accent-bar" aria-hidden="true" />
              <p className="font-serif text-[18px] tracking-[-0.01em] text-[var(--dim-grey)]">
                {message}
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (variant === "button") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="loading-accent-dot" aria-hidden="true" />
        {message}
      </span>
    );
  }

  // ── Inline (default) ──
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="loading-accent-bar" aria-hidden="true" />
      <p className="font-serif text-[15px] tracking-[-0.01em] text-[var(--dim-grey)]">
        {message}
      </p>
    </div>
  );
}
