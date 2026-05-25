import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { EmojiEvents as TrophyIcon } from "@mui/icons-material";
import { useHallOfFame } from "../../hooks/useHallOfFame";
import { useTranslation } from "react-i18next";

interface Props {
  groupId: string;
}

export const HallOfFame: React.FC<Props> = ({ groupId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: seasons, isLoading } = useHallOfFame(groupId);

  if (isLoading) {
    return (
      <Stack spacing={2}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Stack>
    );
  }

  if (!seasons || seasons.length === 0) {
    return (
      <Stack alignItems="center" spacing={2} py={4}>
        <TrophyIcon sx={{ fontSize: 48, color: "text.secondary" }} />
        <Typography variant="body1" color="text.secondary">
          {t("group.hallOfFameEmpty")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("group.hallOfFameEmptyDesc")}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("group.hallOfFame")}
      </Typography>
      {seasons.map((season) => (
        <Card key={season.id} variant="outlined">
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: "warning.main", width: 40, height: 40 }}>
                <TrophyIcon />
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {season.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" color="text.secondary">
                    {t("group.hallOfFameMvpLabel")}
                  </Typography>
                  {season.mvpUserName ? (
                    <Chip
                      avatar={
                        <Avatar sx={{ bgcolor: "warning.dark" }}>
                          {season.mvpUserName.charAt(0)}
                        </Avatar>
                      }
                      label={season.mvpUserName}
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() => navigate(`/profile/${season.mvpUserId}`)}
                      sx={{ cursor: "pointer" }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                  {season.mvpPoints !== undefined && (
                    <Chip
                      label={`${season.mvpPoints} pts`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Chip
                    label={t("group.hallOfFamePlayers", { count: season.playersCount })}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
