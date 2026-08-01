import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { VerificationGraceBanner } from './VerificationGraceBanner';

const GRACE_END = new Date('2026-10-03T00:00:00Z');

function daysRemainingAt(now: Date): number {
  return Math.ceil((GRACE_END.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

describe('VerificationGraceBanner (#3932)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exibe dias restantes (info) fora da urgência', () => {
    const now = new Date(2026, 7, 15, 12, 0, 0);
    vi.setSystemTime(now);
    const days = daysRemainingAt(now);
    render(<VerificationGraceBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${days} dias restantes`))).toBeInTheDocument();
  });

  it('exibe últimos dias (warning) na urgência', () => {
    const now = new Date(2026, 8, 28, 12, 0, 0);
    vi.setSystemTime(now);
    const days = daysRemainingAt(now);
    render(<VerificationGraceBanner />);
    expect(screen.getByText(`Últimos ${days} dias!`)).toBeInTheDocument();
  });

  it('exibe estado expirado (error)', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
    render(<VerificationGraceBanner />);
    expect(screen.getByText('Verificação obrigatória')).toBeInTheDocument();
    expect(screen.getByText(/terminou/i)).toBeInTheDocument();
  });
});

describe('VerificationGraceBanner i18n EN (#3932)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('pt-BR');
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza strings em EN e deadline no locale EN', () => {
    const now = new Date(2026, 8, 28, 12, 0, 0);
    vi.setSystemTime(now);
    const days = daysRemainingAt(now);
    const expectedDeadline = GRACE_END.toLocaleDateString('en', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    render(<VerificationGraceBanner />);
    expect(screen.getByText(`Last ${days} days!`)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes(expectedDeadline))).toBeInTheDocument();
  });

  it('renderiza estado expirado em EN', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
    render(<VerificationGraceBanner />);
    expect(screen.getByText('Verification required')).toBeInTheDocument();
  });
});
