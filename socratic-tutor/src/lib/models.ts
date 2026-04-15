/**
 * Centralized Anthropic model configuration.
 *
 * All model strings in the app are defined here. Override any of them with
 * environment variables (e.g. in Vercel) so you can update models without
 * a code change or redeployment.
 *
 * Env vars (all optional — defaults are set below):
 *   ANTHROPIC_MODEL_PRIMARY   — main tutoring / reasoning model (Sonnet)
 *   ANTHROPIC_MODEL_FAST      — lightweight / diagnostic model (Haiku)
 */

/**
 * Primary model: used for tutoring, report generation, session summaries,
 * and prerequisite-map suggestions. Needs strong reasoning and instruction-following.
 */
export const MODEL_PRIMARY =
  process.env.ANTHROPIC_MODEL_PRIMARY ?? "claude-sonnet-4-6";

/**
 * Fast model: used for diagnostics, checkpoint linting, question suggestions,
 * and misconception clustering. Prioritises speed and cost over depth.
 */
export const MODEL_FAST =
  process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001";
