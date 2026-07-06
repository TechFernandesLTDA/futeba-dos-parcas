# Domínio Principal e E-mails - #3299

Objetivo: definir a presença pública oficial do Futeba dos Parças antes do
lançamento amplo, com domínio de produto, redirecionamentos e e-mails alinhados
à marca.

## Decisão operacional

Domínio recomendado para lançamento público: `futebadosparcas.com.br`.
Manter `https://futebadosparcas.web.app` como fallback técnico, preview e
rollback de comunicação. Candidatos/aliases aceitáveis:

| Opção | Uso recomendado | Observação |
| --- | --- | --- |
| `futebadosparcas.com.br` | Principal | Melhor aderência ao público brasileiro. |
| `futebadosparcas.com` | Alias global | Útil para proteção de marca e redirecionamento. |
| `app.futebadosparcas.com.br` | App web | Pode apontar para Firebase Hosting se o domínio raiz virar site institucional. |
| `techfernandes.com.br` | Institucional | Não deve ser o domínio principal do app público. |

Não usar `techfernandes.com.br` como domínio principal do app público.

## DNS e Firebase Hosting

Checklist externo:

- [ ] Registrar domínio escolhido e habilitar renovação automática.
- [ ] Adicionar domínio no Firebase Console > Hosting > Add custom domain.
- [ ] Criar registros TXT de verificação exatamente como fornecidos pelo
  Firebase.
- [ ] Criar registros A/AAAA ou CNAME conforme orientação do Firebase Hosting.
- [ ] Aguardar certificado SSL provisionado.
- [ ] Testar:
  - [ ] `https://futebadosparcas.com.br`
  - [ ] `https://www.futebadosparcas.com.br`
  - [ ] `https://app.futebadosparcas.com.br`, se adotado
  - [ ] `https://futebadosparcas.web.app`
- [ ] Documentar provedor DNS, conta responsável, data de expiração e contatos
  de recuperação em local seguro fora do repo.

## Redirecionamentos

Regra sugerida:

| Origem | Destino | Tipo |
| --- | --- | --- |
| `www.futebadosparcas.com.br` | `https://futebadosparcas.com.br` | 301 |
| `futebadosparcas.com` | `https://futebadosparcas.com.br` | 301 |
| `www.futebadosparcas.com` | `https://futebadosparcas.com.br` | 301 |
| `techfernandes.com.br/futeba` | `https://futebadosparcas.com.br` | 302 durante campanha, 301 depois |

O `web.app` pode continuar sem redirect obrigatório para preservar links
técnicos, preview e rollback de comunicação.

## E-mails oficiais

Endereços recomendados:

| Endereço | Uso |
| --- | --- |
| `suporte@futebadosparcas.com.br` | Canal oficial para usuários. |
| `privacidade@futebadosparcas.com.br` | Pedidos LGPD e exclusão por e-mail. |
| `noreply@futebadosparcas.com.br` | E-mails transacionais. Não usar para suporte. |
| `contato@futebadosparcas.com.br` | Parcerias, quadras e imprensa. |

Configuração mínima:

- [ ] SPF incluindo o provedor de e-mail/transacional.
- [ ] DKIM ativo para o domínio.
- [ ] DMARC iniciado em `p=none`, monitorado por 2 semanas, depois evoluir para
  `quarantine` quando os envios estiverem estáveis.
- [ ] Caixa de suporte com encaminhamento para responsáveis.
- [ ] Resposta automática de recebimento com prazo de atendimento.
- [ ] Play Console, App Store Connect, Firebase e páginas públicas atualizados
  com o e-mail oficial.

## Pontos que exigem código/configuração

- Firebase Hosting custom domain e redirects em `firebase.json`, se os redirects
  forem controlados pelo Hosting após DNS.
- Substituir `techfernandesltda@gmail.com` nas páginas públicas por e-mails do
  domínio próprio após as caixas existirem.
- Configurar provedor transacional quando houver envio ativo de e-mails pelo app.

## Evidência no app

- Landing pública: `/launch`.
- Termos: `/terms_of_service.html`.
- Privacidade: `/privacy_policy.html`.
- Exclusão de conta: `/delete_account.html`.
- Suporte temporário: `techfernandesltda@gmail.com`.
