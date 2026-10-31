// Fonte dos dados do prerender das páginas públicas (#4177, #4187).
// title/description/ogImage/canonical DEVEM ficar iguais a PUBLIC_ROUTE_METADATA em
// web/src/components/seo/metadata.ts — o teste src/components/seo/prerenderParity.test.ts
// falha se divergirem. Textos de produto só podem afirmar o que o código comprova.

export const SITE_URL = 'https://futebadosparcas.com.br';
export const SITE_NAME = 'Futeba dos Parças';
export const PARENT_ORG_NAME = 'Tech Fernandes LTDA';
export const PARENT_ORG_URL = 'https://techfernandes.com.br';
export const ATTRIBUTION = 'Um produto da Tech Fernandes.';

export const routes = [
  {
    path: '/organizar-pelada',
    title: `Como Organizar Pelada de Futebol: Guia Passo a Passo | ${SITE_NAME}`,
    description:
      'Checklist completo para organizar peladas sem confusão: confirmação de presença, sorteio de times equilibrados, vagas e lista de espera.',
    ogImage: `${SITE_URL}/og/og-organizar-pelada.png`,
    breadcrumb: 'Como Organizar Pelada',
    contentHeading: 'Como Organizar uma Pelada Sem Confusão no Grupo',
    contentLead:
      'Chega de listas infinitas de WhatsApp, mensagens apagadas, gente que fura na hora do jogo e times desequilibrados. Aprenda o passo a passo para gerenciar confirmações, sorteio e finanças com tranquilidade.',
    chip: 'GUIA COMPLETO DE ORGANIZAÇÃO',
    sections: [
      {
        title: '1. Confirmação com vagas e lista de espera',
        text: 'Defina o número de vagas do jogo. Quando alguém cancela, o primeiro da lista de espera é avisado e tem 30 minutos para confirmar.',
      },
      {
        title: '2. Lembretes de confirmação',
        text: 'O app envia lembretes a quem ainda não confirmou presença, 24 horas e 2 horas antes do jogo.',
      },
      {
        title: '3. Sorteio equilibrado',
        text: 'O sorteio equilibrado divide os times pelo nível de cada jogador, trata os goleiros à parte e mostra se os times ficaram equilibrados.',
      },
    ],
  },
  {
    path: '/ranking-futebol-amador',
    title: `Ranking de Futebol Amador: Estatísticas, Artilharia e MVP | ${SITE_NAME}`,
    description:
      'Como criar e gerenciar o ranking da sua pelada: XP por presença, gols, assistências e defesas, e votação de MVP, melhor goleiro e bola murcha.',
    ogImage: `${SITE_URL}/og/og-ranking-futebol-amador.png`,
    breadcrumb: 'Ranking de Futebol Amador',
    contentHeading: 'Ranking de Futebol Amador: Do Racha Entre Amigos à Tabela de Artilharia',
    contentLead:
      'Transforme a pelada semanal em uma competição sadia e divertida. Registre gols, assistências, frequência, eleja o melhor jogador e acompanhe a evolução do racha ao longo da temporada.',
    chip: 'ESTATÍSTICAS & GAMIFICAÇÃO',
    sections: [
      {
        title: 'XP por jogo',
        text: 'Por padrão: 10 XP por participar, 30 por vitória, 10 por empate, 25 por gol, 20 por assistência, 15 por defesa e 15 por clean sheet.',
      },
      {
        title: 'Votação pós-jogo',
        text: 'Quem participou do jogo vota em até 24 horas após o fim, em MVP, melhor goleiro ou bola murcha. Não é possível votar em si mesmo.',
      },
      {
        title: 'Níveis e badges',
        text: 'O XP acumulado sobe o nível do jogador e conquistas rendem badges.',
      },
    ],
  },
  {
    path: '/gestao-de-pelada',
    title: `Gestão de Pelada: Mensalistas, Caixa Financeiro e Despesas | ${SITE_NAME}`,
    description:
      'Guia para organizar mensalistas, diaristas, rateio da quadra e o caixa do racha, com o painel de finanças do Futeba dos Parças.',
    ogImage: `${SITE_URL}/og/og-gestao-de-pelada.png`,
    breadcrumb: 'Gestão Financeira e Caixa',
    contentHeading: 'Gestão Financeira da Pelada: Controle de Mensalistas, Diaristas e Caixa',
    contentLead:
      'Veja como montar um fluxo de caixa para a sua pelada, acompanhar mensalistas e diaristas e manter as contas registradas e consultáveis pelo grupo.',
    chip: 'FINANÇAS & CAIXA DA PELADA',
    sections: [
      {
        title: 'Caixa do grupo',
        text: 'Os administradores registram entradas e saídas; membros confirmados do grupo consultam o caixa em modo somente leitura.',
      },
      {
        title: 'Finanças mensais',
        text: 'O painel mensal calcula a parte de cada membro a partir dos jogos do mês e mostra quanto já foi pago e quanto falta.',
      },
      {
        title: 'Reserva para material',
        text: 'Separe uma margem do caixa para reposição de bolas, coletes e confraternizações.',
      },
    ],
  },
  {
    path: '/como-funciona',
    title: `Como Funciona o Futeba dos Parças | Para Organizadores, Jogadores e Quadras`,
    description:
      'Conheça todos os fluxos do Futeba dos Parças: sorteio de times equilibrados, confirmação de presença, check-in, XP e ranking e locais de quadras.',
    ogImage: `${SITE_URL}/og/og-como-funciona.png`,
    breadcrumb: 'Como Funciona',
    contentHeading: 'Como Funciona o Futeba dos Parças',
    contentLead:
      'Uma plataforma unificada desenvolvida pela Tech Fernandes para transformar o futebol amador. Veja como o app atende organizadores, jogadores e donos de quadra.',
    // Trecho em negrito no lead da página React; o estático precisa do mesmo peso de fonte (#4403).
    leadStrong: 'Tech Fernandes',
    // Hero centralizado (maxWidth 840) na página React; o estático segue o mesmo alinhamento (#4403).
    heroCenter: true,
    chip: 'VISÃO GERAL DO PRODUTO',
    sections: [
      {
        title: 'Para quem organiza',
        text: 'Grupos com link de convite, agenda de jogos, sorteio de times, registro de placar e caixa do grupo.',
      },
      {
        title: 'Para quem joga',
        text: 'Confirmação de presença, check-in no jogo, votação pós-jogo, XP, níveis e badges.',
      },
      {
        title: 'Para arenas e quadras',
        text: 'Cadastro de locais e quadras com comodidades, exibidos na lista e no mapa de locais do app.',
      },
    ],
  },
  {
    path: '/parcerias',
    title: `Parcerias para Quadras e Arenas Society | ${SITE_NAME}`,
    description:
      'Divulgue sua arena para quem organiza peladas no Futeba dos Parças, um produto da Tech Fernandes. Entre em contato para cadastrar sua quadra.',
    ogImage: `${SITE_URL}/og/og-parcerias.png`,
    breadcrumb: 'Parcerias com Arenas e Quadras',
    contentHeading: 'Parcerias para Arenas e Quadras de Futebol Society',
    contentLead:
      'Destaque sua arena esportiva diretamente para quem mais consome futebol: organizadores de peladas e grupos ativos. Mostre sua quadra para quem organiza jogos com a tecnologia da Tech Fernandes.',
    chip: 'PROGRAMA DE PARCERIAS PARA ARENAS',
    sections: [
      {
        title: 'Listagem de locais',
        text: 'Sua arena aparece na lista e no mapa de locais do app, com endereço, comodidades e tipos de quadra.',
      },
      {
        title: 'Verificação',
        text: 'Locais novos entram como não verificados e só aparecem como verificados após confirmação dos dados com o responsável.',
      },
      {
        title: 'Contato',
        text: 'Fale com a equipe da Tech Fernandes pelo e-mail techfernandesltda@gmail.com informando arena, cidade e número de quadras.',
      },
    ],
  },
];

