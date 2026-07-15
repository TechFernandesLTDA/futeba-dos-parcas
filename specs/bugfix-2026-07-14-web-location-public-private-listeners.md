# BUGFIX: Evitar listeners privados no detalhe público de local

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex (issue #3689)
> **Data:** 2026-07-14
> **Issue:** #3689

## 1. Requisitos

`/location/:locationId` é uma rota pública. O documento do local deve continuar
visível sem login, mas as subcoleções `fields` e `reviews`, protegidas pelas
regras do Firestore, não podem ser consultadas por usuário anônimo.

### Comportamento esperado

- Anônimo lê apenas o documento público do local, sem listeners privados ou
  toast de permissão.
- A página oculta quadras, preços e avaliações privados e oferece CTA de login
  com retorno ao mesmo deep link.
- Usuário autenticado mantém os listeners e as seções atuais.

## 2. UX/UI

No lugar das seções privadas, o visitante anônimo vê um card conciso explicando
que login é necessário e um botão `Entrar`. Dados públicos (nome, endereço,
contato e comodidades do documento do local) permanecem visíveis.

## 3. Design técnico

Usar `user?.id` como dependência e condição dos efeitos que assinam
`locations/{id}/reviews` e `locations/{id}/fields`. Ao perder autenticação,
limpar os estados privados para impedir dados residuais. Não alterar regras nem
o listener do documento público.

## 4. Tarefas

- [x] Condicionar os dois listeners privados à autenticação.
- [x] Limpar estado privado quando não houver usuário.
- [x] Exibir CTA de login no estado anônimo.
- [x] Adicionar testes de componente para anônimo e autenticado.
- [x] Executar teste focal, lint e build web.

## 5. Verificação

- O teste anônimo deve observar apenas `locations/{id}` e nenhuma consulta a
  `fields`/`reviews`.
- O teste autenticado deve observar as três fontes e renderizar os dados
  privados.
- `npm run lint` e `npm run build` devem passar no Node 22.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Dados privados permanecerem após logout | Limpar `fields` e `reviews` no gate dos efeitos |
| Login perder o deep link | Enviar `redirect=/location/{id}` já suportado por `LoginScreen` |
| Regressão para usuários logados | Teste de componente cobre os listeners e o conteúdo autenticado |
