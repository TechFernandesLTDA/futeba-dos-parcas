# Política de Segurança

## Reportando vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, **não abra uma issue pública**. Entre em contato diretamente pelo email:

**[support@futebadosparcas.com](mailto:support@futebadosparcas.com)**

Inclua o máximo de informações possíveis para nos ajudar a reproduzir e entender o problema:
- Descrição detalhada da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestões de mitigação (se houver)

## Escopo

O programa de segurança cobre:

| Componente | Escopo |
|------------|--------|
| App Android (Kotlin/Compose) | ✅ Dentro do escopo |
| App Web (React/TypeScript) | ✅ Dentro do escopo |
| Cloud Functions (Firebase) | ✅ Dentro do escopo |
| Firestore Security Rules | ✅ Dentro do escopo |
| Firebase Hosting | ✅ Dentro do escopo |
| Site estático (`futebadosparcas.web.app`) | ✅ Dentro do escopo |
| Dependências de terceiros | ❌ Fora do escopo |

## Processo de resposta

1. **Confirmação**: Responderemos em até 48 horas confirmando o recebimento.
2. **Análise**: Nossa equipe investigará a vulnerabilidade e determinará o impacto.
3. **Correção**: Uma vez validada, trabalharemos em uma correção.
4. **Divulgação**: Após a correção ser publicada, divulgaremos a vulnerabilidade de forma responsável.
5. **Crédito**: Com seu consentimento, daremos crédito público pelo reporte.

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
