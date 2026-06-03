import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { generateGoogleCalendarUrl, downloadIcsFile, generateOutlookCalendarUrl } from '../../utils/calendarLinks';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

interface GameShareData {
  gameId: string;
  date: string;
  time: string;
  endTime?: string;
  locationName: string;
  fieldName?: string;
  maxPlayers: number;
  dailyPrice: number;
  rules: string;
  locationAddress: string;
}

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  game: GameShareData;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ open, onClose, game }) => {
  const { t } = useTranslation();
  const { showSuccess } = useToast();
  const [copied, setCopied] = useState(false);

  const gameUrl = `${window.location.origin}/game/${game.gameId}`;

  const shareText = [
    `⚽ ${t('app.name')} — Jogo marcado!`,
    '',
    `📅 ${game.date} — ${game.time}${game.endTime ? ` às ${game.endTime}` : ''}`,
    `📍 ${game.locationName}${game.fieldName ? ` — ${game.fieldName}` : ''}`,
    `👥 ${game.maxPlayers} vagas${game.dailyPrice > 0 ? ` — R$ ${game.dailyPrice.toFixed(2)} por jogador` : ''}`,
    '',
    `Confirme sua presença: ${gameUrl}`,
  ].join('\n');

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(gameUrl)}&text=${encodeURIComponent(shareText.split('\n')[0])}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopied(true);
      showSuccess(t('feedback.share.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showSuccess(t('feedback.share.linkCopied'));
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Futeba — ${game.locationName}`,
          text: shareText,
          url: gameUrl,
        });
      } catch {
        // user cancelled or error — silently ignore
      }
    }
  };

  const handleAddToCalendar = (type: 'google' | 'ics' | 'outlook') => {
    const event = {
      title: `Futeba — ${game.locationName}`,
      description: shareText,
      location: game.locationAddress,
      startDate: game.date,
      startTime: game.time,
      endDate: game.date,
      endTime: game.endTime || '',
    };

    if (type === 'google') {
      window.open(generateGoogleCalendarUrl(event), '_blank');
    } else if (type === 'outlook') {
      window.open(generateOutlookCalendarUrl(event), '_blank');
    } else {
      downloadIcsFile(event);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="share-dialog-title">
      <DialogTitle id="share-dialog-title">{t('games.share.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Alert severity="success" icon={false}>
            {t('games.share.createdSuccess')}
          </Alert>

          <TextField
            fullWidth
            value={gameUrl}
            variant="outlined"
            size="small"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopyLink} size="small" aria-label={t('games.share.copyLink')}>
                    {copied ? <CheckIcon color="success" /> : <CopyIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Typography variant="subtitle2" fontWeight={600}>
            {t('games.share.shareVia')}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<span style={{ fontSize: '1.2em' }}>💬</span>}
              label="WhatsApp"
              component="a"
              href={whatsappUrl}
              target="_blank"
              clickable
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<span style={{ fontSize: '1.2em' }}>✈️</span>}
              label="Telegram"
              component="a"
              href={telegramUrl}
              target="_blank"
              clickable
              color="info"
              variant="outlined"
            />
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <Chip
                label="Compartilhar"
                onClick={handleNativeShare}
                clickable
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1 }}>
            {t('games.share.addToCalendar')}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CalendarIcon />}
              onClick={() => handleAddToCalendar('google')}
            >
              Google Calendar
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => handleAddToCalendar('ics')}
            >
              iCal / Apple
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CalendarIcon />}
              onClick={() => handleAddToCalendar('outlook')}
            >
              Outlook
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
