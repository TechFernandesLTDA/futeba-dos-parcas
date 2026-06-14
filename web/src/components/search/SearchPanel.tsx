import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {

  Box,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  List,
  ListItemAvatar,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  Typography,
  useTheme,
  alpha,
  ListItemButton,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  SportsSoccer as SoccerIcon,
  Groups as GroupsIcon,
  Sports as SportsIcon,
  AddCircleOutline as AddGameIcon,
  GroupAdd as AddGroupIcon,
  AccountCircle as ProfileIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Bolt as QuickIcon,
  History as HistoryIcon,
  Close as ClearIcon,
} from '@mui/icons-material';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../common/GameCard';
import { formatGameDate } from '../../utils/dateFormatters';
import { createLogger } from '../../utils/logger';
import { getLevelForXp } from '../../types/gamification';
import { avatarSizes, iconSizes } from '../../theme/iconSizes';
import { useToast } from '../../contexts';
import { useTranslation } from 'react-i18next';

const logger = createLogger('SearchPanel');

const SEARCH_HISTORY_KEY = 'futeba_search_history';
const MAX_HISTORY = 10;

function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Failed to read search history from localStorage:', error);
    return [];
  }
}

function saveSearchHistory(queries: string[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(queries));
  } catch (error) {
    console.warn('Failed to save search history to localStorage:', error);
  }
}

function addToSearchHistory(queryText: string): void {
  const trimmed = queryText.trim();
  if (!trimmed || trimmed.length < 2) return;
  const history = loadSearchHistory().filter(q => q !== trimmed);
  history.unshift(trimmed);
  saveSearchHistory(history.slice(0, MAX_HISTORY));
}

function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.warn('Failed to clear search history from localStorage:', error);
  }
}

export interface SearchResult {
  id: string;
  type: 'user' | 'group' | 'game' | 'location' | 'quick' | 'history';
  name: string;
  subtitle: string;
  photoUrl?: string;
}

const QUICK_COMMANDS: Omit<SearchResult, 'id'>[] = [
  { type: 'quick', name: 'Criar jogo', subtitle: 'Organizar nova pelada' },
  { type: 'quick', name: 'Criar grupo', subtitle: 'Novo grupo de pelada' },
  { type: 'quick', name: 'Configurações', subtitle: 'Ajustes da sua conta' },
  { type: 'quick', name: 'Perfil', subtitle: 'Ver meu perfil' },
  { type: 'quick', name: 'Notificações', subtitle: 'Central de notificações' },
];

const QUICK_ROUTES: Record<string, string> = {
  'Criar jogo': '/game/create',
  'Criar grupo': '/group/create',
  'Configurações': '/settings',
  'Perfil': '/profile',
  'Notificações': '/notifications',
};

const QUICK_SHORTCUTS: Record<string, string> = {
  'Criar jogo': '⌘N',
  'Criar grupo': '⌘⇧N',
  'Configurações': '⌘,',
  'Perfil': '',
  'Notificações': '',
};

