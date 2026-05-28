import { describe, it, expect } from "vitest";
import { difficultyInstruction, resolveLevel, DEFAULT_LEVEL } from "../scripts/lib/difficulty";

describe("resolveLevel", () => {
  it("null は中級(3)に丸める", () => {
    expect(resolveLevel(null)).toBe(DEFAULT_LEVEL);
    expect(DEFAULT_LEVEL).toBe(3);
  });
  it("範囲外も中級(3)に丸める", () => {
    expect(resolveLevel(0)).toBe(3);
    expect(resolveLevel(6)).toBe(3);
  });
  it("1〜5はそのまま", () => {
    expect(resolveLevel(1)).toBe(1);
    expect(resolveLevel(5)).toBe(5);
  });
});

describe("difficultyInstruction", () => {
  it("入門は『ITをほぼ知らない』向けの指示を含む", () => {
    expect(difficultyInstruction(1)).toContain("ITをほぼ知らない");
  });
  it("エキスパートは『研究者・上級エンジニア』向けの指示を含む", () => {
    expect(difficultyInstruction(5)).toContain("研究者・上級エンジニア");
  });
  it("null は中級の指示になる", () => {
    expect(difficultyInstruction(null)).toBe(difficultyInstruction(3));
  });
});
