import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-with-enough-length-for-hs256";
});

describe("auth tokens", () => {
  it("round-trips a payload through encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("@/lib/auth");
    const token = await encrypt({ userId: "u1", sessionId: "s1" });
    const payload = await decrypt(token);
    expect(payload.userId).toBe("u1");
    expect(payload.sessionId).toBe("s1");
  });
});

describe("security validators", () => {
  it("validates email addresses", async () => {
    const { validateEmail } = await import("@/lib/security");
    expect(validateEmail("test@example.com")).toBe(true);
    expect(validateEmail("invalid-email")).toBe(false);
  });

  it("validates password strength", async () => {
    const { validatePassword } = await import("@/lib/security");
    expect(validatePassword("StrongPass123!").valid).toBe(true);
    expect(validatePassword("weak").valid).toBe(false);
  });
});
