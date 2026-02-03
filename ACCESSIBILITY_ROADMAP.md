# 🎯 Roadmap de Acessibilidade - 865 Issues

**Status:** 📋 PLANEJADO
**Prioridade:** P2 (Desejável, não bloqueante)
**Estimativa:** 20-30 horas (gradual)

---

## 📊 SITUAÇÃO ATUAL

**Total de Issues:** 865

### Breakdown por Tipo

| Tipo | Quantidade | Severidade | Estimativa |
|------|------------|------------|------------|
| Icons sem contentDescription | 611 | 🔴 Alta | 15h |
| Images sem contentDescription | 85 | 🔴 Alta | 3h |
| Clickables sem semantics | 169 | 🟡 Média | 5h |
| **TOTAL** | **865** | - | **23h** |

---

## 🚨 IMPACTO

### Google Play Store
- ⚠️ **Compliance:** Pode resultar em rejeição do app
- ⚠️ **Acessibilidade:** Usuários com deficiência visual não conseguem usar
- ⚠️ **Rating:** Pode afetar avaliações (acessibilidade é critério)

### Legislação
- ✅ **WCAG 2.1 Level AA:** Requerido para compliance
- ✅ **Lei Brasileira de Inclusão (LBI):** Aplicativos públicos devem ser acessíveis

---

## 📋 ESTRATÉGIA DE CORREÇÃO

### Fase 1: Componentes Críticos (Semana 1-2)

**Foco:** Telas principais e fluxos críticos

**Arquivos prioritários:**
1. `ui/home/HomeScreen.kt` (tela inicial)
2. `ui/games/GamesListScreen.kt` (lista de jogos)
3. `ui/games/GameDetailsScreen.kt` (detalhes)
4. `ui/profile/ProfileScreen.kt` (perfil)
5. `ui/groups/GroupsScreen.kt` (grupos)

**Ações:**
- ✅ Adicionar contentDescription em todos os Icons
- ✅ Adicionar semantics em todos os Clickables
- ✅ Testar com TalkBack (leitor de tela Android)

**Estimativa:** 8 horas

---

### Fase 2: Componentes Reutilizáveis (Semana 3)

**Foco:** Design system e componentes compartilhados

**Arquivos prioritários:**
1. `ui/components/cards/*.kt` (todos os cards)
2. `ui/components/design/AppTopBars.kt`
3. `ui/components/modern/*.kt` (componentes modernos)
4. `ui/components/CachedAsyncImage.kt`
5. `ui/components/avatar/*.kt`

**Ações:**
- ✅ Parametrizar contentDescription nos componentes
- ✅ Adicionar defaults inteligentes
- ✅ Documentar uso correto

**Estimativa:** 6 horas

---

### Fase 3: Telas Secundárias (Semana 4)

**Foco:** Telas menos acessadas mas importantes

**Arquivos:**
1. `ui/statistics/*.kt`
2. `ui/locations/*.kt`
3. `ui/cashbox/*.kt`
4. `ui/notifications/*.kt`
5. `ui/debug/*.kt`

**Estimativa:** 5 horas

---

### Fase 4: Validação e Testes (Semana 5)

**Ações:**
1. ✅ Executar Accessibility Scanner do Android
2. ✅ Testar com TalkBack ativo (toda navegação)
3. ✅ Testar com Switch Access (controle por botões)
4. ✅ Validar contraste de cores (WCAG AA)
5. ✅ Testar touch targets (mínimo 48dp)

**Estimativa:** 4 horas

---

## 🛠️ FERRAMENTAS E SCRIPTS

### 1. Script Automatizado (Parcial)

```bash
# Gerar report de Icons sem contentDescription
./scripts/fix-accessibility.sh --dry-run

# Aplicar fixes automáticos (onde possível)
./scripts/fix-accessibility.sh
```

**Limitações:**
- Script adiciona strings.xml
- Modificação manual do código Kotlin ainda necessária

### 2. Android Lint

```bash
# Executar lint com foco em accessibility
./gradlew lint

# Gerar relatório HTML
open app/build/reports/lint-results.html
```

