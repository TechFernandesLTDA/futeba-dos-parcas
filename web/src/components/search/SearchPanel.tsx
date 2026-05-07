import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
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
  EmojiEvents as RankingIcon,
  Bolt as QuickIcon,
} from '@mui/icons-material';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../common/GameCard';
import { formatGameDate } from '../../utils/dateFormatters';
import { createLogger } from '../../utils/logger';
import { getLevelForXp } from '../../types/gamification';

const logger = createLogger('SearchPanel');

export interface SearchResult {
  id: string;
  type: 'user' | 'group' | 'game' | 'location' | 'quick';
  name: string;
  subtitle: string;
  photoUrl?: string;
}

const QUICK_COMMANDS: Omit<SearchResult, 'id'>[] = [
  { type: 'quick', name: 'Criar jogo', subtitle: 'Organizar nova pelada' },
  { type: 'quick', name: 'Criar grupo', subtitle: 'Novo grupo de pelada' },
  { type: 'quick', name: 'Ir para perfil', subtitle: 'Ver meu perfil' },
  { type: 'quick', name: 'Ver ranking', subtitle: 'Classificação dos jogadores' },
];

const QUICK_ROUTES: Record<string, string> = {
  'Criar jogo': '/game/create',
  'Criar grupo': '/group/create',
  'Ir para perfil': '/profile',
  'Ver ranking': '/ranking',
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
  const navigate = useNavigate();
  const theme = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const listRef = useRef<HTMLUListElement>(null);
  const showQuickCommands = !searchQuery.trim();

  const navigableItems: SearchResult[] = showQuickCommands
    ? QUICK_COMMANDS.map((c, i) => ({ ...c, id: `quick-${i}` }))
    : results;

  useEffect(() => { setSelectedIndex(-1); }, [navigableItems.length, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) { setResults([]); return; }
    const t = setTimeout(() => doSearch(searchQuery, tabValue), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, tabValue]);

  const doSearch = async (q: string, tab: number) => {
    setLoading(true);
    try {
      const all: SearchResult[] = [];

      if (tab === 0 || tab === 1) {
        const snap = await getDocs(query(
          collection(db, 'users'),
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
        const snap = await getDocs(query(collection(db, 'games'), orderBy('date', 'desc'), limit(20)));
        snap.docs.forEach((d) => {
          const data = snakeToCamel(d.data()) as Record<string, unknown>;
          const loc = data.locationName as string | undefined;
          if (loc?.toLowerCase().includes(q.toLowerCase())) {
            all.push({ id: d.id, type: 'game', name: loc || 'Jogo', subtitle: formatGameDate(data.date as never) });
          }
        });
      }

      setResults(all);
    } catch (err) {
      logger.error('Erro ao buscar:', err);
    } finally {
      setLoading(false);
    }
  };

  const navToResult = (result: SearchResult) => {
    if (result.type === 'quick') {
      const r = QUICK_ROUTES[result.name];
      if (r) { onClose?.(); navigate(r); }
      return;
    }
    onClose?.();
    const routes: Record<string, string> = {
      user: `/profile/${result.id}`,
      group: `/group/${result.id}`,
      game: `/game/${result.id}`,
      location: `/location/${result.id}`,
    };
    if (routes[result.type]) navigate(routes[result.type]);
  };

  const typeColor = (t: string): string => ({
    user: theme.palette.primary.main,
    group: theme.palette.secondary.main,
    game: theme.palette.success.main,
    location: theme.palette.warning.main,
    quick: theme.palette.info.main,
  }[t] ?? theme.palette.grey[500]);

  const typeIcon = (t: string): React.ReactElement => {
    const map: Record<string, React.ReactElement> = {
      user: <PersonIcon fontSize="small" />,
      group: <GroupsIcon fontSize="small" />,
      game: <SoccerIcon fontSize="small" />,
      location: <SportsIcon fontSize="small" />,
      quick: <QuickIcon fontSize="small" />,
    };
    return map[t] ?? <PersonIcon fontSize="small" />;
  };

  const typeLabel = (t: string): string =>
    ({ user: 'Jogador', group: 'Grupo', game: 'Jogo', location: 'Local', quick: 'Ação' }[t] ?? '');

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
          aria-label="Buscar jogadores, grupos ou jogos"
          aria-autocomplete="list"
          aria-controls="search-results-list"
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
          aria-label="Filtrar resultados por tipo"
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
              aria-label="Comandos rápidos"
              role="listbox"
              id="search-results-list"
            >
              {QUICK_COMMANDS.map((cmd, idx) => (
                <Box key={cmd.name}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItemButton
                    data-index={idx}
                    selected={selectedIndex === idx}
                    onClick={() => navToResult({ ...cmd, id: `quick-${idx}` })}
                    role="option"
                    aria-selected={selectedIndex === idx}
                    sx={{ py: 1, '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.12) } }}
                  >
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.info.main, 0.15), color: theme.palette.info.main }}>
                        {quickIcon(cmd.name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={cmd.name}
                      secondary={cmd.subtitle}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 1, flexShrink: 0 }}>↵</Typography>
                  </ListItemButton>
                </Box>
              ))}
            </List>
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary">Nenhum resultado encontrado</Typography>
            <Typography variant="caption" color="text.disabled" display="block">Tente outros termos</Typography>
          </Box>
        ) : (
          <List
            ref={listRef}
            disablePadding
            aria-label="Resultados da busca"
            role="listbox"
            id="search-results-list"
          >
            {results.map((result, idx) => (
              <Box key={`${result.type}-${result.id}`}>
                {idx > 0 && <Divider component="li" />}
                <ListItemButton
                  data-index={idx}
                  selected={selectedIndex === idx}
                  onClick={() => navToResult(result)}
                  role="option"
                  aria-selected={selectedIndex === idx}
                  sx={{ py: 1.5, '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.12) } }}
                >
                  <ListItemAvatar>
                    {result.photoUrl ? (
                      <Avatar src={result.photoUrl} sx={{ width: 36, height: 36 }} />
                    ) : (
                      <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(typeColor(result.type), 0.15), color: typeColor(result.type) }}>
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
              sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', fontFamily: 'inherit', fontSize: '0.65rem', lineHeight: 1.4, color: 'text.secondary' }}
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
    'Ir para perfil': <ProfileIcon fontSize="small" />,
    'Ver ranking': <RankingIcon fontSize="small" />,
  };
  return map[name] ?? <QuickIcon fontSize="small" />;
}