// Home (/): hero estático equivalente ao topo da LaunchPage. Os textos DEVEM existir em
// src/pages/launch/LaunchPage.tsx (teste src/components/seo/prerenderParity.test.ts) — #4196.
export const homePage = {
  overline: 'Da convocação ao apito final',
  heading: 'Sua pelada sai do grupo e entra em campo.',
  lead: 'Confirmações, times, placar, estatísticas e ranking em um só lugar para quem organiza, para quem joga e para quem oferece a quadra.',
  cta: 'Organizar minha pelada',
  headerLogin: 'Entrar',
  headerRegister: 'Criar conta',
  imageAlt: 'Amigos reunidos em um campo com a marca Futeba dos Parças',
  logoAlt: 'Logotipo do Futeba dos Parças',
};

// Guard inline do shell (index.html): o shell serve TODAS as rotas do SPA (rewrite **), então o hero
// estático da home só pode aparecer em "/" e para quem não tem sessão conhecida (dica gravada pelo
// AuthContext em localStorage). Nas demais rotas o atributo desliga o #prerender antes do 1º paint.
// O hash sha256 deste texto precisa estar em script-src do firebase.json (teste firebaseCspHashes).
export const HOME_GUARD_SOURCE =
  "(function(){var d=document.documentElement;try{var p=location.pathname;if((p!=='/'&&p!=='')||localStorage.getItem('fdp:auth-hint')==='1')d.setAttribute('data-no-prerender','')}catch(e){d.setAttribute('data-no-prerender','')}})();";
