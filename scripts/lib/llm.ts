import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY must be set");
}

export const anthropic = new Anthropic({ apiKey });

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