interface SearchPanelProps {
  onClose?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Painel de busca reutilizável usado no CommandPalette (Cmd+K) e
 * na GlobalSearchScreen (rota /search). Gerencia estado de busca,
 * queries Firestore, e navegação por teclado (↑↓ Enter).
 */
export const SearchPanel: React.FC<SearchPanelProps> = ({
  onClose,
  placeholder = 'Buscar jogadores, grupos, jogos...',
  autoFocus = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { showError } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory);

  const listRef = useRef<HTMLUListElement>(null);
  // Referência de ID para descartar responses de requests stale (race condition)
  const requestIdRef = useRef(0);
  const showQuickCommands = !searchQuery.trim();

  const navigableItems: SearchResult[] = showQuickCommands
    ? QUICK_COMMANDS.map((c, i) => ({ ...c, id: `quick-${i}` }))
    : results;

  useEffect(() => { setSelectedIndex(-1); }, [navigableItems.length, searchQuery]);

  const activeDescendant =
    selectedIndex >= 0
      ? showQuickCommands
        ? `quick-cmd-${selectedIndex}`
        : `search-result-${selectedIndex}`
      : undefined;

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchHistory(loadSearchHistory());
    }
  }, [searchQuery]);

  const doSearch = useCallback(async (q: string, tab: number) => {
    // Gera ID único para este request; requests antigos são descartados ao retornar
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const all: SearchResult[] = [];

      if (tab === 0 || tab === 1) {
        // Privacidade: apenas jogadores com is_searchable=true aparecem na busca (#1027)
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('is_searchable', '==', true),
          where('name', '>=', q), where('name', '<=', q + ''), limit(10)
        ));
        snap.docs.forEach((d) => {
          const data = snakeToCamel(d.data()) as Record<string, unknown>;
          all.push({
            id: d.id, type: 'user',
            name: (data.name as string) || 'Jogador',
            subtitle: `Nível ${getLevelForXp((data.experiencePoints as number) ?? 0)}`,
            photoUrl: data.photoUrl as string | undefined,
          });
        });
      }

      if (tab === 0 || tab === 2) {
        const snap = await getDocs(query(
          collection(db, 'groups'),
          where('name', '>=', q), where('name', '<=', q + ''), limit(10)
        ));
        snap.docs.forEach((d) => {
          const data = snakeToCamel(d.data()) as Record<string, unknown>;
          all.push({
            id: d.id, type: 'group',
            name: (data.name as string) || 'Grupo',
            subtitle: `${(data.memberCount as number) || 0} membros`,
            photoUrl: data.photoUrl as string | undefined,
          });
        });
      }

      if (tab === 0 || tab === 3) {
        const snap = await getDocs(query(collection(db, 'games'), orderBy('dateTime', 'desc'), limit(20)));
        snap.docs.forEach((d) => {
          const data = snakeToCamel(d.data()) as Record<string, unknown>;
          const loc = data.locationName as string | undefined;
          if (loc?.toLowerCase().includes(q.toLowerCase())) {
            all.push({ id: d.id, type: 'game', name: loc || 'Jogo', subtitle: formatGameDate((data.dateTime || data.date) as never) });
          }
        });
      }

      // Descarta resultado se um request mais recente já foi disparado
      if (requestIdRef.current !== requestId) return;
      setResults(all);
    } catch (err) {
      logger.error('Erro ao buscar:', err);
      if (requestIdRef.current !== requestId) return;
      showError(t('feedback.search.error'));
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [showError, t]);

  useEffect(() => {
    if (!searchQuery.trim()) { setResults([]); return; }
    const t = setTimeout(() => doSearch(searchQuery, tabValue), 300);
    return () => clearTimeout(t);
  }, [searchQuery, tabValue, doSearch]);

  const navToResult = (result: SearchResult) => {
    if (result.type === 'quick') {
      const r = QUICK_ROUTES[result.name];
      if (r) { onClose?.(); navigate(r); }
      return;
    }
    if (result.type === 'history') {
      setSearchQuery(result.name);
      return;
    }
    addToSearchHistory(result.name);
    onClose?.();
    const routes: Record<string, string> = {
      user: `/profile/${result.id}`,
      group: `/group/${result.id}`,
      game: `/game/${result.id}`,
      location: `/location/${result.id}`,
    };
    if (routes[result.type]) navigate(routes[result.type]);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  const typeColor = (t: string): string => ({
    user: theme.palette.primary.main,
    group: theme.palette.secondary.main,
    game: theme.palette.success.main,
    location: theme.palette.warning.main,
    quick: theme.palette.info.main,
    history: theme.palette.text.secondary,
  }[t] ?? theme.palette.grey[500]);

  const typeIcon = (t: string): React.ReactElement => {
    const map: Record<string, React.ReactElement> = {
      user: <PersonIcon fontSize="small" />,
      group: <GroupsIcon fontSize="small" />,
      game: <SoccerIcon fontSize="small" />,
      location: <SportsIcon fontSize="small" />,
      quick: <QuickIcon fontSize="small" />,
      history: <HistoryIcon fontSize="small" />,
    };
    return map[t] ?? <PersonIcon fontSize="small" />;
  };

  const typeLabel = (t: string): string =>
    ({ user: 'Jogador', group: 'Grupo', game: 'Jogo', location: 'Local', quick: 'Ação', history: 'Recente' }[t] ?? '');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!navigableItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(p => Math.min(p + 1, navigableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(p => Math.max(p - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      navToResult(navigableItems[selectedIndex]);
    }
  };

  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          role="combobox"
          aria-label={t('a11y.searchPlayersGroupsGames')}
          aria-autocomplete="list"
          aria-expanded={navigableItems.length > 0}
          aria-controls={showQuickCommands ? 'search-commands-list' : 'search-results-list'}
          aria-activedescendant={activeDescendant}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Box>

      {!showQuickCommands && (
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v as number)}
          variant="fullWidth"
          aria-label={t('a11y.filterResultsByType')}
          sx={{ borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}
        >
          <Tab label="Todos" />
          <Tab label="Jogadores" />
          <Tab label="Grupos" />
          <Tab label="Jogos" />
        </Tabs>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ px: 2, py: 1 }}>
            <LoadingState shimmerCount={5} itemType="LIST" />
          </Box>
        ) : showQuickCommands ? (
          <Box>
            {searchHistory.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 0.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    Buscas recentes
                  </Typography>
                  <IconButton size="small" onClick={handleClearHistory} aria-label={t('a11y.clearSearchHistory')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Box>
                {searchHistory.slice(0, 5).map((q, idx) => (
                  <ListItemButton
                    key={`hist-${q}-${idx}`}
                    onClick={() => setSearchQuery(q)}
                    sx={{ py: 0.75 }}
                  >
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar sx={{ width: iconSizes.lg, height: iconSizes.lg, bgcolor: alpha(theme.palette.text.secondary, 0.1), color: 'text.secondary' }}>
                        <HistoryIcon sx={{ fontSize: iconSizes.xs }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={q}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    />
                  </ListItemButton>
                ))}
                <Divider sx={{ my: 1 }} />
              </>
            )}
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block' }}
            >
              Ações rápidas
            </Typography>
            <List
              ref={listRef}
              disablePadding
              aria-label={t('a11y.quickCommands')}
              role="listbox"
              id="search-commands-list"
            >
              {QUICK_COMMANDS.map((cmd, idx) => (
                <Box key={cmd.name}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItemButton
                    id={`quick-cmd-${idx}`}
                    data-index={idx}
                    selected={selectedIndex === idx}
                    onClick={() => navToResult({ ...cmd, id: `quick-${idx}` })}
                    role="option"
                    aria-selected={selectedIndex === idx}
                    sx={{ py: 1, '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.12) } }}
                  >
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar sx={{ width: avatarSizes.sm, height: avatarSizes.sm, bgcolor: alpha(theme.palette.info.main, 0.15), color: theme.palette.info.main }}>
                        {quickIcon(cmd.name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={cmd.name}
                      secondary={cmd.subtitle}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    {QUICK_SHORTCUTS[cmd.name] ? (
                      <Box
                        component="kbd"
                        aria-hidden="true"
                        sx={{
                          ml: 1,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.5,
                          border: `1px solid ${theme.palette.divider}`,
                          bgcolor: 'background.paper',
                          fontFamily: 'inherit',
                          fontSize: '0.75rem',
                          lineHeight: 1.4,
                          color: 'text.secondary',
                          flexShrink: 0,
                        }}
                      >
                        {QUICK_SHORTCUTS[cmd.name]}
                      </Box>
                    ) : null}
                  </ListItemButton>
                </Box>
              ))}
            </List>
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <SearchIcon sx={{ fontSize: iconSizes.xxl, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary">Nenhum resultado encontrado</Typography>
            <Typography variant="caption" color="text.disabled" display="block">Tente outros termos</Typography>
          </Box>
        ) : (
          <List
            ref={listRef}
            disablePadding
            aria-label={t('a11y.searchResultsList')}
            role="listbox"
            id="search-results-list"
          >
            {results.map((result, idx) => (
              <Box key={`${result.type}-${result.id}`}>
                {idx > 0 && <Divider component="li" />}
                <ListItemButton
                  id={`search-result-${idx}`}
                  data-index={idx}
                  selected={selectedIndex === idx}
                  onClick={() => navToResult(result)}
                  role="option"
                  aria-selected={selectedIndex === idx}
                  sx={{ py: 1.5, '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.12) } }}
                >
                  <ListItemAvatar>
                    {result.photoUrl ? (
                      <Avatar src={result.photoUrl} alt={result.name} slotProps={{ img: { loading: 'lazy' } }} sx={{ width: avatarSizes.sidebar, height: avatarSizes.sidebar }} />
                    ) : (
                      <Avatar sx={{ width: avatarSizes.sidebar, height: avatarSizes.sidebar, bgcolor: alpha(typeColor(result.type), 0.15), color: typeColor(result.type) }}>
                        {typeIcon(result.type)}
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={result.name}
                    secondary={result.subtitle}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    label={typeLabel(result.type)}
                    size="small"
                    sx={{ bgcolor: alpha(typeColor(result.type), 0.1), color: typeColor(result.type), ml: 1, flexShrink: 0 }}
                  />
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Dicas de teclado */}
      <Box
        sx={{ display: 'flex', gap: 2, px: 2, py: 1, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: 'background.default', flexShrink: 0 }}
        aria-hidden="true"
      >
        {[['↑↓', 'navegar'], ['↵', 'selecionar'], ['Esc', 'fechar']].map(([k, label]) => (
          <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              component="kbd"
              sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', fontFamily: 'inherit', fontSize: '0.75rem', lineHeight: 1.4, color: 'text.secondary' }}
            >
              {k}
            </Box>
            <Typography variant="caption" color="text.disabled">{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

function quickIcon(name: string): React.ReactElement {
  const map: Record<string, React.ReactElement> = {
    'Criar jogo': <AddGameIcon fontSize="small" />,
    'Criar grupo': <AddGroupIcon fontSize="small" />,
    'Configurações': <SettingsIcon fontSize="small" />,
    'Perfil': <ProfileIcon fontSize="small" />,
    'Notificações': <NotificationsIcon fontSize="small" />,
  };
  return map[name] ?? <QuickIcon fontSize="small" />;
}
