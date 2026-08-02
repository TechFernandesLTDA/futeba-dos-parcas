# Política de Segurança

## Reportando vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, **não abra uma issue pública**. Entre em contato diretamente pelo e-mail:

**[support@futebadosparcas.com](mailto:support@futebadosparcas.com)**

Inclua o máximo de informações possível para nos ajudar a reproduzir e entender o problema:
- Descrição detalhada da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestões de mitigação (se houver)

### Criptografia
Se desejar enviar informações sensíveis de forma segura, utilize nossa chave PGP:

**Fingerprint:** `XXXX XXXX XXXX XXXX XXXX  XXXX XXXX XXXX XXXX XXXX`
**Chave pública:** https://futebadosparcas.com.br/pgp-key.asc

## SLA (Service Level Agreement)

| Severidade | Tempo de resposta | Tempo de correção |
|------------|-------------------|-------------------|
| Crítica | 24 horas | 72 horas |
| Alta | 48 horas | 7 dias |
| Média | 1 semana | 30 dias |
| Baixa | 2 semanas | Próximo release |

## Programa de Recompensas
Atualmente não oferecemos recompensas financeiras, mas todo relato válido receberá:
- Crédito público no README e changelog
- Badge exclusivo "Security Researcher" no app (se aplicável)

## Escopo

O programa de segurança cobre:

| Componente | Escopo |
|------------|--------|
| App Android (Kotlin/Compose) | ✅ Dentro do escopo |
| App Web (React/TypeScript) | ✅ Dentro do escopo |
| Cloud Functions (Firebase) | ✅ Dentro do escopo |
| Firestore Security Rules | ✅ Dentro do escopo |
| Firebase Hosting | ✅ Dentro do escopo |
| Site estático (`futebadosparcas.com.br`) | ✅ Dentro do escopo |
| Dependências de terceiros | ❌ Fora do escopo |

## Processo de resposta

1. **Confirmação**: Responderemos em até 48 horas confirmando o recebimento.
2. **Análise**: Nossa equipe investigará a vulnerabilidade e determinará o impacto.
3. **Correção**: Uma vez validada, trabalharemos em uma correção.
4. **Divulgação**: Após a correção ser publicada, divulgaremos a vulnerabilidade de forma responsável.
5. **Crédito**: Com seu consentimento, daremos crédito público pelo relato.

## Versões suportadas

Apenas a versão mais recente do app recebe correções de segurança.

| Versão | Suporte |
|--------|---------|
| Última release (Play Store / App Store) | ✅ Suportada |
| Versões beta | ✅ Suportada |
| Versões anteriores | ❌ Não suportadas |

## Práticas de segurança do projeto

- Utilizamos **Firebase App Check** para proteção contra uso não autorizado
- Utilizamos **Firebase Custom Claims** para autorização baseada em roles
- Seguimos o princípio do **menor privilégio** nas Firestore Security Rules
- Todas as Cloud Functions sensíveis passam por **rate limiting**
- Segredos e chaves **nunca** são commitados no repositório

### Análise estática (SAST)

- **Semgrep** roda automaticamente em PRs que tocam superfícies TypeScript (`functions/**`, `web/**`), além de um scan semanal agendado. Rulesets: `p/typescript`, `p/react`, `p/owasp-top-ten`, `p/secrets`, `p/javascript`.
- Os resultados são publicados como SARIF na aba **Security** do repositório. Atualmente o scan é **report-only** (não bloqueia o build) — será endurecido conforme o ruído baixar.
- Workflow: [`.github/workflows/semgrep.yml`](.github/workflows/semgrep.yml).
- **CodeQL** complementa o Semgrep com análise de fluxo de dados em JavaScript/TypeScript ([`.github/workflows/codeql.yml`](.github/workflows/codeql.yml)).
