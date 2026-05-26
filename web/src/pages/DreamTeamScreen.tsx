import React, { useState } from "react";
import { useNavigateBack } from "../hooks/useNavigateBack";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Skeleton,
  Stack,
  Typography,
  CircularProgress,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { useDreamTeam, usePlayedAgainst, useSaveDreamTeam, DreamTeamPlayer } from "../hooks/useDreamTeam";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const POSITIONS = [
  { value: "GOALKEEPER", label: "Goleiro" },
  { value: "DEFENDER", label: "Zagueiro" },
  { value: "MIDFIELDER", label: "Meia" },
  { value: "STRIKER", label: "Atacante" },
];

export const DreamTeamScreen: React.FC = () => {
  useDocumentTitle("Meu Time dos Sonhos");
  const goBack = useNavigateBack("/?tab=4");
  const { data: currentTeam, isLoading: teamLoading } = useDreamTeam();
  const { data: availablePlayers = [], isLoading: playersLoading } = usePlayedAgainst();
  const saveTeam = useSaveDreamTeam();

  const [selectedPlayers, setSelectedPlayers] = useState<DreamTeamPlayer[]>(
    currentTeam?.players || [
      { userId: "", position: "GOALKEEPER" },
      { userId: "", position: "DEFENDER" },
      { userId: "", position: "DEFENDER" },
      { userId: "", position: "MIDFIELDER" },
      { userId: "", position: "STRIKER" },
    ]
  );

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

  const selectedIds = new Set(selectedPlayers.map((p) => p.userId).filter(Boolean));

  if (teamLoading || playersLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold" flex={1}>
          Meu Time dos Sonhos
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Monte seu time fictício com os melhores jogadores que você já enfrentou! Seu time pontua junto com o ranking semanal.
      </Typography>

      {selectedPlayers.map((slot, index) => {
        const selected = availablePlayers.find((p: { id: string; name: string; photoUrl?: string; autoStrikerRating: number }) => p.id === slot.userId);
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
                      renderValue={(val) => {
                        if (!val) return "Selecionar jogador...";
                        const p = availablePlayers.find((pl: { id: string; name: string; autoStrikerRating: number }) => pl.id === val);
                        return p ? `${p.name} (⭐${p.autoStrikerRating.toFixed(1)})` : val;
                      }}
                    >
                      <MenuItem value="">
                        <em>Nenhum</em>
                      </MenuItem>
                      {availablePlayers
                        .filter((p: { id: string }) => !selectedIds.has(p.id) || p.id === slot.userId)
                        .map((p: { id: string; photoUrl?: string; name: string; autoStrikerRating: number }) => (
                          <MenuItem key={p.id} value={p.id}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar src={p.photoUrl} sx={{ width: 28, height: 28 }}>
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
        {saveTeam.isPending ? <CircularProgress size={24} color="inherit" /> : "Salvar Time"}
      </Button>
    </Container>
  );
};
