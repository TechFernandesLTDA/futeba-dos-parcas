import {hashCnpj, isValidCnpj, maskCnpj, stripCnpj} from "../src/validation/cnpj";
import {hashCpf} from "../src/validation/cpf";

describe("CNPJ validator", () => {
  describe("isValidCnpj", () => {
    it("accepts valid CNPJs (formatted and raw)", () => {
      expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
      expect(isValidCnpj("11222333000181")).toBe(true);
      expect(isValidCnpj("12.345.678/0001-95")).toBe(true);
    });

    it("accepts valid CNPJ with leading zeros", () => {
      expect(isValidCnpj("00.000.000/0001-91")).toBe(true);
      expect(isValidCnpj("00000000000191")).toBe(true);
    });

    it("rejects CNPJs with wrong check digit", () => {
      expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
      expect(isValidCnpj("12.345.678/0001-00")).toBe(false);
    });

    it("rejects all-equal digit sequences", () => {
      expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
      expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
      expect(isValidCnpj("99999999999999")).toBe(false);
    });

    it("rejects null/undefined/empty", () => {
      expect(isValidCnpj(null)).toBe(false);
      expect(isValidCnpj(undefined)).toBe(false);
      expect(isValidCnpj("")).toBe(false);
    });

    it("rejects wrong length", () => {
      expect(isValidCnpj("123")).toBe(false);
      expect(isValidCnpj("112223330001811")).toBe(false);
      // CPF valido nao e CNPJ
      expect(isValidCnpj("11144477735")).toBe(false);
    });

    it("rejects non-string", () => {
      expect(isValidCnpj(11222333000181 as unknown as string)).toBe(false);
    });

    it("ignores non-digit characters while validating", () => {
      expect(isValidCnpj("11-222-333.0001/81")).toBe(true);
      expect(isValidCnpj("11 222 333 0001 81")).toBe(true);
    });
  });

  describe("hashCnpj", () => {
    it("returns deterministic hash for same input", () => {
      const h1 = hashCnpj("11.222.333/0001-81", "salt-test");
      const h2 = hashCnpj("11222333000181", "salt-test");
      expect(h1).toBe(h2);
    });

    it("different salt produces different hash", () => {
      const h1 = hashCnpj("11222333000181", "salt-a");
      const h2 = hashCnpj("11222333000181", "salt-b");
      expect(h1).not.toBe(h2);
    });

    it("returns 64-char hex string (SHA-256)", () => {
      const h = hashCnpj("11222333000181", "salt");
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });

    it("domain prefix prevents cross-domain collision with CPF hashes", () => {
      // Mesmo payload de digitos + mesmo salt NAO pode colidir entre
      // cpf_index e cnpj_index (decisao #1311: reuso do CPF_SALT).
      const digits = "11222333000181";
      expect(hashCnpj(digits, "salt")).not.toBe(hashCpf(digits, "salt"));
    });
  });

  describe("maskCnpj", () => {
    it("shows only the 4 branch digits", () => {
      expect(maskCnpj("11222333000181")).toBe("**.***.***/0001-**");
      expect(maskCnpj("11.222.333/0001-81")).toBe("**.***.***/0001-**");
    });

    it("returns *** for invalid length", () => {
      expect(maskCnpj("123")).toBe("***");
    });
  });

  describe("stripCnpj", () => {
    it("removes mask characters", () => {
      expect(stripCnpj("11.222.333/0001-81")).toBe("11222333000181");
      expect(stripCnpj("11-222-333.0001/81")).toBe("11222333000181");
    });
  });
});
