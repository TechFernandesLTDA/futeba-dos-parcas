# Mobile Definition of Done (DoD) Checklist

> **Copie este checklist para o PR e marque cada item antes de solicitar review.**

---

## PR: #XXX - [Título]

### Spec e Documentação

- [ ] SPEC existe em `/specs/` e está linkada neste PR
- [ ] SPEC está com status `APPROVED` ou superior
- [ ] Decisões relevantes registradas em `DECISIONS.md`
- [ ] README/docs atualizados (se API pública mudou)

### Build e Qualidade

- [ ] `./gradlew assembleDebug` passa sem erros
- [ ] `./gradlew compileDebugKotlin` sem warnings novos
- [ ] `./gradlew lint` passa (ou issues justificadas)
- [ ] Sem `TODO` ou `FIXME` não trackeados em issue

### Código

- [ ] Segue padrões de arquitetura (MVVM, Clean Architecture)
- [ ] Strings em `strings.xml` (sem hardcode em Kotlin/Compose)
- [ ] Cores via `MaterialTheme.colorScheme.*` (sem hardcode)
- [ ] Imports organizados, código formatado
- [ ] Comentários em PT-BR onde necessário
- [ ] Sem código comentado ou morto

### Testes

- [ ] Testes unitários para lógica nova (ViewModel/UseCase)
- [ ] Testes de UI para fluxos críticos (se aplicável)
- [ ] Todos os testes passam: `./gradlew test`
- [ ] Cobertura adequada para mudanças

### UX/UI

- [ ] Testado em **Light Theme**
- [ ] Testado em **Dark Theme**
- [ ] Testado em **Phone Portrait**
- [ ] Testado em **Phone Landscape** (se aplicável)
- [ ] Testado em **Tablet** (se aplicável)
- [ ] Estados implementados: Loading, Empty, Error, Success

### Acessibilidade

- [ ] `contentDescription` em elementos interativos/imagens
- [ ] Touch targets >= 48dp
- [ ] Contraste >= 4.5:1 (verificado com `ContrastHelper`)
- [ ] Navegação por TalkBack funciona
- [ ] Ordem de foco lógica

### Performance

- [ ] Sem recomposições desnecessárias (usar `remember`, `key`)
- [ ] Listas usam `LazyColumn` com `key`
- [ ] Imagens otimizadas (tamanho, formato)
- [ ] Sem ANRs ou jank perceptível

### Offline e Erros

- [ ] Comportamento offline definido e implementado
- [ ] Retry automático ou manual para falhas de rede
- [ ] Mensagens de erro claras e acionáveis
- [ ] Não expõe detalhes técnicos ao usuário

### Segurança

- [ ] Sem tokens/secrets hardcoded
- [ ] Dados sensíveis em `EncryptedSharedPreferences`
- [ ] Validação de input (client-side)
- [ ] Firestore rules atualizadas (se necessário)
- [ ] Sem logs de PII (email, telefone, etc.)

### Analytics e Observabilidade

- [ ] Eventos de analytics implementados (conforme spec)
- [ ] Logs adequados (DEBUG para dev, sem PII)
- [ ] Crashlytics captura erros relevantes

### Release Readiness

- [ ] Version code incrementado (se for release)
- [ ] Changelog atualizado (se aplicável)
- [ ] Sem dependências SNAPSHOT
- [ ] ProGuard rules atualizadas (se necessário)

---

## Notas do Revisor

<!-- Espaço para comentários do code reviewer -->

---

## Aprovações

- [ ] Code Review aprovado
- [ ] QA validado (se aplicável)
- [ ] Pronto para merge

---

**Legenda:**
- ✅ = Completo
- ⬜ = Pendente
- N/A = Não aplicável (justificar)
