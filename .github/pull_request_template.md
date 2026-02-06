## Descricao
<!-- O que essa PR faz? Qual problema resolve? -->

## Tipo de Mudanca

- [ ] Nova feature
- [ ] Bugfix
- [ ] Refatoracao
- [ ] Performance
- [ ] Documentacao
- [ ] CI/CD

## Spec Relacionada
<!-- Link para spec em /specs/ (obrigatorio para features e bugfixes) -->

specs/

## Checklist

### Codigo
- [ ] Codigo compila sem erros (`./gradlew compileDebugKotlin`)
- [ ] Testes passam (`./gradlew :app:testDebugUnitTest`)
- [ ] Lint passa (`./gradlew lint`)
- [ ] Detekt passa (`./gradlew detekt`)
- [ ] Sem `!!` operator desnecessario

### UI/UX (se aplicavel)
- [ ] Strings em `strings.xml` (sem hardcode)
- [ ] Cores do `MaterialTheme.colorScheme` (sem hardcode)
- [ ] `contentDescription` em icones interativos
- [ ] Touch targets >= 48dp
- [ ] Testado em tema claro e escuro

### Padroes do Projeto
- [ ] Comentarios em portugues (PT-BR)
- [ ] StateFlow para estados de UI (Loading, Success, Error, Empty)
- [ ] Jobs cancelados antes de iniciar novos
- [ ] `.catch {}` em Flow collections

## Screenshots (se UI)

**Antes:**


**Depois:**


## Testes
<!-- Como testar esta mudanca? Passos detalhados. -->

1.
2.
3.

## Notas Adicionais
<!-- Informacoes relevantes para os reviewers -->
