# Landing e Campanha de Pré-Lançamento - #3314

Objetivo: preparar material mínimo para explicar o Futeba dos Parças a donos de
pelada, jogadores e quadras, sem bloquear a frente técnica nem construir uma
landing grande antes da decisão de domínio.

## Mensagem central

Organizar pelada sem bagunça: grupo, jogo, confirmação, times e ranking em um
lugar só.

## Landing mínima

Primeira versão deve ser simples e acionável:

- Proposta clara para organizadores: menos planilha, menos cobrança manual,
  menos confusão no grupo.
- CTA principal: entrar/criar grupo.
- CTA secundário: falar com suporte ou entrar na lista de espera.
- Prints ou vídeo curto do fluxo principal.
- Links para Termos, Privacidade, Exclusão de Conta e Suporte.
- Domínio final do produto quando #3299 estiver concluída.

Implementação atual: rota React pública `/launch`, usando asset local
`/logo.png`, CTA para cadastro, suporte temporário e links legais.

## Roteiro de vídeo curto

Duração: 20 a 35 segundos.

1. Problema: "Sua pelada ainda depende de mensagem perdida no grupo?"
2. Criar grupo no Futeba dos Parças.
3. Criar jogo com data/local.
4. Jogadores confirmam presença.
5. Organizador acompanha lista e times.
6. Fecho: "Organize sua pelada sem bagunça."

Formato:

- 9:16 para Reels/TikTok/Shorts.
- Legendas queimadas.
- Sem dados reais de usuários.
- CTA final com domínio oficial.

## Plano de posts

| Dia | Canal | Conteúdo | CTA |
| --- | --- | --- | --- |
| D-14 | Instagram/Reels | Dor do organizador: lista perdida e confirmação manual | Entrar no beta/lista. |
| D-10 | TikTok/Reels | Demonstração em 30s do fluxo criar jogo -> confirmar | Criar grupo. |
| D-7 | Instagram carrossel | 5 sinais de que sua pelada precisa se organizar | Falar com suporte. |
| D-3 | WhatsApp/organizers | Convite direto para donos de pelada | Testar com o grupo. |
| D0 | Todos | Lançamento público | Acessar domínio oficial. |
| D+7 | Instagram | Caso real ou depoimento beta | Criar grupo. |

## Parcerias com quadras/organizadores

Abordagem:

- Priorizar 5 a 10 quadras ou organizadores que já têm recorrência semanal.
- Oferecer onboarding assistido de 15 minutos.
- Pedir feedback sobre criação de jogo, presença, comunicação e ranking.
- Mapear interesse em recursos de quadra, mensalidade e recibos para roadmap,
  sem prometer prazo.

Mensagem curta:

> O Futeba dos Parças ajuda seu grupo a organizar jogo, confirmação e ranking em
> um só lugar. Estamos abrindo um beta controlado e queremos testar com grupos
> reais por 2 semanas. Posso te ajudar a criar o primeiro grupo?

## Pendências externas

- Atualizar e-mails e links oficiais após a decisão de domínio.
- Apontar o domínio oficial para a rota/SPA após DNS e Firebase Hosting.
- Produzir vídeo curto com dados fictícios ou conta de demonstração marcada.
