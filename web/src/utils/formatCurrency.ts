/**
 * Valor em reais no formato brasileiro ("R$ 15,71"), em vez de
 * `R$ ${valor.toFixed(2)}`, que sai com ponto ("R$ 15.71").
 */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value: number): string {
  return BRL.format(Number.isFinite(value) ? value : 0);
}
