# Decision Log - Futeba dos Parças

Registro de decisões técnicas e de produto. Cada entrada deve ter contexto, alternativas consideradas e justificativa.

---

## Template de Decisão

```markdown
### [YYYY-MM-DD] Título da Decisão

**Contexto:** Por que essa decisão foi necessária?

**Alternativas consideradas:**
1. Opção A - prós/contras
2. Opção B - prós/contras

**Decisão:** O que foi decidido?

**Justificativa:** Por que essa opção?

**Consequências:** Impactos esperados, trade-offs aceitos.

**Relacionado:** Links para specs, PRs, issues.
```

---

## Decisões Registradas

### [2025-01-20] Adoção de Spec-Driven Development (SDD)

**Contexto:** O projeto precisa de um processo mais rigoroso para garantir qualidade, evitar retrabalho e documentar decisões.

**Alternativas consideradas:**
1. Continuar sem processo formal - rápido mas propenso a bugs e retrabalho
2. Adotar SDD completo - mais estruturado, documenta decisões
3. Usar apenas issues do GitHub - menos overhead mas sem templates padronizados

**Decisão:** Adotar SDD com fases obrigatórias (Requirements → UX/UI → Technical → Tasks → Implementation → Verify).

**Justificativa:** Garante que todas as features tenham consideração de UX, estados, offline, acessibilidade e testes antes de implementar.

**Consequências:**
- (+) Menos retrabalho por requisitos mal definidos
- (+) Documentação viva do sistema
- (-) Overhead inicial para features simples
- Trade-off aceito: simplicidade vs. qualidade

**Relacionado:** `/specs/README.md`, `CLAUDE.md`

---

### [2026-02-01] iOS Development via Kotlin Multiplatform + Compose Multiplatform

**Contexto:** O app precisa expandir para iOS. Três opções foram avaliadas para a UI.

**Alternativas consideradas:**
1. **SwiftUI Nativo** - Reuso ~70% (só lógica), requer aprender Swift, UI nativa
2. **Compose Multiplatform** - Reuso ~95% (UI + lógica), Kotlin único, LLM-friendly
3. **React Native/Expo** - Reescrita completa, JavaScript/TypeScript

**Decisão:** Usar Compose Multiplatform para UI + Kotlin Multiplatform para lógica.

**Justificativa:**
1. **LLM Optimization**: Uma única linguagem (Kotlin) para toda a codebase facilita geração de código, refatorações e debugging com IA
2. **Reuso máximo**: Telas Compose existentes podem ser adaptadas com mínimo esforço
3. **Investimento estratégico**: Compose Multiplatform é o caminho recomendado pelo Google/JetBrains
4. **Infraestrutura existente**: 85 arquivos em commonMain já prontos

**Consequências:**
- (+) Desenvolvimento 50% mais rápido que SwiftUI nativo
- (+) Manutenção centralizada
- (+) Consistência de UX entre plataformas
- (-) Widgets iOS requerem SwiftUI separado
- (-) Algumas APIs iOS precisam de bridges Swift

**Relacionado:** `/specs/SPEC_IOS_KMP_DEVELOPMENT.md`

---

### [2026-02-01] Remoção de ACCESS_BACKGROUND_LOCATION (v1.7.2)

**Contexto:** Google Play exige vídeo demonstrativo para apps com background location. O feature de check-in automático via geofence NÃO está implementado - apenas check-in manual.

**Alternativas consideradas:**
1. **Gravar vídeo** - Mas feature não existe ainda
2. **Remover permissão** - Manter apenas foreground location
3. **Implementar geofence rapidamente** - Risco de bugs, atrasar release

**Decisão:** Remover ACCESS_BACKGROUND_LOCATION e documentar roadmap para implementação futura.

**Justificativa:**
- Check-in atual é MANUAL (jogador abre app → clica botão → GPS valida)
- Sem geofence implementado, permissão era desnecessária
- Evita problemas com Google Play Review

**Consequências:**
- (+) Release imediata possível
- (+) Menor escrutínio do Play Store
- (-) Check-in automático adiado para v1.8.0+

**Relacionado:** `/specs/ROADMAP_BACKGROUND_LOCATION.md`, AndroidManifest.xml

---

<!-- Adicione novas decisões acima desta linha -->