### 3. Accessibility Scanner (Google)

**Instalação:**
1. Baixar: [Accessibility Scanner](https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor)
2. Instalar no device/emulator
3. Abrir app e escanear telas

**Relatórios:**
- Touch target size
- Text contrast
- Content descriptions
- Clickable spans

---

## 📝 PADRÕES ESTABELECIDOS

### Padrão 1: Icons com Ação

```kotlin
// ANTES (ERRADO):
Icon(Icons.Default.Settings)

// DEPOIS (CORRETO):
Icon(
    imageVector = Icons.Default.Settings,
    contentDescription = stringResource(R.string.cd_settings)
)
```

### Padrão 2: Icons Decorativos

```kotlin
// Para ícones puramente decorativos (sem ação)
Icon(
    imageVector = Icons.Default.Star,
    contentDescription = null  // OK se meramente decorativo
)
```

### Padrão 3: Images com Contexto

```kotlin
// Foto de perfil
AsyncImage(
    model = user.photoUrl,
    contentDescription = stringResource(R.string.cd_profile_photo_of, user.name)
)
```

### Padrão 4: Clickables com Semântica

```kotlin
// ANTES (ERRADO):
Row(modifier = Modifier.clickable { onClick() }) { }

// DEPOIS (CORRETO):
Row(
    modifier = Modifier
        .clickable(
            onClickLabel = stringResource(R.string.action_view_details)
        ) { onClick() }
        .semantics {
            role = Role.Button
            contentDescription = stringResource(R.string.cd_game_card)
        }
) { }
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Por Tela

- [ ] Todos os Icons têm contentDescription ou null (se decorativo)
- [ ] Todas as Images têm contentDescription descritivo
- [ ] Todos os Clickables têm role e onClickLabel
- [ ] Contraste de texto >= 4.5:1 (WCAG AA)
- [ ] Touch targets >= 48dp × 48dp
- [ ] Navegação funciona com TalkBack
- [ ] Navegação funciona com Switch Access

### Por Componente Reutilizável

- [ ] ContentDescription parametrizável
- [ ] Default inteligente se não fornecido
- [ ] KDoc explicando uso correto
- [ ] Exemplo no Preview

---

## 🎯 PRIORIZAÇÃO

### P0 - Crítico (Fazer Agora)
- Telas de autenticação (Login, Register)
- Tela inicial (Home)
- Criar/visualizar jogo

### P1 - Importante (Semana 1-2)
- Perfil de usuário
- Grupos
- Rankings
- Notificações

### P2 - Desejável (Semana 3-5)
- Estatísticas avançadas
- Configurações
- Debug screens
- Admin panels

---

## 📊 MÉTRICAS DE SUCESSO

| Métrica | Antes | Meta | Verificação |
|---------|-------|------|-------------|
| Icons sem CD | 611 | 0 | Lint check |
| Images sem CD | 85 | 0 | Lint check |
| Clickables sem semantics | 169 | 0 | Manual |
| TalkBack navigation | ❌ | ✅ | Manual |
| Accessibility Scanner | 865 issues | 0 issues | Scanner |
| WCAG AA compliance | 60% | 100% | Audit |

---

## 📚 RECURSOS

### Documentação Oficial
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
- [Compose Accessibility](https://developer.android.com/jetpack/compose/accessibility)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### Ferramentas
- [Accessibility Scanner](https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor)
- [TalkBack](https://support.google.com/accessibility/android/answer/6283677)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Exemplos
- [Material 3 Accessibility](https://m3.material.io/foundations/accessible-design/overview)
- [Jetpack Compose Samples](https://github.com/android/compose-samples)

---

## 📞 CONTATO

**Dúvidas ou sugestões:**
- Consultar: `CLAUDE.md` (regra #5 - Mobile DoD)
- Spec relacionada: `.claude/rules/compose-patterns.md`

---

**Última Atualização:** 2026-02-03
**Owner:** Tech Team
**Status:** 📋 Roadmap Aprovado
