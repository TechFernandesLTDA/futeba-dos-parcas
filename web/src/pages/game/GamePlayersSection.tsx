import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  People as PeopleIcon,
  SportsSoccer as SoccerIcon,
  PhotoLibrary as PhotoIcon,
} from '@mui/icons-material';
import { PlayerAvatar, StatusChip } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { TeamBadge } from '../../components/team/TeamBadge';
import { PAYMENT_STATUS_CONFIG } from '../../types/game';
import type { Game, GameConfirmation } from '../../types/game';
import { GamePhotosTab } from './GamePhotosTab';
import { useTranslation } from 'react-i18next';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

interface GamePlayersSectionProps {
  game: Game;
  gameId: string;
  confirmedPlayers: GameConfirmation[];
  goalkeepers: GameConfirmation[];
  waitlist: GameConfirmation[];
  confirmations: GameConfirmation[];
  myConfirmation: GameConfirmation | undefined;
  isOwner: boolean;
  tabValue: number;
  onTabChange: (value: number) => void;
}

export const GamePlayersSection: React.FC<GamePlayersSectionProps> = ({
  game,
  gameId,
  confirmedPlayers,
  goalkeepers,
  waitlist,
  confirmations,
  myConfirmation,
  isOwner,
  tabValue,
  onTabChange,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => onTabChange(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label={t('a11y.playerLists')}
          sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
        >
          <Tab label={`Confirmados (${confirmedPlayers.length})`} />
          <Tab label={`Goleiros (${goalkeepers.length})`} />
          <Tab label={`Espera (${waitlist.length})`} />
          {game.status === 'FINISHED' && <Tab icon={<PhotoIcon />} iconPosition="start" label="Fotos" />}
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {confirmedPlayers.length === 0 ? (
            <EmptyState
              icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
              title="Nenhum jogador confirmado"
              description="Seja o primeiro a confirmar presença!"
            />
          ) : (
            <List disablePadding aria-label={t('a11y.confirmedPlayers')}>
              {confirmedPlayers.map((player, index) => (
                <ListItem
                  key={player.id}
                  divider={index < confirmedPlayers.length - 1}
                  secondaryAction={
                    <StatusChip status={player.paymentStatus} config={PAYMENT_STATUS_CONFIG} />
                  }
                >
                  <ListItemAvatar>
                    <PlayerAvatar
                      name={player.userName}
                      photoUrl={player.userPhoto}
                      size={44}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2">{player.userName}</Typography>
                        <TeamBadge teamId={player.favoriteTeam} size={18} />
                        {player.position === 'GOALKEEPER' && (
                          <Chip label="GK" size="small" color="primary" sx={{ height: 20 }} />
                        )}
                      </Box>
                    }
                    secondary={`#${player.confirmationOrder ?? (index + 1)}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {goalkeepers.length === 0 ? (
            <EmptyState
              icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
              title="Nenhum goleiro"
              description="Nenhum goleiro confirmado ainda"
            />
          ) : (
            <List disablePadding>
              {goalkeepers.map((player) => (
                <ListItem key={player.id}>
                  <ListItemAvatar>
                    <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {player.userName}
                        <TeamBadge teamId={player.favoriteTeam} size={18} />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {waitlist.length === 0 ? (
            <EmptyState
              icon={<PeopleIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
              title="Nenhum jogador na lista de espera"
              description="Quando a lista estiver cheia, novos jogadores entram aqui"
            />
          ) : (
            <List disablePadding>
              {waitlist.map((player) => (
                <ListItem key={player.id}>
                  <ListItemAvatar>
                    <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {player.userName}
                        <TeamBadge teamId={player.favoriteTeam} size={18} />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {game.status === 'FINISHED' && (
          <TabPanel value={tabValue} index={3}>
            <GamePhotosTab
              gameId={gameId}
              isFinished={game.status === 'FINISHED'}
              isConfirmedPlayer={!!myConfirmation && myConfirmation.status === 'CONFIRMED'}
              isOwner={isOwner}
            />
          </TabPanel>
        )}
      </Card>

      {game.rules && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Regras do Jogo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {game.rules}
            </Typography>
          </CardContent>
        </Card>
      )}

      {game.status === 'FINISHED' && (game.team1Score !== undefined || game.team2Score !== undefined) && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom textAlign="center">
              Resultado Final
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h4" fontWeight={700}>
                  {game.team1Score}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {game.team1Name || 'Time 1'}
                </Typography>
              </Box>
              <Typography variant="h5" color="text.secondary">
                X
              </Typography>
              <Box sx={{ textAlign: 'center', flex: 1 }}>
                <Typography variant="h4" fontWeight={700}>
                  {game.team2Score}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {game.team2Name || 'Time 2'}
                </Typography>
              </Box>
            </Box>
            {game.mvpId && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Chip
                  icon={<SoccerIcon />}
                  label={`MVP: ${confirmations.find((c) => c.userId === game.mvpId)?.userName ?? game.mvpId}`}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};
