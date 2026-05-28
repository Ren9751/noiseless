import type { Interest } from "./profile";

export function validateOnboardingInput(interests: Interest[], itLevel: number): void {
  if (!Array.isArray(interests) || interests.length === 0) {
    throw new Error("興味分野を1つ以上選んでください");
  }
  for (const i of interests) {
    if (typeof i.topic !== "string" || i.topic.trim() === "") {
      throw new Error("topic は空にできない");
    }
    if (!Number.isFinite(i.weight) || i.weight < 1 || i.weight > 10) {
      throw new Error("weight は 1〜10");
    }
  }
  if (!Number.isInteger(itLevel) || itLevel < 1 || itLevel > 5) {
    throw new Error("レベルは 1〜5");
  }
}
