import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
} from '@mui/material';
import {
  SportsSoccer as SoccerIcon,
  Square as YellowCardIcon,
  Block as RedCardIcon,
  EmojiEvents as AssistIcon,
  SaveAlt as SaveIcon,
  SwapHoriz as SubstitutionIcon,
} from '@mui/icons-material';
import { GameEvent } from '../../types/game';

interface LiveGameEventsProps {
  events: GameEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  GOAL: 'Gol',
  ASSIST: 'Assistência',
  SAVE: 'Defesa',
  YELLOW_CARD: 'Cartão Amarelo',
  RED_CARD: 'Cartão Vermelho',
  SUBSTITUTION: 'Substituição',
};

const LiveGameEvents: React.FC<LiveGameEventsProps> = ({ events }) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Eventos do Jogo
        </Typography>

        {events.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
            Nenhum evento registrado
          </Typography>
        ) : (
          <List disablePadding aria-label="Eventos do jogo">
            {events.map((event, index) => (
              <React.Fragment key={event.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor:
                          event.eventType === 'GOAL'
                            ? 'success.main'
                            : event.eventType === 'YELLOW_CARD'
                            ? 'warning.main'
                            : event.eventType === 'RED_CARD'
                            ? 'error.main'
                            : 'primary.main',
                      }}
                    >
                      {event.eventType === 'GOAL' && <SoccerIcon aria-label="Gol" />}
                      {event.eventType === 'YELLOW_CARD' && <YellowCardIcon aria-label="Cartão Amarelo" sx={{ color: 'warning.main' }} />}
                      {event.eventType === 'RED_CARD' && <RedCardIcon aria-label="Cartão Vermelho" />}
                      {event.eventType === 'ASSIST' && <AssistIcon aria-label="Assistência" />}
                      {event.eventType === 'SAVE' && <SaveIcon aria-label="Defesa" />}
                      {event.eventType === 'SUBSTITUTION' && <SubstitutionIcon aria-label="Substituição" />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={event.playerName}
                    secondary={`${EVENT_LABELS[event.eventType] || event.eventType} - ${event.minute}'`}
                  />
                </ListItem>
                {index < events.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveGameEvents;
