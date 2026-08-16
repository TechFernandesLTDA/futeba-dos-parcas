import React, { useEffect, useMemo, useState } from "react";
import { useNavigateBack } from "../hooks/useNavigateBack";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Select,
  MenuItem,
  FormControl,
  Skeleton,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import {
  Star as StarIcon,
} from "@mui/icons-material";
import { useDreamTeam, usePlayedAgainst, useSaveDreamTeam, DreamTeamPlayer } from "../hooks/useDreamTeam";
import { PageContainer } from "../components/common/PageContainer";
import { ScreenHeader } from "../components/common/ScreenHeader";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../components/common/ErrorState";

const DEFAULT_DREAM_TEAM_SLOTS: DreamTeamPlayer[] = [
  { userId: "", position: "GOALKEEPER" },
  { userId: "", position: "DEFENDER" },
  { userId: "", position: "DEFENDER" },
  { userId: "", position: "MIDFIELDER" },
  { userId: "", position: "STRIKER" },
];

export const DreamTeamScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t("dreamTeam.title"));
  const goBack = useNavigateBack("/?tab=4");
  const { data: currentTeam, isLoading: teamLoading, error: teamError, refetch: refetchTeam } = useDreamTeam();
  const { data: availablePlayers = [], isLoading: playersLoading, error: playersError, refetch: refetchPlayers } = usePlayedAgainst();
  const saveTeam = useSaveDreamTeam();

  const POSITIONS = [
    { value: "GOALKEEPER", label: t("profile.positionGoalkeeper") },
    { value: "DEFENDER", label: t("profile.positionDefender") },
    { value: "MIDFIELDER", label: t("profile.positionMidfielder") },
    { value: "STRIKER", label: t("profile.positionStriker") },
  ];

  const [selectedPlayers, setSelectedPlayers] = useState<DreamTeamPlayer[]>(
    currentTeam?.players || DEFAULT_DREAM_TEAM_SLOTS
  );

  useEffect(() => {
    if (currentTeam?.players?.length) {
      setSelectedPlayers(currentTeam.players);
      return;
    }

    if (!teamLoading && !currentTeam) {
      setSelectedPlayers(DEFAULT_DREAM_TEAM_SLOTS);
    }
  }, [currentTeam, teamLoading]);

  const handleSelect = (index: number, userId: string) => {
    setSelectedPlayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], userId };
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await saveTeam.mutateAsync(selectedPlayers);
    } catch {
      /* error handled by mutation onError */
    }
  };

  // Perf: lookup por id e set de selecionados memoizados — antes cada slot
  // fazia availablePlayers.find() O(n) e reconstruía o Set a cada render
  // (cada seleção num Select re-renderiza a tela com 5 slots × n jogadores).
  const playersById = useMemo(
    () => new Map(availablePlayers.map((p) => [p.id, p] as const)),
    [availablePlayers],
  );
  const selectedIds = useMemo(
    () => new Set(selectedPlayers.map((p) => p.userId).filter(Boolean)),
    [selectedPlayers],
  );

  if (teamLoading || playersLoading) {
    return (
      <PageContainer maxWidth="form">
        <Stack spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      </PageContainer>
    );
  }

  // #2215: estado de erro dedicado quando qualquer um dos hooks falha.
  if (teamError || playersError) {
    return (
      <PageContainer maxWidth="form">
        <ErrorState
          message={t("dreamTeam.loadError")}
          onRetry={() => {
            if (teamError) refetchTeam();
            if (playersError) refetchPlayers();
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="form">
      {/* #4051: migrado para ScreenHeader — o header manual não-sticky empilhava
          com a MobileTopBar global no mobile (2 botões "Voltar", 2 títulos). */}
      <ScreenHeader
        title={t("dreamTeam.title")}
        onBack={goBack}
        backAriaLabel={t("common.back")}
      />

      <Typography variant="body2" color="text.secondary" mb={3}>
        {t("dreamTeam.description")}
      </Typography>

      {selectedPlayers.map((slot, index) => {
        const selected = playersById.get(slot.userId);
        return (
          <Card key={`${slot.position}-${index}`} sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
                  {selected ? (
                    selected.name.charAt(0)
                  ) : (
                    <StarIcon />
                  )}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {POSITIONS.find((pos) => pos.value === slot.position)?.label}
                  </Typography>
                  <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                    <Select
                      value={slot.userId}
                      onChange={(e) => handleSelect(index, e.target.value as string)}
                      displayEmpty
                      aria-label={t("dreamTeam.selectPlayerAria", { position: POSITIONS.find((pos) => pos.value === slot.position)?.label })}
                      renderValue={(val) => {
                        if (!val) return t("dreamTeam.selectPlayer");
                        const p = playersById.get(val);
                        return p ? `${p.name} (⭐${p.autoStrikerRating.toFixed(1)})` : val;
                      }}
                    >
                      <MenuItem value="">
                        <em>{t("dreamTeam.none")}</em>
                      </MenuItem>
                      {availablePlayers
                        .filter((p: { id: string }) => !selectedIds.has(p.id) || p.id === slot.userId)
                        .map((p: { id: string; photoUrl?: string; name: string; autoStrikerRating: number }) => (
                          <MenuItem key={p.id} value={p.id}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar src={p.photoUrl} alt={p.name} sx={{ width: 28, height: 28 }}>
                                {p.name.charAt(0)}
                              </Avatar>
                              <Typography variant="body2">
                                {p.name}
                              </Typography>
                              <Chip
                                label={`${p.autoStrikerRating.toFixed(1)}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Stack>
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      })}

      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={saveTeam.isPending || selectedPlayers.some((p) => !p.userId)}
        onClick={handleSave}
        sx={{ mt: 2 }}
      >
        {saveTeam.isPending ? <CircularProgress size={24} color="inherit" /> : t("dreamTeam.saveTeam")}
      </Button>
    </PageContainer>
  );
};
