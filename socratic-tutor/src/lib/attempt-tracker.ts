export interface ParsedTags {
  mode: "comprehension" | "socratic" | null;
  topicThread: string | null;
  isGenuineAttempt: boolean | null;
  misconception: string | null;
  directAnswer: string | null;
  questionType:
    | "explain"
    | "predict"
    | "apply"
    | "distinguish"
    | "challenge"
    | "detect-error"
    | null;
  feedbackType: "corrective" | "extension" | "redirection" | null;
  expertModelType: "OPENING" | "REASONING" | null;
  selfExplainPrompted: boolean;
  cognitiveConflictStage: "EXTEND" | "TENSION" | "RESOLVE" | null;
  misconceptionResolved: boolean;
  isRevisitProbe: boolean;
}

interface ParseResult {
  cleanedText: string;
  tags: ParsedTags;
}

const TAG_PATTERNS = {
  mode: /\[MODE:\s*(comprehension|socratic)\]/i,
  topicThread: /\[TOPIC_THREAD:\s*([\s\S]+?)\]/i,
  genuineAttempt: /\[IS_GENUINE_ATTEMPT:\s*(true|false)\]/i,
  misconception: /\[MISCONCEPTION:\s*([\s\S]+?)\]/i,
  misconceptionCanonical: /\[MISCONCEPTION_CANONICAL:\s*([\s\S]+?)\]/i,
  misconceptionPassage: /\[MISCONCEPTION_PASSAGE:\s*([\s\S]+?)\]/i,
  misconceptionType: /\[MISCONCEPTION_TYPE:\s*([\s\S]+?)\]/i,
  misconceptionSeverity: /\[MISCONCEPTION_SEVERITY:\s*([\s\S]+?)\]/i,
  checkpointId: /\[CHECKPOINT_ID:\s*([\s\S]+?)\]/i,
  checkpointStatus: /\[CHECKPOINT_STATUS:\s*([\s\S]*?)\|([\s\S]+?)\]/i,
  directAnswer: /\[DIRECT_ANSWER:\s*([\s\S]+?)\]/i,
  questionType: /\[QTYPE:\s*(explain|predict|apply|distinguish|challenge|detect-error)\]/i,
  feedbackType: /\[FEEDBACK_TYPE:\s*(corrective|extension|redirection)\]/i,
  expertModel: /\[EXPERT_MODEL:\s*(OPENING|REASONING|true)\]/i,
  selfExplainPrompted: /\[SELF_EXPLAIN_PROMPTED:\s*true\]/i,
  cognitiveConflict: /\[COGNITIVE_CONFLICT:\s*(EXTEND|TENSION|RESOLVE|true)\]/i,
  misconceptionResolved: /\[MISCONCEPTION_RESOLVED:\s*true\]/i,
  softRevisit: /\[(SOFT_REVISIT|IS_REVISIT_PROBE):\s*true\]/i,
};

