# LGPD, Termos e Exclusão de Conta - #3301

Objetivo: validar base pública de privacidade antes do lançamento, garantindo
que usuários entendam o uso de dados e consigam excluir conta/dados.

## Estado atual observado

URLs públicas existentes em `web/public/`:

- `/terms_of_service.html`
- `/privacy_policy.html`
- `/delete_account.html`

Links no app web:

- Onboarding: links para Termos e Privacidade.
- Tela Sobre/About: links para Termos, Privacidade e Exclusão de Conta.
- Exclusão callable exposta em `web/src/services/cloudFunctions.ts`.

## Checklist de revisão

- [ ] Revisar texto legal com responsável jurídico/privacidade.
- [ ] Atualizar contato de privacidade para e-mail do domínio próprio quando
  #3299 estiver concluída.
- [ ] Confirmar que Termos e Privacidade citam Firebase/Auth/Firestore/Storage,
  Analytics/Crashlytics se ativos, logs e suporte.
- [ ] Confirmar base legal para CPF, CNPJ, localização, fotos e dados de jogo.
- [ ] Garantir que CPF/CNPJ nunca aparece em logs, suporte ou prints de teste.
- [ ] Validar links em onboarding, configurações/Sobre e URLs públicas.
- [ ] Testar exclusão no web desktop.
- [ ] Testar exclusão no web mobile.
- [ ] Confirmar resultado em Firebase Auth.
- [ ] Confirmar cleanup/anonymização em Firestore e Storage.
- [ ] Confirmar mensagem de sucesso e saída da sessão.
- [ ] Documentar evidência do teste sem dados pessoais reais.

## Fluxo de exclusão por e-mail

Canal recomendado após domínio próprio:
`privacidade@futebadosparcas.com.br`.

Triage:

1. Confirmar recebimento em até 2 dias úteis.
2. Validar titularidade por login ou confirmação segura de e-mail.
3. Priorizar autoatendimento quando o usuário ainda consegue acessar a conta.
4. Quando manual, executar procedimento interno com registro de ticket.
5. Confirmar conclusão em até 30 dias.
6. Nunca pedir CPF completo por e-mail.

## Dados pessoais e tratamento

| Dado | Uso | Observação LGPD |
| --- | --- | --- |
| Nome/apelido/e-mail | Conta, identificação e suporte | Exibir apenas o necessário. |
| CPF | Validação de identidade quando aplicável | Mascarar e manter algoritmos em sync nas 3 plataformas. |
| CNPJ/contato de quadra | Cadastro de quadras/monetização | Tratar como dado sensível operacional de negócio. |
| Foto/mídia | Perfil, grupos e jogos | Exigir exclusão junto com conta quando aplicável. |
| Localização | Próximos jogos/jogadores/quadras | Requer consentimento e opção de remoção. |
| Estatísticas/XP | Ranking e gamificação | Pode precisar anonimização quando histórico coletivo permanecer. |
| Logs técnicos | Segurança e diagnóstico | Não incluir PII nos payloads. |

## Pendências que podem virar código

- Trocar e-mails públicos para domínio próprio.
- Adicionar rodapé/link de suporte em landing pública se a campanha usar página
  fora do app autenticado.
- Criar exportação de dados se o roadmap LGPD exigir portabilidade além da
  exclusão.
- Automatizar relatório interno de cleanup da exclusão de conta.
