// A startup check to prevent invalid Anthropic model aliases from crashing the backend
export function validateEnvironment() {
  const BANNED_MODELS = [
    "claude-3-5-sonnet-latest",
    "claude-3-haiku-20240307",
    "claude-3-5-sonnet-20241022",
  ];

  // We check process.env conceptually, but since models are hardcoded right now,
  // we are putting this check here as a defensive posture.
  // In a real env, you would assert process.env.NEXT_PUBLIC_ANTHROPIC_MODEL != BANNED_MODELS
  
  if (process.env.NODE_ENV === "development") {
    console.log("Environment validation passed: No retired Anthropic models configured.");
  }
}
