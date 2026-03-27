/**
 * Utilitários de formatação de datas, centralizados para evitar duplicação
 * entre GamesTab, HomeTab, GroupsTab etc.
 */

/**
 * Formata uma data string (DD/MM/YYYY ou YYYY-MM-DD) para exibição amigável.
 * Retorna "Hoje", "Amanhã" ou data formatada em PT-BR.
 */
export function formatGameDate(dateStr: string | undefined): string {
  if (!dateStr) return '';

  let date: Date;
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    date = new Date(dateStr);
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã';

  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Formata uma data para exibição com dia da semana por extenso.
 */
export function formatGameDateLong(dateStr: string | undefined): string {
  if (!dateStr) return '';

  let date: Date;
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    date = new Date(dateStr);
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã';

  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
}

/**
 * Formata um Date object para exibição "há X tempo" em PT-BR.
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/**
 * Formata um Date object para exibição curta em PT-BR.
 */
export function formatDateShort(date: Date | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}
