/**
 * #4112 / #4113 — lista canônica de coleções pertencentes a um uid,
 * compartilhada por account-merge.ts e account-cleanup.ts.
 */
import {
  ANONYMIZED_USER_NAME,
  CASHBOX,
  MONTHLY_PAYERS,
  POST_GAME_REPUTATION,
  UID_OWNED_COLLECTIONS,
  redactNameInText,
  sumNumericCounters,
} from "../../src/auth/uid-owned-collections";

describe("UID_OWNED_COLLECTIONS", () => {
  const byName = new Map(UID_OWNED_COLLECTIONS.map((entry) => [entry.collection, entry]));

  test("não tem coleções duplicadas", () => {
    expect(byName.size).toBe(UID_OWNED_COLLECTIONS.length);
  });

  test.each([
    "statistics",
    "xp_logs",
    "user_badges",
    "season_participation",
    "mvp_votes",
    "activities",
  ])("gamificação %s é tratada pelo merge E pelo cleanup (#4112)", (name) => {
    const entry = byName.get(name);
    expect(entry).toBeDefined();
    expect(entry?.merge).not.toBe("none");
    expect(entry?.cleanup).not.toBe("none");
  });

  test.each([
    ["groups", ["owner_name"]],
    ["groups/{groupId}/members", ["user_name", "user_photo_url", "user_photo"]],
    ["group_invites", ["invited_by_name"]],
    // cashbox/callable.ts:430-436 (quem lançou + jogador pagador) e a
    // descrição livre que pode repetir o nome do pagador.
    ["groups/{groupId}/cashbox", ["created_by_name", "player_name", "description"]],
    // reputation/post-game-reputation.ts:488-493 (os dois lados).
    [
      "post_game_reputation",
      ["reviewer_name", "reviewer_photo", "target_user_name", "target_user_photo"],
    ],
    // cashbox/monthly.ts:1286-1296.
    [
      "groups/{groupId}/monthly_finance_periods/{periodKey}/payers",
      ["user_name", "user_photo_url"],
    ],
  ])("%s declara a PII real do escritor (#4113)", (name, pii) => {
    expect(byName.get(name)?.piiFields).toEqual(expect.arrayContaining(pii));
  });

  test("financeiro do pagador: cashbox (player_id) e payers são anonimizados no cleanup", () => {
    const cashbox = byName.get("groups/{groupId}/cashbox");
    expect(cashbox?.uidFields).toEqual(expect.arrayContaining(["created_by", "player_id"]));
    expect(cashbox?.cleanup).toBe("anonymize");

    const payers = byName.get("groups/{groupId}/monthly_finance_periods/{periodKey}/payers");
    expect(payers?.uidFields).toEqual(["user_id"]);
    expect(payers?.docIdScheme).toBe("{uid}");
    expect(payers?.cleanup).toBe("anonymize");
  });

  test("helpers de caminho do financeiro batem com os escritores (escopo COLLECTION)", () => {
    expect(CASHBOX.path("g1")).toBe("groups/g1/cashbox");
    expect(MONTHLY_PAYERS.periodsPath("g1")).toBe("groups/g1/monthly_finance_periods");
    expect(MONTHLY_PAYERS.path("g1", "2026-08", "u1"))
      .toBe("groups/g1/monthly_finance_periods/2026-08/payers/u1");
  });

  test("post_game_reputation: dois campos de uid, anonimizada e não migrada (#4113)", () => {
    const entry = byName.get("post_game_reputation");
    expect(entry?.uidFields).toEqual(["reviewer_id", "target_user_id"]);
    expect(entry?.docIdScheme).toBe("{gameId}_{reviewerId}_{targetUserId}");
    expect(entry?.cleanup).toBe("anonymize");
    expect(entry?.merge).toBe("none");
    // Mesmo valor vazio de foto que o escritor grava (`?? ""`).
    expect(POST_GAME_REPUTATION.emptyPhoto).toBe("");
    expect(CASHBOX.descriptionField).toBe("description");
  });

  test("activities não declara campos de alvo sem escritor (#1968)", () => {
    expect(byName.get("activities")?.uidFields).toEqual(["user_id"]);
  });

  test("todo registro aponta o escritor verificado", () => {
    for (const entry of UID_OWNED_COLLECTIONS) {
      expect(entry.writer.length).toBeGreaterThan(0);
    }
  });
});

