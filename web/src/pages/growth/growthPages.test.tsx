import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildUtmUrl } from '../../utils/analytics';
import { HowToOrganizePage } from './HowToOrganizePage';
import { AmateurRankingPage } from './AmateurRankingPage';
import { PeladaManagementPage } from './PeladaManagementPage';
import { HowItWorksPage } from './HowItWorksPage';
import { PartnershipsPage } from './PartnershipsPage';
import { GrowthHeader } from './components/GrowthHeader';
import { GrowthFooter } from './components/GrowthFooter';

// Evita carregar o SDK Firebase real (Analytics/Auth) no teste de render.
vi.mock('../../services/firebaseAnalytics', () => ({
  logFirebaseAnalyticsEvent: vi.fn(),
}));

vi.mock('../../utils/analytics', async () => {
  const actual = await vi.importActual<typeof import('../../utils/analytics')>(
    '../../utils/analytics'
  );
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

describe('UTM URL builder', () => {
  it('appends UTM parameters properly to a path', () => {
    const url = buildUtmUrl('/register', {
      utm_source: 'growth_content',
      utm_medium: 'cta_section',
      utm_campaign: 'organizar_pelada',
      utm_content: 'hero_cta',
    });

    expect(url).toContain('/register?');
    expect(url).toContain('utm_source=growth_content');
    expect(url).toContain('utm_medium=cta_section');
    expect(url).toContain('utm_campaign=organizar_pelada');
    expect(url).toContain('utm_content=hero_cta');
  });

  it('preserves URL hash after query parameters', () => {
    const url = buildUtmUrl('/#cadastrar', {
      utm_source: 'whatsapp',
      utm_medium: 'social',
      utm_campaign: 'campanha_5x5',
    });

    expect(url).toContain('utm_source=whatsapp');
    expect(url).toMatch(/#cadastrar$/);
  });
});

describe('Growth Pages Render Tests', () => {
  it('renders HowToOrganizePage with h1, checklist and CTAs', () => {
    render(
      <MemoryRouter>
        <HowToOrganizePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Como Organizar uma Pelada Sem Confusão no Grupo/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Checklist da Pelada Perfeita/i)).toBeInTheDocument();
  });

  it('renders AmateurRankingPage with h1 and stats pillars', () => {
    render(
      <MemoryRouter>
        <AmateurRankingPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Ranking de Futebol Amador/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Gols & Assistências/i)).toBeInTheDocument();
  });

  it('renders PeladaManagementPage with h1 and financial tips', () => {
    render(
      <MemoryRouter>
        <PeladaManagementPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Gestão Financeira da Pelada/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Pilares do Caixa Saudável/i)).toBeInTheDocument();
  });

  it('renders HowItWorksPage with user journey cards', () => {
    render(
      <MemoryRouter>
        <HowItWorksPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Como Funciona o Futeba dos Parças/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Para Organizadores' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Para Jogadores' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Para Arenas & Quadras' })).toBeInTheDocument();
  });

  it('renders PartnershipsPage with commercial contact links', () => {
    render(
      <MemoryRouter>
        <PartnershipsPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Parcerias para Arenas e Quadras de Futebol Society/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Quero Divulgar Minha Quadra/i)).toBeInTheDocument();
  });

  it('GrowthFooter includes Tech Fernandes attribution and copyright', () => {
    render(
      <MemoryRouter>
        <GrowthFooter />
      </MemoryRouter>
    );

    expect(screen.getByText(/Um produto da/i)).toBeInTheDocument();
    const parentLink = screen.getByRole('link', { name: /Tech Fernandes/i });
    expect(parentLink).toHaveAttribute('href', 'https://techfernandes.com.br');
    expect(screen.getByText(/CNPJ 57\.285\.516\/0001-47/i)).toBeInTheDocument();
  });

  it('GrowthHeader renders navigation links and action CTA', () => {
    render(
      <MemoryRouter>
        <GrowthHeader currentPage="/como-funciona" />
      </MemoryRouter>
    );

    expect(screen.getByText('Futeba dos Parças')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Criar Pelada/i })).toBeInTheDocument();
  });
});

