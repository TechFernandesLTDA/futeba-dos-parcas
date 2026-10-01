/**
 * Testes do util stripUndefinedValues (FIX #4147).
 *
 * Garante que a remoção de undefined não destrói as sentinelas/classes do
 * SDK: FieldValue.serverTimestamp() deve continuar FieldValue (não {}),
 * Timestamp deve continuar Timestamp (não mapa {_seconds,_nanoseconds}) e
 * GeoPoint deve continuar GeoPoint (não mapa {_latitude,_longitude}).
 */

import {FieldValue, GeoPoint, Timestamp} from "firebase-admin/firestore";
import {stripUndefinedValues} from "../src/utils/strip-undefined";

describe("stripUndefinedValues (#4147)", () => {
  it("preserva FieldValue.serverTimestamp() como sentinela, não {}",
    () => {
      const sentinela = FieldValue.serverTimestamp();
      const payload = {
        updated_at: sentinela,
        nested: {cancelled_at: sentinela},
      };

      const resultado = stripUndefinedValues(payload);

      expect(resultado.updated_at).toBe(sentinela);
      expect((resultado.nested as Record<string, unknown>).cancelled_at)
        .toBe(sentinela);
    });

  it("preserva FieldValue.increment() como sentinela", () => {
    const inc = FieldValue.increment(1);
    const resultado = stripUndefinedValues({unread_count: inc});

    expect(resultado.unread_count).toBe(inc);
  });

  it("preserva Timestamp como instância, não mapa _seconds/_nanoseconds",
    () => {
      const ts = Timestamp.fromDate(new Date("2026-07-07T20:00:00Z"));
      const resultado = stripUndefinedValues({
        dateTime: ts,
        lista: [ts],
      });

      expect(resultado.dateTime).toBe(ts);
      expect(resultado.dateTime).toBeInstanceOf(Timestamp);
      expect((resultado.lista as unknown[])[0]).toBe(ts);
    });

  it("preserva GeoPoint como instância, não mapa _latitude/_longitude",
    () => {
      const ponto = new GeoPoint(-30.0346, -51.2177);
      const resultado = stripUndefinedValues({coordinates: ponto});

      expect(resultado.coordinates).toBe(ponto);
      expect(resultado.coordinates).toBeInstanceOf(GeoPoint);
    });

  it("remove undefined de objetos e arrays aninhados", () => {
    const resultado = stripUndefinedValues({
      a: undefined,
      b: 1,
      c: {d: undefined, e: "ok"},
      f: ["ok", undefined, {g: undefined, h: 2}],
      i: null,
    });

    expect(resultado).toEqual({
      b: 1,
      c: {e: "ok"},
      f: ["ok", {h: 2}],
      i: null,
    });
  });

  it("mantém valores primitivos e null intactos", () => {
    expect(stripUndefinedValues(undefined)).toBeUndefined();
    expect(stripUndefinedValues(null)).toBeNull();
    expect(stripUndefinedValues(5)).toBe(5);
    expect(stripUndefinedValues("x")).toBe("x");
    expect(stripUndefinedValues(false)).toBe(false);
  });
});