# Suporte e Runbook de Incidentes - #3312

Objetivo: definir canal oficial de suporte, triagem por severidade, comunicação
com usuários e critérios de rollback/hotfix.

## Canal oficial

Até domínio próprio:

- Suporte público atual: `techfernandesltda@gmail.com`.

Após conclusão de #3299:

- Suporte: `suporte@futebadosparcas.com.br`.
- Privacidade/LGPD: `privacidade@futebadosparcas.com.br`.
- Parcerias: `contato@futebadosparcas.com.br`.

O app já possui links de suporte na tela Sobre/About. Ao trocar o domínio, revisar
links e textos públicos.

## Triage

| Severidade | Definição | Exemplos | Resposta |
| --- | --- | --- | --- |
| S0 | Serviço indisponível ou risco de dados | Login geral quebrado, exposição/perda de dados | Imediata. |
| S1 | Fluxo principal quebrado ou custo fora de controle | Criar jogo falha, confirmações não salvam, Billing dispara | Até 30 min. |
| S2 | Fluxo importante instável com workaround | Ranking atrasado, mídia falha para parte dos usuários | Até 4 h úteis. |
| S3 | Incômodo sem bloqueio | Texto, layout, dúvida simples | Próximo ciclo. |

## Checklist de incidente

- [ ] Abrir registro com horário, severidade, owner e impacto.
- [ ] Congelar deploys concorrentes se houver risco de piorar produção.
- [ ] Coletar sinais: logs Functions, Firestore, Hosting, Billing, Auth e
  feedbacks de suporte.
- [ ] Confirmar escopo: web, Android, iOS, Functions, regras, dados ou provedor.
- [ ] Decidir mitigação: comunicação, feature flag/config, hotfix forward ou
  rollback.
- [ ] Comunicar status inicial para suporte.
- [ ] Validar recuperação com smoke mínimo.
- [ ] Encerrar com causa, duração, impacto, ação preventiva e follow-ups.

## Critérios de rollback/hotfix

Rollback é recomendado quando:

- Uma release web/functions quebrou fluxo principal e a versão anterior é
  compatível com dados atuais.
- Não há migração irreversível ou mudança de schema bloqueando retorno.
- Hotfix demoraria mais que restaurar a versão anterior.

Hotfix forward é recomendado quando:

- Dados já foram gravados no formato novo.
- A falha é pequena e isolada.
- Reverter removeria correções importantes ou criaria drift de release.

## Comunicação de instabilidade

Template curto:

> Estamos investigando uma instabilidade no Futeba dos Parças que pode afetar
> [fluxo afetado]. Já identificamos um responsável e atualizaremos este canal até
> [horário]. Seus dados permanecem preservados.

Template de recuperação:

> A instabilidade em [fluxo afetado] foi mitigada às [horário]. Vamos continuar
> monitorando e registrar uma ação preventiva para evitar recorrência. Obrigado
> pela paciência.

Template de dados/privacidade:

> Recebemos sua solicitação de privacidade. Para proteger sua conta, vamos
> confirmar a titularidade antes de qualquer ação. Não envie CPF completo, senha
> ou códigos de acesso por e-mail.

## Smoke mínimo após mitigação

- [ ] Acessar app web no domínio oficial e em `web.app`.
- [ ] Fazer login.
- [ ] Abrir Sobre/About e links públicos.
- [ ] Criar ou abrir grupo.
- [ ] Criar jogo de teste ou validar fluxo equivalente em ambiente seguro.
- [ ] Confirmar presença.
- [ ] Verificar logs Functions por 30 minutos.
- [ ] Verificar Billing/Firestore se o incidente envolveu custo.