describe("sumNumericCounters", () => {
  test("soma presentes nos dois lados e copia os de um lado só", () => {
    expect(sumNumericCounters(
      {points: 9, wins: 3, goals_scored: 5},
      {points: 3, wins: 1, assists: 2},
      ["points", "wins", "goals_scored", "assists", "mvp_count"],
    )).toEqual({points: 12, wins: 4, goals_scored: 5, assists: 2});
  });

  test("ignora valores não numéricos (sentinels, NaN, strings)", () => {
    expect(sumNumericCounters(
      {points: Number.NaN, wins: "3"},
      {points: 4, wins: {increment: 1}},
      ["points", "wins"],
    )).toEqual({points: 4});
  });
});

describe("redactNameInText (#4113 — descrição do caixa)", () => {
  test("substitui o nome como palavra inteira, preservando o resto do texto", () => {
    expect(redactNameInText("Pagamento de Fulano da Silva", "Fulano da Silva"))
      .toBe(`Pagamento de ${ANONYMIZED_USER_NAME}`);
  });

  test("letras acentuadas contam como parte da palavra", () => {
    expect(redactNameInText("Pix do João Conceição — agosto", "João Conceição"))
      .toBe(`Pix do ${ANONYMIZED_USER_NAME} — agosto`);
    // "Joã" não é palavra inteira dentro de "João".
    expect(redactNameInText("Pix do João", "Joã")).toBe("Pix do João");
    // Acento colado ao fim não é fronteira: "Anaí" não contém a palavra "Ana".
    expect(redactNameInText("Anaí pagou", "Ana")).toBe("Anaí pagou");
    // Pontuação e início/fim do texto são fronteiras.
    expect(redactNameInText("Ana, Ana. (Ana)", "Ana"))
      .toBe(`${ANONYMIZED_USER_NAME}, ${ANONYMIZED_USER_NAME}. (${ANONYMIZED_USER_NAME})`);
  });

  test("substring dentro de outra palavra não é substituída", () => {
    expect(redactNameInText("Banana e Ananias", "Ana")).toBe("Banana e Ananias");
    expect(redactNameInText("Mariana pagou", "Mari")).toBe("Mariana pagou");
  });

  test("substitui múltiplas ocorrências, sem diferenciar maiúsculas", () => {
    expect(redactNameInText("Beto pagou; BETO deve; beto ok", "Beto"))
      .toBe(`${ANONYMIZED_USER_NAME} pagou; ${ANONYMIZED_USER_NAME} deve; ${ANONYMIZED_USER_NAME} ok`);
    expect(redactNameInText("pix de JOÃO", "joão")).toBe(`pix de ${ANONYMIZED_USER_NAME}`);
  });

  test("nomes com menos de 3 caracteres (após trim) não são substituídos", () => {
    expect(redactNameInText("Zé pagou o Zé", "Zé")).toBe("Zé pagou o Zé");
    expect(redactNameInText("Lu pagou", "  Lu  ")).toBe("Lu pagou");
    expect(redactNameInText("qualquer texto", "   ")).toBe("qualquer texto");
    // 3 caracteres já substitui.
    expect(redactNameInText("Léo pagou", "Léo")).toBe(`${ANONYMIZED_USER_NAME} pagou`);
  });

  test("escapa caracteres especiais de regex no nome", () => {
    expect(redactNameInText("Pagamento de Jr. (Beto)+ ok", "Jr. (Beto)+"))
      .toBe(`Pagamento de ${ANONYMIZED_USER_NAME} ok`);
    // `.` do nome não vira curinga.
    expect(redactNameInText("Pagamento de JrX Beto", "Jr. Beto")).toBe("Pagamento de JrX Beto");
    // `$&` no substituto não é interpretado.
    expect(redactNameInText("Oi Beto", "Beto", "$&$&")).toBe("Oi $&$&");
  });

  test("espaços internos do nome casam com qualquer sequência de espaços", () => {
    expect(redactNameInText("Pagamento de Fulano  da\tSilva", " Fulano da Silva "))
      .toBe(`Pagamento de ${ANONYMIZED_USER_NAME}`);
  });

  test("compara em NFC (nome decomposto casa com texto composto)", () => {
    const decomposed = "Joa\u0303o"; // "João" em NFD
    expect(redactNameInText("Pix do João", decomposed)).toBe(`Pix do ${ANONYMIZED_USER_NAME}`);
  });

  test("sem ocorrência devolve o texto original intacto", () => {
    const text = "Mensalidade agosto";
    expect(redactNameInText(text, "Fulano da Silva")).toBe(text);
  });
});
