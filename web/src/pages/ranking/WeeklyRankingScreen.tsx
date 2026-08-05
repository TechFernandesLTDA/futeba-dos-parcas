import React from "react";
import { useNavigate } from "react-router-dom";
import { useNavigateBack } from "../../hooks/useNavigateBack";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useTheme,
  alpha,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  SportsSoccer as SoccerIcon,
  DirectionsRun as AssistIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { useWeeklyRanking } from "../../hooks/useWeeklyRanking";
import { useGamificationColors } from "../../hooks/useGamificationColors";
import { PageContainer } from "../../components/common/PageContainer";
import { EmptyState } from "../../components/common/EmptyState";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useTranslation } from "react-i18next";

export const WeeklyRankingScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t("ranking.weekly.title"));
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const { data, isLoading } = useWeeklyRanking();

  const MEDAL_COLORS = [gColors.gold, gColors.silver, gColors.bronze];

  return (
    <PageContainer maxWidth="list">
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label={t('a11y.back')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          {t("ranking.weekly.title")}
        </Typography>
        {data && (
          <Chip
            label={t("home.round", { week: data.weekKey })}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      {isLoading && (
        <Stack spacing={1}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={64} />
          ))}
        </Stack>
      )}

      {!isLoading && (!data || !data.rankings || data.rankings.length === 0) && (
        <EmptyState
          icon={<TrophyIcon />}
          title={t("ranking.weekly.empty")}
          description={t("ranking.weekly.emptyDesc")}
        />
      )}

      {!isLoading && data && data.rankings.length > 0 && (
        <Stack spacing={1}>
          {data.rankings.map((player, index) => (
            <Card
              key={player.userId}
              sx={{
                bgcolor:
                  index === 0
                    ? alpha(theme.palette.warning.main, 0.08)
                    : "background.paper",
                borderLeft: index < 3 ? `3px solid ${theme.palette.warning.main}` : "none",
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/profile/${player.userId}`)}
                aria-label={t('ranking.weekly.viewProfile', { name: player.userName })}
                sx={{
                  '&.Mui-focusVisible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                }}
              >
              <CardContent sx={{ py: 1.5 }}>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                >
                  <Box sx={{ width: 36, display: "flex", justifyContent: "center" }}>
                    {index < 3 ? (
                      <Box
                        aria-hidden="true"
                        data-ranking-medal={index + 1}
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: MEDAL_COLORS[index],
                          color: theme.palette.getContrastText(MEDAL_COLORS[index]),
                          boxShadow: `0 0 0 1px ${alpha(theme.palette.getContrastText(MEDAL_COLORS[index]), 0.24)} inset`,
                        }}
                      >
                        <TrophyIcon sx={{ fontSize: 20 }} />
                      </Box>
                    ) : (
                      <Typography variant="h6" fontWeight="bold">
                        {index + 1}
                      </Typography>
                    )}
                  </Box>

                  <Avatar
                    src={player.userPhoto}
                    alt={player.userName}
                    sx={{ width: 40, height: 40 }}
                  >
                    {player.userName?.charAt(0) || "?"}
                  </Avatar>

                  <Box flex={1} minWidth={0}>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                      {player.userName}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {player.goals > 0 && (
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          <SoccerIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {player.goals}
                          </Typography>
                        </Stack>
                      )}
                      {player.assists > 0 && (
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          <AssistIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {player.assists}
                          </Typography>
                        </Stack>
                      )}
                      {player.mvp > 0 && (
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          <StarIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {player.mvp}
                          </Typography>
                        </Stack>
                      )}
                      {player.wins > 0 && (
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          <TrophyIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">
                            {player.wins}V
                          </Typography>
                        </Stack>
                      )}
                      {player.bolaMurcha > 0 && (
                        <Typography variant="caption" color="error">
                          💨{player.bolaMurcha}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {player.points}
                  </Typography>
                </Stack>
              </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </PageContainer>
  );
};
