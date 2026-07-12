# Fusos e horários de funcionamento dos locais

O documento `locations/{locationId}` usa `time_zone` como identificador IANA do
fuso civil do local, por exemplo `America/Sao_Paulo`. O modelo Web converte esse
campo para `Location.timeZone`.

## Contrato de funcionamento

- O instante recebido é absoluto e sempre é convertido para o fuso do local.
- `operating_days` usa segunda-feira `1` até domingo `7`.
- Uma faixa comum, como `08:00–23:00`, pertence ao mesmo dia.
- Uma faixa overnight, como `22:00–02:00`, pertence ao dia em que abre. Assim,
  terça-feira às 01:30 usa a configuração de segunda; segunda às 01:30 usa a
  configuração de domingo.
- Os limites de abertura e fechamento são inclusivos.
- Fuso IANA, horários ou dias explicitamente inválidos resultam em local fechado.
- Somente documentos legados com `time_zone` ausente ou vazio usam o fallback
  temporário `America/Sao_Paulo`.

`isLocationOpenAt` em `web/src/types/location.ts` é a fonte única usada tanto por
`isOpenNow` quanto pelos filtros e cards do mapa.

## Backfill

O backfill é idempotente e roda em dry-run por padrão:

```bash
npm run backfill:location-timezones
```

Depois de revisar a lista e configurar Application Default Credentials, aplique:

```bash
npm run backfill:location-timezones:execute -- --project futebadosparcas
```

O script preenche apenas valores ausentes, nulos ou vazios. Valores IANA já
válidos são preservados; valores explicitamente inválidos são listados para
revisão manual e não são sobrescritos por suposição.
