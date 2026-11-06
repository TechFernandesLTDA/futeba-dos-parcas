# Pendências externas (05/11/2026)

O que falta para tudo estar publicado e que não depende de código nem de agente.

| # | Pendência | Depende de | Situação em 05/11 00:18 | O que fazer quando destravar |
|---|---|---|---|---|
| 1 | Android 1.42.0 na Play Store | Google (análise da versão) | Em "Alterações em análise". A página do app dá 404 porque nenhum país estava liberado antes; o Brasil foi adicionado nesta submissão. Publicação gerenciada desligada | Nada: entra no ar sozinho ao ser aprovado. Conferir `https://play.google.com/store/apps/details?id=com.futebadosparcas` (deve dar 200). Não rodar promoção de faixa antes da aprovação |
| 2 | Conta Apple Developer (empresa) | Apple (inscrição Q46823PX7Q, `admin@techfernandes.com.br`) | Em processamento. O Xcode só tem o Personal Team | Renan adiciona `admin@techfernandes.com.br` em Xcode → Settings → Accounts. Depois: configurar time, certificado de distribuição e perfil do iOS. Envio ao TestFlight/App Store só com OK do Renan |
| 3 | Fase 4 da modernização | Renan (aprovar `PLANO.md` e as decisões D1 a D18) | Aguardando | Começar pela Onda A (testes de caracterização), um passo por branch/PR |

Já publicado: web 1.61.1 (bundle `index-yBhpSZbQ.js`, igual ao master `5d9be25e`) e functions 1.15.1.

Acompanhamento: tarefa agendada da sessão (minuto 17 de cada hora, até 12/11/2026) checa só leitura o código HTTP da página do Play, o `teamType` do Xcode e a versão do web.
