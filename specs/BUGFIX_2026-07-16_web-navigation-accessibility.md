# BUGFIX: Acessibilidade nas superfícies de navegação web

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3799, #3779, #3786, #3783, #3780

## 1. Problema

Cinco lacunas de acessibilidade afetam a navegação web: contraste insuficiente em
orientações visuais, ícones decorativos expostos a tecnologias assistivas, tabela
de atalhos sem cabeçalhos e contagem de notificações ausente do nome acessível do
botão “Mais” no rail intermediário.

## 2. Resultado esperado

- Textos informativos e o separador do breadcrumb usam `text.secondary`.
- Ícones decorativos e o logo redundante da top bar não são anunciados.
- A tabela de atalhos expõe cabeçalhos localizados com `scope="col"`.
- O botão “Mais” inclui a quantidade de notificações não lidas em seu nome
  acessível, sem alterar o rótulo quando a contagem é zero.

## 3. Design técnico e tarefas

1. Ajustar tokens de cor e semântica ARIA em `MobileTopBar` e `SearchPanel`.
2. Completar a semântica dos ícones e do botão “Mais” em `AppSidebar`.
3. Adicionar `TableHead` ao `ShortcutsDialog` e manter paridade pt-BR/en/es.
4. Cobrir os contratos com testes direcionados de componentes e i18n.
5. Executar testes direcionados, lint e build com Node 22.

## 4. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Mudança do nome acessível quebra automação | Testar contagens zero e positiva |
| Drift entre traduções | Executar os testes de paridade i18n |
| Ícone informativo ser ocultado | Ocultar somente ícones acompanhados por texto ou separadores |

## 5. Verificação

- [x] Testes direcionados passam (31 testes)
- [x] Paridade de traduções passa
- [x] Lint passa
- [x] Build passa
- [x] Diff permanece limitado às cinco issues

`npm run typecheck:test` continua falhando por erros preexistentes em testes fora
deste lote; nenhum erro aponta para os arquivos alterados aqui. O teste renderizado
do `SearchPanel` permanece em quarentena conforme #2330, portanto a correção de
contraste foi validada por lint e pelo build de produção sem reativar o hang do CI.
