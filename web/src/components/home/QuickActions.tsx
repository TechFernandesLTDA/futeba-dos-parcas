import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Public as PublicIcon,
  GroupAdd as InviteIcon,
  Groups as DreamTeamIcon,
  EmojiEvents as RankingIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();

  const actions = [
    { label: t("home.publicGames"), icon: <PublicIcon />, path: "/public-games", colorKey: "success" as const },
    { label: t("home.inviteFriends"), icon: <InviteIcon />, path: "/invite-friend", colorKey: "secondary" as const },
    { label: t("home.dreamTeam"), icon: <DreamTeamIcon />, path: "/dream-team", colorKey: "warning" as const },
    { label: t("home.weeklyRanking"), icon: <RankingIcon />, path: "/weekly-ranking", colorKey: "info" as const },
  ];

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" mb={1}>
          {t("home.quickActions")}
        </Typography>
        <Stack direction="row" spacing={1}>
          {actions.map((action) => (
            <CardActionArea
              key={action.path}
              onClick={() => navigate(action.path)}
              sx={{
                flex: 1,
                borderRadius: 2,
                p: 1,
                textAlign: "center",
                bgcolor: alpha(theme.palette[action.colorKey].main, 0.08),
                "&:hover": {
                  bgcolor: alpha(theme.palette[action.colorKey].main, 0.16),
                },
              }}
            >
              <Box
                sx={{ color: theme.palette[action.colorKey].main, mb: 0.5, display: "flex", justifyContent: "center" }}
              >
                {action.icon}
              </Box>
              <Typography variant="caption" lineHeight={1.2}>
                {action.label}
              </Typography>
            </CardActionArea>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};
