# CLAUDE DOCS - Índice Master

> Documentação completa do Futeba dos Parças para uso com LLMs/IDE.
> Gerado em: 2025-01-10

---

## SUMÁRIO EXECUTIVO

**App:** Futeba dos Parças
**Versão:** 1.4.2 (versionCode: 15)
**Stack:** Kotlin 2.0 + Jetpack Compose (híbrido XML) + Firebase + Hilt + KMP
**Arquitetura:** MVVM + Clean Architecture

**Documentos gerados:** 15 arquivos
**Localização:** `.claude/`

---

## DOCUMENTOS POR CATEGORIA

### 📋 CONHECIMENTO (START AQUI)

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **PROJECT_MAP.md** | Mapa completo do projeto | Primeira leitura |
| **ARCHITECTURE.md** | Arquitetura detalhada | Entender estrutura |
| **README.md** | Setup e comandos | Configurar ambiente |

### 📐 REGRAS E PADRÕES

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **RULES.md** | Regras completas de desenvolvimento | Referência completa |
| **RULES_SHORT.md** | Regras resumidas | Consulta rápida |
| **DEVELOPMENT_PLAYBOOK.md** | Como trabalhar e revisar | Fluxo diário |

### ✅ QUALIDADE

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **QUALITY_GATES.md** | Portas de qualidade | Validar PR |
| **TESTING_STRATEGY.md** | Estratégia de testes | Escrever testes |
| **VALIDATION_LOOP.md** | Pipeline de validação | Rodar checks |

### 🔒 SEGURANÇA E OBSERVAÇÃO

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **SECURITY_PRIVACY.md** | Segurança e privacidade | Revisar segurança |
| **OBSERVABILITY.md** | Logs, métricas, crash | Debug e monitoramento |

### 🚀 PLANEJAMENTO

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| **MIGRATION_MODERN_UI.md** | Plano Compose/iOS | Roadmap UI |
| **PR_PLAN.md** | Plano de PRs incrementais | Sequência de mudanças |
| **AI_PROMPT_TEMPLATE.md** | Template para pedir à IA | Solicitar mudanças |

---

## FLUXO SUGERIDO DE LEITURA

### Para Novo Desenvolvedor

```
1. README.md           → Setup e primeiros passos
2. PROJECT_MAP.md      → Entender o projeto
3. RULES_SHORT.md      → Regras essenciais
4. ARCHITECTURE.md      → Estrutura técnica
5. DEVELOPMENT_PLAYBOOK.md → Como trabalhar
```

### Para Pedir Mudança à IA

```
1. RULES_SHORT.md      → Revisar regras
2. AI_PROMPT_TEMPLATE.md → Copiar template
3. Preencher com seu caso
4. Solicitar mudança
```

### Para Code Review

```
1. QUALITY_GATES.md    → Checklist de qualidade
2. RULES.md            → Regras completas
3. TESTING_STRATEGY.md → Se testes adequados
```

---

## ÁRVORE DE ARQUIVOS

```
.claude/
├── INDEX.md                    ← Este arquivo
│
├── CONHECIMENTO
│   ├── PROJECT_MAP.md
│   ├── ARCHITECTURE.md
│   └── README.md
│
├── REGRAS
│   ├── RULES.md
│   ├── RULES_SHORT.md
│   └── DEVELOPMENT_PLAYBOOK.md
│
├── QUALIDADE
│   ├── QUALITY_GATES.md
│   ├── TESTING_STRATEGY.md
│   └── VALIDATION_LOOP.md
│
├── SEGURANÇA
│   ├── SECURITY_PRIVACY.md
│   └── OBSERVABILITY.md
│
└── PLANEJAMENTO
    ├── MIGRATION_MODERN_UI.md
    ├── PR_PLAN.md
    └── AI_PROMPT_TEMPLATE.md
```

---

## COMANDOS RÁPIDOS

### Validação Local
```bash
./gradlew compileDebugKotlin test lint
```

### Build Debug
```bash
./gradlew assembleDebug
```

### Instalar
```bash
./gradlew installDebug
```

### Testes
```bash
./gradlew test
```

---

## RESUMO DESCOBERTA

### Nome do App
**Confirmado:** Futeba dos Parças
- Package: `com.futebadosparcas`
- Versão: 1.4.2 (15)
- Nome no launcher: "Futeba dos Parças"

### Stack Android
- **UI:** Híbrida XML (38 fragments) + Compose (33 screens)
- **Arquitetura:** MVVM + Clean Architecture
- **DI:** Hilt (Dagger)
- **Navegação:** Android Navigation Component (XML)
- **Modularização:** app + shared (KMP)

### Stack iOS
- **Status:** Preparação KMP em andamento
- **iOS targets:** iosX64, iosArm64, iosSimulatorArm64
- **Sem código nativo iOS ainda**

### Fluxos Principais
1. **Autenticação:** Login → MainActivity → Home
2. **Jogos:** Games → Detail → Live → MVP Vote
3. **Liga:** League → Ranking → Divisões
4. **Grupos:** Groups → Detail → Cashbox
5. **Locais:** Map → Locations → Manage

### Hotspots
- Coexistência XML + Compose (cuidado ao migrar)
- Job tracking em ViewModels (memory leaks)
- Firestore batching (limite de 10)
- Strings hardcoded (violates rule)
- KMP migration intermediária (respeitar comentários)

---

## ATUALIZAÇÕES FUTURAS

### Próximas Versões Destes Docs

- Atualizar após migração Compose
- Atualizar quando iOS iniciar
- Revisar PRs após conclusão
- Ajustar métricas de qualidade

### Manter Sincronizado

- Quando versionCode mudar → atualizar PROJECT_MAP.md
- Quando nova feature → atualizar PROJECT_MAP.md
- Quando regra mudar → atualizar RULES.md
- Quando segurança → atualizar SECURITY_PRIVACY.md

---

## SUPORTE

Para dúvidas sobre:
- **Código:** Ver DEVELOPMENT_PLAYBOOK.md
- **Arquitetura:** Ver ARCHITECTURE.md
- **Regras:** Ver RULES.md
- **Pedir mudança:** Usar AI_PROMPT_TEMPLATE.md

---

## LICENSA

Documentação interna do projeto Futeba dos Parças.
Desenvolvido por Renan Locatiz Fernandes © 2024-2025
