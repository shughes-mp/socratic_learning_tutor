export function stripTags(content: string): string {
  return content
    .replace(/\[MODE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[TOPIC_THREAD:\s*[\s\S]*?\]/gi, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_CANONICAL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_PASSAGE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_SEVERITY:\s*[\s\S]*?\]/gi, "")
    .replace(/\[DIRECT_ANSWER:\s*[\s\S]*?\]/gi, "")
    .replace(/\[QTYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[FEEDBACK_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[EXPERT_MODEL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[SELF_EXPLAIN_PROMPTED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[COGNITIVE_CONFLICT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_RESOLVED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_ID:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_STATUS:\s*[\s\S]*?\]/gi, "")
    .replace(/\[(SOFT_REVISIT|IS_REVISIT_PROBE):\s*[\s\S]*?\]/gi, "")
    .replace(/\[NOTE:\s*[\s\S]*?\]/gi, "")
    // Catch-all: strip any remaining [UPPERCASE_TAG: ...] patterns
    .replace(/\[[A-Z][A-Z_]*:\s*[\s\S]*?\]/g, "")
    .trim();
}
