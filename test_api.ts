import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("Set ANTHROPIC_API_KEY before running this script.");
}

const anthropic = new Anthropic({ apiKey });

async function main() {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello, Claude" }],
    });
    console.log(JSON.stringify(msg, null, 2));
  } catch (error) {
    console.error("API ERROR:", error);
  }
}

main();
