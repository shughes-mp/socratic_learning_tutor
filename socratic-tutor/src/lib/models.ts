/**
 * Centralized Anthropic model configuration.
 *
 * All model strings in the app are defined here. Override any of them with
 * environment variables (for example in Vercel) so you can update models
 * without a code change or redeployment.
 *
 * Env vars (all optional - defaults are set below):
 *   ANTHROPIC_MODEL_PRIMARY   - main tutoring / reasoning model (Sonnet)
 *   ANTHROPIC_MODEL_FAST      - lightweight / diagnostic model (Haiku)
 */

/**
 * Primary model: used for tutoring, report generation, and session summaries.
 * Needs strong reasoning and instruction-following.
 */
export const MODEL_PRIMARY =
  process.env.ANTHROPIC_MODEL_PRIMARY ?? "claude-sonnet-4-6";

/**
 * Fast model: used for diagnostics, checkpoint linting, question suggestions,
 * misconception clustering, and prerequisite-map suggestions.
 *
 * `claude-3-5-haiku-latest` has been retired by Anthropic and now returns 404s.
 * Use the current Haiku 4.5 alias by default so fast-path features keep working
 * in both local dev and Vercel unless an explicit override is set.
 */
export const MODEL_FAST =
  process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001";
