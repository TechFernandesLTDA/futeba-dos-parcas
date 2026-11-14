# Projeto de modernização do Futeba dos Parças

Data: 14/11/2026. Base lida: `master` em `658de9b2`. **É um documento de projeto: nenhum código de produção foi alterado.**

Pedido do Renan: repensar o produto inteiro, mais moderno, mais lógico e mais eficiente, para 1.000 usuários ou mais, em Android, web e iOS, com sistema pago pelos donos das quadras, onboarding completo de usuários e de donos de quadra, e gerenciamento de caixas e calendários por quadra.

## Resumo executivo

**Onde estamos.** O Futeba são três aplicativos (Android nativo, iOS em Compose Multiplatform, web em React) sobre um servidor Firebase sólido. A mesma regra está escrita duas ou três vezes; a web é a mais completa e o iOS a mais magra. O lado do dono de quadra já começou, mas pelo fim: existe a cobrança (conta comercial, ciclos, suspensão, comprovante) e não existe o que se cobraria (reserva, agenda, caixa da quadra). Hoje duas peladas podem marcar a mesma quadra no mesmo horário, o Pix do app é simulado, e o jogador novo passa por login, SMS e CPF antes de conseguir ver um jogo.

**Para onde vamos.** Um produto com três pilares (Jogos, Turmas, Quadras) e dois públicos. O jogador e o organizador usam de graça e chegam a "estou na lista" em 10 segundos, sem cadastro. A quadra paga por uma ferramenta de trabalho: agenda em que o mesmo horário nunca é vendido duas vezes, mensalistas, caixa que fecha, equipe com permissões e trilha de auditoria. Aparecer no mapa é grátis; gerenciar é pago.

**Como.** Manter Firebase e a pilha atual, reorganizando: toda escrita de agenda e de dinheiro passa pelo servidor, em transação; Android e iOS convergem para uma base só de telas e regras; o painel do dono nasce na web, onde o dono trabalha e onde a cobrança (Pix, cartão, boleto, com nota fiscal) fica fora das regras das lojas. Custo estimado de Firebase: de US$ 1 a 5 por mês com 1.000 usuários e 10 arenas; de US$ 25 a 40 com 10.000 usuários e 100 arenas.

**Em que ordem.** Duas trilhas em paralelo depois de uma fase curta de estabilização: a do celular (um domínio só → começo novo do jogador → uma base de telas) e a da quadra (agenda → caixa → plano). O primeiro marco de negócio é ter 5 arenas-piloto usando a agenda de verdade, de graça, antes de existir página de preços.

**O maior risco** não é técnico: é construir para o dono de quadra sem ter conversado com nenhum. O plano começa por 5 a 10 conversas.

## Índice

| Arquivo | Conteúdo |
|---|---|
| [`01-diagnostico.md`](01-diagnostico.md) | arquitetura por plataforma, o que é duplicado, dados e regras, Functions, custo, fluxos, o que já existe de quadra, caixa e cobrança, qualidade. Com `arquivo:linha` |
| [`02-produto-e-onboarding.md`](02-produto-e-onboarding.md) | personas, mapa do produto (o que fica, funde e sai), onboarding do jogador e do dono, tela a tela |
| [`03-dono-de-quadra-calendario-e-caixa.md`](03-dono-de-quadra-calendario-e-caixa.md) | regras de negócio e casos de borda da agenda (avulso, mensalista, bloqueio, espera, cancelamento, fuso) e do caixa (lançamentos, Pix, mensalidade, atraso, turno, despesas, relatórios, permissões, auditoria) |
| [`04-cobranca.md`](04-cobranca.md) | o que é grátis e pago, planos e faixas, anúncios e "Sem anúncios", web com provedor brasileiro × lojas, regras da Apple e do Google com links, dúvidas de interpretação |
| [`05-arquitetura-e-dados.md`](05-arquitetura-e-dados.md) | alternativas e recomendação, quanto compartilhar, modelo de dados novo, reserva sem dupla marcação, regras por papel, Functions, offline, notificações, privacidade, testes, custo com premissas |
| [`06-plano-de-fases-e-migracao.md`](06-plano-de-fases-e-migracao.md) | fases com objetivo, escopo, aceite, riscos, dependências e tamanho; migração de dados; lançamento e volta atrás por loja; métricas |

**Documentos anteriores nesta pasta** (04 e 05/11/2026): `ESSENCIA.md` (o que o app é, regra por regra), `DIAGNOSTICO.md` (bugs e dívidas), `PLANO.md` (ondas A a I, em grande parte já entregues) e `PENDENCIAS-EXTERNAS.md`. Continuam valendo como registro. Este projeto parte deles: mantém a decisão de pilha de então e as regras de execução (um passo por PR, teste antes, o novo ao lado do antigo), e amplia o alcance para o produto e para o lado da quadra.

## Como ler as marcações

- **[lido]**: está no código ou em documento do repositório, com `arquivo:linha` no diagnóstico.
- **[fonte]**: página oficial consultada em 14/11/2026, com link.
- **Proposta**: desenho recomendado.
- **[suposição]**: premissa não confirmada.
- **[dúvida]**: depende de interpretação jurídica ou da revisão das lojas.

## Oito conclusões

