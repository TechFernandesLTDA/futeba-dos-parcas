import {
  hashPhoneIdentity,
  normalizePhoneE164,
} from "../src/validation/phone-identity";

describe("phone identity", () => {
  const secret = "identity-secret-with-enough-entropy";

  it("normaliza formatos brasileiros equivalentes", () => {
    expect(normalizePhoneE164("(11) 99999-9999")).toBe("+5511999999999");
    expect(normalizePhoneE164("+55 11 99999-9999")).toBe("+5511999999999");
  });

  it("produz o mesmo HMAC para formatos equivalentes", () => {
    expect(hashPhoneIdentity("(11) 99999-9999", secret)).toBe(
      hashPhoneIdentity("+55 11 99999-9999", secret),
    );
  });

  it("separa identidades de telefone diferentes", () => {
    expect(hashPhoneIdentity("+55 11 99999-9999", secret)).not.toBe(
      hashPhoneIdentity("+55 21 99999-9999", secret),
    );
  });

  it("rejeita telefone inválido", () => {
    expect(() => normalizePhoneE164("1234")).toThrow("Telefone inválido");
  });
});

