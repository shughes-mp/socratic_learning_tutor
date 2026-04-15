import type { SessionPurpose } from "@/types";

export const SESSION_PURPOSES: SessionPurpose[] = [
  "pre_class",
  "during_class_prep",
  "during_class_reflection",
  "after_class",
];

export type SessionPurposeOption = {
  value: SessionPurpose;
  label: string;
  shortLabel: string;
  description: string;
  cognitiveLevel: string;
};

export const SESSION_PURPOSE_OPTIONS: SessionPurposeOption[] = [
  {
    value: "pre_class",
    label: "Pre-class",
    shortLabel: "Pre-class",
    description:
      "Assess readiness. Resolve gaps so students arrive prepared.",
    cognitiveLevel: "Comprehension",
  },
  {
    value: "during_class_prep",
    label: "During class (prep)",
    shortLabel: "In-class Prep",
    description:
      "Activate prior knowledge. Retrieve and connect before applying.",
    cognitiveLevel: "Activation",
  },
  {
    value: "during_class_reflection",
    label: "During class (reflect)",
    shortLabel: "In-class Reflection",
    description:
      "Consolidate learning. Self-explain and retrieve before closing.",
    cognitiveLevel: "Consolidation",
  },
  {
    value: "after_class",
    label: "After class",
    shortLabel: "After Class",
    description: "Deepen and transfer. Apply learning to novel contexts.",
    cognitiveLevel: "Transfer",
  },
];

export function isValidSessionPurpose(value: unknown): value is SessionPurpose {
  return typeof value === "string" && SESSION_PURPOSES.includes(value as SessionPurpose);
}

export function normalizeSessionPurpose(value: unknown): SessionPurpose {
  return isValidSessionPurpose(value) ? value : "pre_class";
}

export function getSessionPurposeOption(purpose: string | null | undefined) {
  const normalized = normalizeSessionPurpose(purpose);
  return (
    SESSION_PURPOSE_OPTIONS.find((option) => option.value === normalized) ??
    SESSION_PURPOSE_OPTIONS[0]
  );
}

export function getSessionPurposeBadgeClasses(
  purpose: string | null | undefined
): string {
  switch (normalizeSessionPurpose(purpose)) {
    case "pre_class":
      return "bg-[rgba(17,120,144,0.10)] text-[var(--teal)]";
    case "during_class_prep":
      return "bg-[rgba(144,111,18,0.10)] text-[#906f12]";
    case "during_class_reflection":
      return "bg-[rgba(123,92,255,0.10)] text-[#5d4ad1]";
    case "after_class":
      return "bg-[rgba(96,140,34,0.12)] text-[#5b7f22]";
  }
}

export function getHeatmapTitle(purpose: string | null | undefined) {
  switch (normalizeSessionPurpose(purpose)) {
    case "pre_class":
      return "Readiness Heatmap";
    case "during_class_prep":
      return "Activation Heatmap";
    case "during_class_reflection":
      return "Consolidation Heatmap";
    case "after_class":
      return "Transfer Heatmap";
  }
}
