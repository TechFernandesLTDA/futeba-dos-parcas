import {hashCpf, isValidCpf, maskCpf, stripCpf} from "../src/validation/cpf";

describe("CPF validator", () => {
  describe("isValidCpf", () => {
    it("accepts valid CPFs (formatted and raw)", () => {
      expect(isValidCpf("111.444.777-35")).toBe(true);
      expect(isValidCpf("11144477735")).toBe(true);
      expect(isValidCpf("123.456.789-09")).toBe(true);
    });

    it("rejects CPFs with wrong check digit", () => {
      expect(isValidCpf("111.444.777-36")).toBe(false);
      expect(isValidCpf("123.456.789-00")).toBe(false);
    });

    it("rejects all-equal digit sequences", () => {
      expect(isValidCpf("000.000.000-00")).toBe(false);
      expect(isValidCpf("111.111.111-11")).toBe(false);
      expect(isValidCpf("999.999.999-99")).toBe(false);
    });

    it("rejects null/undefined/empty", () => {
      expect(isValidCpf(null)).toBe(false);
      expect(isValidCpf(undefined)).toBe(false);
      expect(isValidCpf("")).toBe(false);
    });

    it("rejects wrong length", () => {
      expect(isValidCpf("123")).toBe(false);
      expect(isValidCpf("123456789012")).toBe(false);
    });

    it("rejects non-string", () => {
      expect(isValidCpf(12345678901 as unknown as string)).toBe(false);
    });
  });

  describe("hashCpf", () => {
    it("returns deterministic hash for same input", () => {
      const h1 = hashCpf("111.444.777-35", "salt-test");
      const h2 = hashCpf("11144477735", "salt-test");
      expect(h1).toBe(h2);
    });

    it("different salt produces different hash", () => {
      const h1 = hashCpf("11144477735", "salt-a");
      const h2 = hashCpf("11144477735", "salt-b");
      expect(h1).not.toBe(h2);
    });

    it("returns 64-char hex string (SHA-256)", () => {
      const h = hashCpf("11144477735", "salt");
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("maskCpf", () => {
    it("hides first and last digits", () => {
      expect(maskCpf("11144477735")).toBe("***.444.777-**");
    });

    it("returns *** for invalid length", () => {
      expect(maskCpf("123")).toBe("***");
    });
  });

  describe("stripCpf", () => {
    it("removes mask chars", () => {
      expect(stripCpf("111.444.777-35")).toBe("11144477735");
      expect(stripCpf("111 444 777-35")).toBe("11144477735");
    });
  });
});
