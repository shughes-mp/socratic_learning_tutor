import { prisma } from "./db";

const adjectives = [
  "coral", "silver", "amber", "crystal", "golden",
  "copper", "marble", "cobalt", "ivory", "scarlet",
  "cedar", "azure", "iron", "velvet", "granite",
];

const nouns = [
  "theorem", "prism", "orbit", "cipher", "quorum",
  "signal", "vector", "matrix", "helix", "nexus",
  "vertex", "axiom", "sigma", "delta", "epoch",
];

function generateCode(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90 + 10); // 10-99
  return `${adj}-${noun}-${num}`;
}

export async function generateUniqueAccessCode(): Promise<string> {
  let code = generateCode();
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    const existing = await prisma.session.findUnique({
      where: { accessCode: code },
    });
    if (!existing) return code;
    code = generateCode();
    attempts++;
  }

  // Extremely unlikely fallback — append timestamp
  return `${code}-${Date.now()}`;
}
