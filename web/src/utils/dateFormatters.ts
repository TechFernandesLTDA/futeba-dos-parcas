/**
 * Utilitários de formatação de datas, centralizados para evitar duplicação
 * entre GamesTab, HomeTab, GroupsTab etc.
 *
 * As strings (Hoje/Amanhã/Ontem/Agora/há X tempo) vêm do i18next e o locale
 * usado pelas APIs Intl é i18n.resolvedLanguage. O parâmetro opcional `locale`
 * permite sobrescrever em contextos fora do React.
 */

import i18n from 'i18next';

function resolveLocale(locale?: string): string {
  return locale || i18n.resolvedLanguage || i18n.language || 'pt-BR';
}

/**
 * Formata uma data string (DD/MM/YYYY ou YYYY-MM-DD) para exibição amigável.
 * Retorna a tradução de "Hoje", "Amanhã" ou a data formatada no locale ativo.
 */
export function formatGameDate(dateStr: string | undefined, locale?: string): string {
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

  if (date.toDateString() === today.toDateString()) return i18n.t('notifications.screen.dateGroups.today');
  if (date.toDateString() === tomorrow.toDateString()) return i18n.t('common.date.tomorrow');

  return date.toLocaleDateString(resolveLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Formata uma data para exibição com dia da semana por extenso.
 */
export function formatGameDateLong(dateStr: string | undefined, locale?: string): string {
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

  if (date.toDateString() === today.toDateString()) return i18n.t('notifications.screen.dateGroups.today');
  if (date.toDateString() === tomorrow.toDateString()) return i18n.t('common.date.tomorrow');

  return date.toLocaleDateString(resolveLocale(locale), { weekday: 'long', day: 'numeric', month: 'short' });
}

/**
 * Formata um Date object para exibição "há X tempo" no locale ativo.
 */
export function formatTimeAgo(date: Date, locale?: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return i18n.t('notifications.screen.time.now');
  if (diffMins < 60) return i18n.t('common.date.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('common.date.hoursAgo', { count: diffHours });
  if (diffDays === 1) return i18n.t('notifications.screen.dateGroups.yesterday');
  if (diffDays < 7) return i18n.t('common.date.daysAgo', { count: diffDays });
  return date.toLocaleDateString(resolveLocale(locale), { day: 'numeric', month: 'short' });
}

/**
 * Formata um Date object para exibição curta no locale ativo.
 */
export function formatDateShort(date: Date | undefined, locale?: string): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(resolveLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' });
}
