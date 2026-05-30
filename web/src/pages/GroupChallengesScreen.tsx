import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigateBack } from "../hooks/useNavigateBack";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  SportsSoccer,
  Send as SendIcon,
  Check as AcceptIcon,
  Close as DeclineIcon,
} from "@mui/icons-material";
import { useGroupChallenges, useChallengeGroup, useRespondChallenge, GroupChallenge } from "../hooks/useGroupChallenges";
import { useOfficialGroups } from "../hooks/useOfficialGroups";
import { EmptyState } from "../components/common/EmptyState";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export const GroupChallengesScreen: React.FC = () => {
  useDocumentTitle("Desafios");
  const { groupId } = useParams<{ groupId: string }>();
  const goBack = useNavigateBack(`/group/${groupId}`);
  const { data: challenges, isLoading, refetch } = useGroupChallenges(groupId);
  const { data: officialGroups = [] } = useOfficialGroups();
  const challengeGroup = useChallengeGroup();
  const respond = useRespondChallenge();

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const currentGroup = officialGroups.find((g) => g.id === groupId);

  const handleSendChallenge = async () => {
    if (!currentGroup || !selectedGroupId || !proposedDate) return;
    const target = officialGroups.find((g) => g.id === selectedGroupId);
    if (!target) return;

    try {
      await challengeGroup.mutateAsync({
        challengerGroupId: currentGroup.id,
        challengerGroupName: currentGroup.name,
        challengedGroupId: target.id,
        challengedGroupName: target.name,
        proposedDate,
      });
      setChallengeDialogOpen(false);
      setSelectedGroupId("");
      setProposedDate("");
      refetch();
    } catch {
      /* error handled by mutation onError */
    }
  };

  const handleRespond = async (challengeId: string, status: "ACCEPTED" | "DECLINED") => {
    setRespondingId(challengeId);
    try {
      await respond.mutateAsync({ challengeId, status });
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold" flex={1} noWrap>
          Desafios
        </Typography>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          onClick={() => setChallengeDialogOpen(true)}
          disabled={!currentGroup}
        >
          Desafiar
        </Button>
      </Stack>

      {isLoading && (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      )}

      {!isLoading && (!challenges || challenges.length === 0) && (
        <EmptyState
          icon={<SportsSoccer />}
          title="Nenhum desafio recebido ainda"
          description="Desafie outro grupo oficial para uma pelada!"
        />
      )}

      {!isLoading && challenges && challenges.length > 0 && (
        <Stack spacing={2}>
          {challenges.map((challenge: GroupChallenge) => (
            <Card key={challenge.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: "secondary.main" }}>
                    {challenge.challengerGroupName?.charAt(0)}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {challenge.challengerGroupName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {challenge.proposedDate
                        ? `Data proposta: ${challenge.proposedDate}`
                        : "Data a combinar"}
                    </Typography>
                    <Chip
                      label={
                        challenge.status === "PENDING"
                          ? "Pendente"
                          : challenge.status === "ACCEPTED"
                          ? "Aceito"
                          : challenge.status === "DECLINED"
                          ? "Recusado"
                          : "Finalizado"
                      }
                      size="small"
                      color={
                        challenge.status === "ACCEPTED"
                          ? "success"
                          : challenge.status === "DECLINED"
                          ? "error"
                          : challenge.status === "FINISHED"
                          ? "info"
                          : "warning"
                      }
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                  {challenge.status === "PENDING" && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={
                          respondingId === challenge.id ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <AcceptIcon />
                          )
                        }
                        disabled={respondingId === challenge.id}
                        onClick={() => handleRespond(challenge.id, "ACCEPTED")}
                      >
                        Aceitar
                      </Button>
                      <IconButton
                        color="error"
                        onClick={() => handleRespond(challenge.id, "DECLINED")}
                        disabled={respondingId === challenge.id}
                        aria-label="Recusar desafio"
                      >
                        <DeclineIcon />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={challengeDialogOpen} onClose={() => setChallengeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Desafiar Grupo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              fullWidth
              label="Grupo adversário"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              SelectProps={{ native: true }}
            >
              <option value="">Selecionar grupo...</option>
              {officialGroups
                .filter((g) => g.id !== groupId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </TextField>
            <TextField
              fullWidth
              label="Data proposta"
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChallengeDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSendChallenge}
            disabled={challengeGroup.isPending || !selectedGroupId || !proposedDate}
          >
            {challengeGroup.isPending ? <CircularProgress size={20} color="inherit" /> : "Enviar Desafio"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
