## 📝 Descrição

## 🔢 Issue relacionada
Closes # (se aplicável)

## 🎯 Tipo de mudança
- [ ] 🐛 Bugfix
- [ ] ✨ Nova feature
- [ ] ♻️ Refatoração
- [ ] 📚 Documentação
- [ ] ⬆️ Dependências
- [ ] 🔒 Segurança
- [ ] ⚡ Performance

## 🖼️ Screenshots / Vídeos
| Mobile | Web |
|--------|-----|
|        |     |

## ✅ Checklist SDD (Spec-Driven Development)
- [ ] Spec aprovada em `/specs/` (STATUS: APPROVED)
- [ ] Fases completas: REQUIREMENTS → UX/UI → TECHNICAL → TASKS → IMPL → VERIFY
- [ ] Decisões registradas em `/specs/DECISIONS.md`

## ✅ Checklist Mobile
- [ ] Responsivo (phone portrait, landscape, tablet)
- [ ] Acessibilidade (contentDescription, touch targets >= 48dp)
- [ ] Performance (sem recomposições desnecessárias)
- [ ] Estados: Loading, Empty, Error, Success

## ✅ Checklist Web
- [ ] Responsivo (mobile-first, max-width 480px)
- [ ] Acessibilidade (aria-label, roles)
- [ ] Estados: Loading (Shimmer), Empty, Error, Success

## ✅ Checklist Geral
- [ ] Testes passando localmente (`./gradlew :app:testDebugUnitTest`)
- [ ] Build passando (`./gradlew :app:assembleDebug`)
- [ ] Lint passando (`./gradlew lint`, `./gradlew detekt`)
- [ ] Sem strings hardcoded
- [ ] Sem cores hardcoded (usar `MaterialTheme.colorScheme`)
- [ ] Código em português (PT-BR) para comentários