1. **Três bases de código para um produto que vai dobrar de tamanho não se sustentam.** Convergir Android e iOS para as mesmas telas e regras é o maior item do plano e o que mais reduz custo dali em diante.
2. **O lado da quadra precisa nascer pelo valor.** Hoje existe a cobrança sem o produto. Agenda e caixa vêm antes de qualquer página de preços.
3. **A dupla marcação se resolve com uma transação**, não com outro banco. A recomendação é a alternativa "chata": manter Firebase e reorganizar.
4. **O começo do jogador contraria a regra da casa.** Login, SMS e CPF antes de ver um jogo; no iOS, pedido de notificação ao abrir. A proposta inverte: presença por link como convidado, login depois.
5. **O painel do dono deve nascer só na web.** É onde ele trabalha e é o que mantém a venda do plano fora das regras de compra da Apple e do Google.
6. **Vender pela web custa de 4 a 15 vezes menos por pagamento** do que pela loja, e permite nota fiscal em nome da empresa.
7. **Custo de Firebase não é restrição nesta escala.** O que pode surpreender é SMS de verificação e vídeo, não leitura de banco.
8. **A quadra é cliente e canal ao mesmo tempo.** Uma arena com dezenas de turmas fixas alcança centenas de jogadores [suposição a validar].

## Decisões que são do Renan

| # | Decisão | Minha recomendação | Trava |
|---|---|---|---|
| 1 | **Modelo comercial**: aparecer no mapa é grátis e gerenciar é pago, ou continua "só aparece quem está em dia"? | Aparecer é grátis; pagar pela agenda e pelo caixa | F3, F5 |
| 2 | **Verificação por SMS e CPF** sai do caminho do jogador? | Sim. SMS só para organizador com caixa e para dono; CPF só para quem recebe dinheiro pelo app | F2 |
| 3 | **Presença como convidado**, por link, com login depois da primeira vitória? | Sim, com aprovação opcional pelo organizador e convidado sem XP, voto ou ranking | F2 |
| 4 | **Anúncios e "Sem anúncios"** | Manter os dois por enquanto. Sem anúncio na página de arena pagante. Rever quando a receita das quadras passar, por três meses, de um múltiplo da receita de anúncios que você definir | F5 |
| 5 | **Onde o dono usa e onde se vende o plano** | Painel só na web; venda só na web; nenhum preço, botão ou link de compra nos apps. App separado para quadras só se o piloto pedir | F3, F5 |
| 6 | **Provedor de pagamento** do plano | Teste curto com Asaas e Efí; escolher por qualidade dos avisos, nota fiscal integrada e subcontas. No piloto, o caminho manual que já existe basta | F5 |
| 7 | **Planos e preços** | Piloto gratuito de 60 a 90 dias com 5 a 10 arenas; só depois fixar preço. Faixas de partida no `04`, seção 3 | F5 |
| 8 | **"Caixa por quadra"**: caixa da arena com marcação por quadra, ou um caixa separado para cada quadra? | Caixa da arena, com relatório por quadra e mais de um ponto de caixa quando precisar | F4 |
| 9 | **Recursos candidatos a sair** (mensagens diretas, feed, seguidores, time dos sonhos, elencos favoritos, desafios, caronas, enquetes, vídeos de jogo) | Parar de investir neles agora; decidir o corte com 30 dias de dados de uso | F8 |
| 10 | **Pilha** | Manter Firebase, KMP e React. Convergir Android e iOS para o código comum. Não reescrever | F1, F6 |
| 11 | **Jogador pedir e pagar a quadra pelo app** | Adiar. Decidir depois do piloto; sem taxa para o jogador | F7 |
| 12 | **Jurídico e contador**: termos do plano, contrato de tratamento de dados, nota fiscal, enquadramento de pagamentos | Contratar a revisão antes da primeira arena pagante; começar a conversa na F0 | F5, F7 |
| 13 | **Tarefas agendadas novas** no servidor (estender séries, gerar mensalidades, expirar pedidos, verificador) e **instância aquecida** para o painel | Autorizar as quatro tarefas; instância aquecida só se a latência do piloto incomodar | F3, F4 |
| 14 | **Login no iPhone** com Google e com Apple | Sim | F2 |
| 15 | **Versão mínima suportada** (tela "Atualize para continuar") | Sim, com janela de compatibilidade a cada mudança de regra | F3 |
| 16 | **Conversar com 5 a 10 donos de quadra** antes de construir | Fazer na F0. É o que mais reduz risco | F3 |

Decisões abertas do `PLANO.md` de 04/11 (D1 a D18) continuam com ele; este projeto não as reabre.

## O que ficou sem verificar

- **Uso real**: usuários ativos, turmas, arenas cadastradas, uso de cada recurso, receita de anúncios, assinantes de "Sem anúncios". Não consultei produção nem o Analytics.
- **Fatura real** do Firebase, orçamentos no Google Cloud e o que está de fato implantado.
- **Situação nas lojas** e a causa da tela branca na partida e do cartão de login cortado.
- **Preços regionais** do Firestore em São Paulo, valor do SMS para o Brasil e custo de instância aquecida.
- **Concorrentes** (sistemas de gestão de quadra) e quanto um dono pagaria.
- **Como donos de quadra trabalham hoje.** Tudo o que o `03` propõe como padrão é ponto de partida.
- **Interpretações de política de loja, fiscais e de LGPD**: listadas como dúvidas no `04`, seção 10.
- **Custo real de migrar uma tela** do Android para o código comum: a Fase 1 mede.
- Nada foi compilado, testado ou executado. As contagens vêm de `find`, `grep` e `wc`.
