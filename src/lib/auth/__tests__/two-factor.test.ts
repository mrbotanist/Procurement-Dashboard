import { describe, expect, it } from "vitest";
import { generateCode, hashCode, hashesMatch, maskEmail, normalizeCode, requiresTwoFactor, twoFactorScope } from "../two-factor";

describe("two-factor scope", () => {
  it("is off unless set", () => {
    for (const v of [undefined, "", "off", "0", "false", " none "]) expect(twoFactorScope(v)).toBe("none");
    expect(requiresTwoFactor("ADMIN", undefined)).toBe(false);
  });
  it("applies to everyone with all/on", () => {
    expect(requiresTwoFactor("WAREHOUSE", "all")).toBe(true);
    expect(requiresTwoFactor("MANAGEMENT", "ON")).toBe(true);
  });
  it("applies to listed roles only", () => {
    expect(twoFactorScope("admin, finance")).toEqual(["ADMIN", "FINANCE"]);
    expect(requiresTwoFactor("ADMIN", "ADMIN,FINANCE")).toBe(true);
    expect(requiresTwoFactor("FINANCE", "ADMIN FINANCE")).toBe(true);
    expect(requiresTwoFactor("WAREHOUSE", "ADMIN,FINANCE")).toBe(false);
  });
});

describe("codes", () => {
  it("are 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it("normalizes typed input", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
    expect(normalizeCode("12345")).toBeNull();
    expect(normalizeCode("12345a")).toBeNull();
  });
  it("hash is bound to secret and challenge", () => {
    const h = hashCode("s", "ch1", "123456");
    expect(hashesMatch(h, hashCode("s", "ch1", "123456"))).toBe(true);
    expect(hashesMatch(h, hashCode("s", "ch2", "123456"))).toBe(false);
    expect(hashesMatch(h, hashCode("t", "ch1", "123456"))).toBe(false);
    expect(hashesMatch(h, hashCode("s", "ch1", "123457"))).toBe(false);
    expect(hashesMatch(h, "")).toBe(false);
  });
  it("masks the email", () => {
    expect(maskEmail("rashid.khan@fpvstore.ae")).toBe("ra•••••••••@fpvstore.ae");
    expect(maskEmail("ab@x.io")).toBe("a•••@x.io");
  });
});
