interface ParsedTags {
  mode: "comprehension" | "socratic" | null;
  topicThread: string | null;
  isGenuineAttempt: boolean | null;
  misconception: string | null;
  directAnswer: string | null;
}

interface ParseResult {
  cleanedText: string;
  tags: ParsedTags;
}

export function parseTags(rawText: string): ParseResult {
  const tags: ParsedTags = {
    mode: null,
    topicThread: null,
    isGenuineAttempt: null,
    misconception: null,
    directAnswer: null,
  };

  // We extract tags via regex. Tags might be scattered or at the end.
  // The format is [KEY: value]
  const modeMatch = rawText.match(/\[MODE:\s*(comprehension|socratic)\]/i);
  if (modeMatch) tags.mode = modeMatch[1].toLowerCase() as "comprehension" | "socratic";

  const topicMatch = rawText.match(/\[TOPIC_THREAD:\s*(.+?)\]/i);
  if (topicMatch) tags.topicThread = topicMatch[1].trim();

  const genuineMatch = rawText.match(/\[IS_GENUINE_ATTEMPT:\s*(true|false)\]/i);
  if (genuineMatch) tags.isGenuineAttempt = genuineMatch[1].toLowerCase() === "true";

  const misconceptionMatch = rawText.match(/\[MISCONCEPTION:\s*(.+?)\]/i);
  if (misconceptionMatch) tags.misconception = misconceptionMatch[1].trim();

  const directAnswerMatch = rawText.match(/\[DIRECT_ANSWER:\s*(.+?)\]/i);
  if (directAnswerMatch) tags.directAnswer = directAnswerMatch[1].trim();

  // Strip all tags from the text to return to the student.
  // This regex matches [TAG_NAME: anything]
  const cleanedText = rawText
    .replace(/\[MODE:\s*.*?\]/ig, "")
    .replace(/\[TOPIC_THREAD:\s*.*?\]/ig, "")
    .replace(/\[IS_GENUINE_ATTEMPT:\s*.*?\]/ig, "")
    .replace(/\[MISCONCEPTION:\s*.*?\]/ig, "")
    .replace(/\[DIRECT_ANSWER:\s*.*?\]/ig, "")
    .trim();

  return { cleanedText, tags };
}

export function computeNextAttemptState(
  previousTopic: string | null,
  previousAttemptCount: number,
  parsedTags: ParsedTags
): { newTopic: string | null; newAttemptCount: number } {
  const newTopic = parsedTags.topicThread;

  // If topic changed or it's the first topic, attempt count resets to 0 (before checking if this interaction is a generic attempt)
  let count = 0;
  if (previousTopic && newTopic && previousTopic.toLowerCase() === newTopic.toLowerCase()) {
    count = previousAttemptCount;
  }

  // Increment if it was a genuine attempt
  if (parsedTags.isGenuineAttempt) {
    count += 1;
  }

  return { newTopic: newTopic || previousTopic, newAttemptCount: count };
}

export function extractConfidenceRating(rawText: string): "very_confident" | "somewhat_confident" | "uncertain" | null {
  const lower = rawText.toLowerCase();
  
  if (lower.includes("not confident") || lower.includes("uncertain") || lower.includes("not sure") || lower.includes("don't know")) {
    return "uncertain";
  }
  if (lower.includes("very confident") || lower.includes("extremely confident") || lower.includes("super confident")) {
    return "very_confident";
  }
  if (lower.includes("confident") || lower.includes("somewhat") || lower.includes("pretty") || lower.includes("mostly")) {
    return "somewhat_confident";
  }
  
  return null;
}