describe('Growth pages: copy verificável e CTAs', () => {
  const pages: Array<[string, () => JSX.Element]> = [
    ['/organizar-pelada', HowToOrganizePage],
    ['/ranking-futebol-amador', AmateurRankingPage],
    ['/gestao-de-pelada', PeladaManagementPage],
    ['/como-funciona', HowItWorksPage],
    ['/parcerias', PartnershipsPage],
  ];

  // Afirmações de produto que o código NÃO comprova (revisão #4187): não podem voltar.
  const unverifiedClaims = [
    /gratuit/i,
    /gr[áa]tis/i,
    /100%/,
    /luva de ouro/i,
    /paridade/i,
    /algoritmo/i,
    /centenas de/i,
    /maior rede/i,
    /comprovante/i,
    /voto secreto|secretamente|an[ôo]nima/i,
    /trimestral|anual\b/i,
    /5541999716717/,
    /contato@techfernandes/i,
  ];

  it.each(pages)('%s não contém afirmações de produto não verificadas', (_path, Page) => {
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    );
    const text = container.textContent ?? '';
    for (const claim of unverifiedClaims) {
      expect(text).not.toMatch(claim);
    }
    expect(container.querySelector('a[href^="https://wa.me/"]')).toBeNull();
  });

  it.each(pages)('%s tem CTA de cadastro com UTM', (_path, Page) => {
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    );
    const ctas = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="/register"]'));
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toMatch(/utm_source=.+&utm_medium=.+&utm_campaign=.+/);
    }
  });

  it.each([
    ['/organizar-pelada', HowToOrganizePage],
    ['/ranking-futebol-amador', AmateurRankingPage],
    ['/gestao-de-pelada', PeladaManagementPage],
    ['/como-funciona', HowItWorksPage],
    ['/parcerias', PartnershipsPage],
  ] as Array<[string, () => JSX.Element]>)(
    '%s: hero do prerender (scripts/prerender-routes.mjs) coincide com a página React',
    async (path, Page) => {
      const { routes } = (await import('../../../scripts/prerender-routes.mjs')) as {
        routes: Array<{ path: string; contentHeading: string; contentLead: string; chip: string; leadStrong?: string }>;
      };
      const route = routes.find((r) => r.path === path)!;
      const { container } = render(
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      );
      const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
      const h1 = container.querySelector('h1');
      expect(normalize(h1?.textContent ?? '')).toBe(route.contentHeading);
      expect(normalize(container.textContent ?? '')).toContain(route.contentLead);
      expect(normalize(container.textContent ?? '')).toContain(route.chip);
      // #4403: o peso da fonte altera a largura do texto; se o React destaca um trecho no lead, o estático também
      // precisa destacar, senão o texto do app fica maior e vira o LCP depois do handoff.
      if (route.leadStrong) {
        const strongs = [...container.querySelectorAll('strong')].map((el) => normalize(el.textContent ?? ''));
        expect(strongs).toContain(route.leadStrong);
      }
    }
  );

  it('ranking usa os valores de XP de shared/xp-constants.json', async () => {
    const xp = (await import('../../../../shared/xp-constants.json')).default.xpActions;
    const { container } = render(
      <MemoryRouter>
        <AmateurRankingPage />
      </MemoryRouter>
    );
    const text = container.textContent ?? '';
    // O FAQ fica colapsado, mas o texto permanece no DOM do Accordion.
    expect(text).toContain(`${xp.PARTICIPATION} por participar`);
    expect(text).toContain(`${xp.WIN} por vitória`);
    expect(text).toContain(`${xp.DRAW} por empate`);
    expect(text).toContain(`${xp.GOAL} por gol`);
    expect(text).toContain(`${xp.ASSIST} por assistência`);
    expect(text).toContain(`${xp.SAVE} por defesa`);
    expect(text).toContain(`${xp.CLEAN_SHEET} por jogo sem sofrer gol`);
    expect(text).toContain(`O MVP rende ${xp.MVP} XP`);
  });
});
