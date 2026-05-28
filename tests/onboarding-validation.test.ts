import { describe, it, expect } from "vitest";
import { validateOnboardingInput } from "../app/lib/onboarding-validation";

const ok = [{ topic: "AI Safety", weight: 7 }];

describe("validateOnboardingInput", () => {
  it("興味が0件なら例外", () => {
    expect(() => validateOnboardingInput([], 3)).toThrow();
  });
  it("レベルが範囲外なら例外", () => {
    expect(() => validateOnboardingInput(ok, 0)).toThrow();
    expect(() => validateOnboardingInput(ok, 6)).toThrow();
  });
  it("レベルが整数でなければ例外", () => {
    expect(() => validateOnboardingInput(ok, 2.5)).toThrow();
  });
  it("topic が空なら例外", () => {
    expect(() => validateOnboardingInput([{ topic: "  ", weight: 7 }], 3)).toThrow();
  });
  it("正常入力は例外を投げない", () => {
    expect(() => validateOnboardingInput(ok, 3)).not.toThrow();
  });
});