export function parseTags(rawText: string): ParseResult {
  const tags: ParsedTags = {
    mode: null,
    topicThread: null,
    isGenuineAttempt: null,
    misconception: null,
    directAnswer: null,
    questionType: null,
    feedbackType: null,
    expertModelType: null,
    selfExplainPrompted: false,
    cognitiveConflictStage: null,
    misconceptionResolved: false,
    isRevisitProbe: false,
  };

  const modeMatch = rawText.match(TAG_PATTERNS.mode);
  if (modeMatch) {
    tags.mode = modeMatch[1].toLowerCase() as ParsedTags["mode"];
  }

  const topicMatch = rawText.match(TAG_PATTERNS.topicThread);
  if (topicMatch) {
    tags.topicThread = topicMatch[1].trim();
  }

  const genuineMatch = rawText.match(TAG_PATTERNS.genuineAttempt);
  if (genuineMatch) {
    tags.isGenuineAttempt = genuineMatch[1].toLowerCase() === "true";
  }

  const misconceptionMatch = rawText.match(TAG_PATTERNS.misconception);
  if (misconceptionMatch) {
    tags.misconception = misconceptionMatch[1].trim();
  }

  const directAnswerMatch = rawText.match(TAG_PATTERNS.directAnswer);
  if (directAnswerMatch) {
    tags.directAnswer = directAnswerMatch[1].trim();
  }

  const qtypeMatch = rawText.match(TAG_PATTERNS.questionType);
  if (qtypeMatch) {
    tags.questionType = qtypeMatch[1].toLowerCase() as ParsedTags["questionType"];
  }

  const feedbackTypeMatch = rawText.match(TAG_PATTERNS.feedbackType);
  if (feedbackTypeMatch) {
    tags.feedbackType = feedbackTypeMatch[1].toLowerCase() as ParsedTags["feedbackType"];
  }

  const expertModelMatch = rawText.match(TAG_PATTERNS.expertModel);
  if (expertModelMatch) {
    const value = expertModelMatch[1].toUpperCase();
    tags.expertModelType =
      value === "TRUE" ? "REASONING" : (value as ParsedTags["expertModelType"]);
  }

  tags.selfExplainPrompted = TAG_PATTERNS.selfExplainPrompted.test(rawText);

  const cognitiveConflictMatch = rawText.match(TAG_PATTERNS.cognitiveConflict);
  if (cognitiveConflictMatch) {
    const value = cognitiveConflictMatch[1].toUpperCase();
    tags.cognitiveConflictStage =
      value === "TRUE"
        ? "EXTEND"
        : (value as ParsedTags["cognitiveConflictStage"]);
  }

  tags.misconceptionResolved = TAG_PATTERNS.misconceptionResolved.test(rawText);
  tags.isRevisitProbe = TAG_PATTERNS.softRevisit.test(rawText);

  const cleanedText = rawText
    .replace(/\[MODE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[TOPIC_THREAD:\s*[\s\S]*?\]/gi, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_CANONICAL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_PASSAGE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_SEVERITY:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_ID:\s*[\s\S]*?\]/gi, "")
    .replace(/\[CHECKPOINT_STATUS:\s*[\s\S]*?\]/gi, "")
    .replace(/\[DIRECT_ANSWER:\s*[\s\S]*?\]/gi, "")
    .replace(/\[QTYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[FEEDBACK_TYPE:\s*[\s\S]*?\]/gi, "")
    .replace(/\[EXPERT_MODEL:\s*[\s\S]*?\]/gi, "")
    .replace(/\[SELF_EXPLAIN_PROMPTED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[COGNITIVE_CONFLICT:\s*[\s\S]*?\]/gi, "")
    .replace(/\[MISCONCEPTION_RESOLVED:\s*[\s\S]*?\]/gi, "")
    .replace(/\[(SOFT_REVISIT|IS_REVISIT_PROBE):\s*[\s\S]*?\]/gi, "")
    .trim();

  return { cleanedText, tags };
}

export function computeNextAttemptState(
  previousTopic: string | null,
  previousAttemptCount: number,
  parsedTags: ParsedTags
): { newTopic: string | null; newAttemptCount: number } {
  const newTopic = parsedTags.topicThread ?? previousTopic;
  let count = 0;

  if (
    previousTopic &&
    newTopic &&
    previousTopic.toLowerCase() === newTopic.toLowerCase()
  ) {
    count = previousAttemptCount;
  }

  if (parsedTags.isGenuineAttempt) {
    count += 1;
  }

  return { newTopic, newAttemptCount: count };
}

export function extractConfidenceRating(
  rawText: string
): "very_confident" | "somewhat_confident" | "uncertain" | null {
  const lower = rawText.toLowerCase();

  if (
    lower.includes("not confident") ||
    lower.includes("uncertain") ||
    lower.includes("not sure") ||
    lower.includes("don't know") ||
    lower.includes("still uncertain")
  ) {
    return "uncertain";
  }

  if (
    lower.includes("very confident") ||
    lower.includes("extremely confident") ||
    lower.includes("super confident")
  ) {
    return "very_confident";
  }

  if (
    lower.includes("confident") ||
    lower.includes("somewhat") ||
    lower.includes("pretty") ||
    lower.includes("mostly")
  ) {
    return "somewhat_confident";
  }

  return null;
}

export function containsConfidencePrompt(rawText: string | null | undefined): boolean {
  if (!rawText) return false;

  const lower = rawText.toLowerCase();
  return (
    lower.includes("how confident do you feel") ||
    lower.includes("very confident, somewhat confident, or still uncertain") ||
    lower.includes("very confident, somewhat confident, or uncertain")
  );
}

export function isSubstantiveResponse(rawText: string | null | undefined): boolean {
  if (!rawText) return false;

  const trimmed = rawText.trim();
  if (trimmed.length < 20) return false;

  const lower = trimmed.toLowerCase();
  const shallowReplies = new Set([
    "yes",
    "no",
    "maybe",
    "i think so",
    "not sure",
    "i don't know",
    "ok",
    "okay",
  ]);

  return !shallowReplies.has(lower);
}
