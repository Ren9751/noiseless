import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Anthropic クライアントを遅延生成する。
// import した瞬間ではなく、実際に使う瞬間にキーを検証する。
// （ビルド時にはキーが無いので、import時にthrowするとビルドが落ちるため）
export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY must be set");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
