import { PageContainer } from '../components/common/PageContainer';
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
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  SportsSoccer,
  Send as SendIcon,
  Check as AcceptIcon,
  Close as DeclineIcon,
  EmojiEvents as GoalIcon,
} from "@mui/icons-material";
import { useGroupChallenges, useChallengeGroup, useRespondChallenge, useUpdateChallengeProgress, GroupChallenge } from "../hooks/useGroupChallenges";
import { useOfficialGroups } from "../hooks/useOfficialGroups";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useTranslation } from "react-i18next";

export const GroupChallengesScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t("challenges.title"));
  const { groupId } = useParams<{ groupId: string }>();
  const goBack = useNavigateBack(`/group/${groupId}`);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // #2238
  const { data: challenges, isLoading, error, refetch } = useGroupChallenges(groupId);
  const { data: officialGroups = [] } = useOfficialGroups();
  const challengeGroup = useChallengeGroup();
  const respond = useRespondChallenge();
  const updateProgress = useUpdateChallengeProgress();

  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [goal, setGoal] = useState("");
  const [targetCount, setTargetCount] = useState(3);
  const [groupTouched, setGroupTouched] = useState(false); // #2231
  const [dateTouched, setDateTouched] = useState(false); // #2231
  const [goalTouched, setGoalTouched] = useState(false);
  const [targetTouched, setTargetTouched] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const currentGroup = officialGroups.find((g) => g.id === groupId);

  const handleSendChallenge = async () => {
    if (!currentGroup || !selectedGroupId || !goal.trim() || targetCount < 1 || !deadline) return;
    const target = officialGroups.find((g) => g.id === selectedGroupId);
    if (!target) return;

    try {
      await challengeGroup.mutateAsync({
        challengerGroupId: currentGroup.id,
        challengerGroupName: currentGroup.name,
        challengedGroupId: target.id,
        challengedGroupName: target.name,
        proposedDate,
        goal,
        targetCount,
        deadline,
      });
      setChallengeDialogOpen(false);
      setSelectedGroupId("");
      setProposedDate("");
      setDeadline("");
      setGoal("");
      setTargetCount(3);
      setGroupTouched(false);
      setDateTouched(false);
      setGoalTouched(false);
      setTargetTouched(false);
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

  const handleProgress = async (challenge: GroupChallenge, progress: number) => {
    setUpdatingId(challenge.id);
    try {
      await updateProgress.mutateAsync({ challenge, progress });
    } finally {
      setUpdatingId(null);
    }
  };

  const resetDialog = () => {
    setChallengeDialogOpen(false);
    setGroupTouched(false);
    setDateTouched(false);
    setGoalTouched(false);
    setTargetTouched(false);
  };

  return (
    <PageContainer maxWidth="list">
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton onClick={goBack} aria-label={t("common.back")}>
          <BackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight="bold" flex={1} noWrap>
          {t("challenges.title")}
        </Typography>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          onClick={() => setChallengeDialogOpen(true)}
          disabled={!currentGroup}
        >
          {t("challenges.challenge")}
        </Button>
      </Stack>

      {isLoading && (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      )}

      {/* #2215: estado de erro dedicado quando o hook falha. */}
      {!isLoading && error && (
        <ErrorState message={t("challenges.loadError")} onRetry={() => refetch()} />
      )}

      {!isLoading && !error && (!challenges || challenges.length === 0) && (
        <EmptyState
          icon={<SportsSoccer />}
          title={t("challenges.emptyTitle")}
          description={t("challenges.emptyDesc")}
        />
      )}

      {!isLoading && !error && challenges && challenges.length > 0 && (
        <Stack spacing={2}>
          {challenges.map((challenge: GroupChallenge) => (
            <Card key={challenge.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
                  <Avatar sx={{ bgcolor: "secondary.main" }}>
                    <GoalIcon />
                  </Avatar>
                  <Box flex={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        label={challenge.challengerGroupId === groupId ? t("challenges.sent") : t("challenges.received")}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={
                          challenge.status === "PENDING"
                            ? t("challenges.statusPending")
                            : challenge.status === "ACCEPTED"
                            ? t("challenges.statusAccepted")
                            : challenge.status === "DECLINED"
                            ? t("challenges.statusDeclined")
                            : t("challenges.statusFinished")
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
                      />
                    </Stack>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {t("challenges.matchup", {
                        challenger: challenge.challengerGroupName,
                        challenged: challenge.challengedGroupName,
                      })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {challenge.goal}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t("challenges.deadline", { date: challenge.deadline })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {challenge.proposedDate
                        ? t("challenges.proposedDate", { date: challenge.proposedDate })
                        : t("challenges.dateToArrange")}
                    </Typography>
                    <Box mt={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="caption" color="text.secondary">
                          {t("challenges.progress")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {challenge.currentProgress}/{challenge.targetCount}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (challenge.currentProgress / challenge.targetCount) * 100)}
                        sx={{ mt: 0.5, height: 8, borderRadius: 999 }}
                      />
                    </Box>
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
                        {t("challenges.accept")}
                      </Button>
                      <IconButton
                        color="error"
                        onClick={() => handleRespond(challenge.id, "DECLINED")}
                        disabled={respondingId === challenge.id}
                        aria-label={t("challenges.declineChallenge")}
                      >
                        <DeclineIcon />
                      </IconButton>
                    </Stack>
                  )}
                  {challenge.status === "ACCEPTED" && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={updatingId === challenge.id}
                        onClick={() => handleProgress(challenge, challenge.currentProgress + 1)}
                      >
                        {updatingId === challenge.id ? <CircularProgress size={16} /> : t("challenges.addProgress")}
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={updatingId === challenge.id}
                        onClick={() => handleProgress(challenge, challenge.targetCount)}
                      >
                        {t("challenges.finish")}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={challengeDialogOpen} onClose={resetDialog} maxWidth="sm" fullWidth fullScreen={isMobile} aria-labelledby="challenge-dialog-title">
        <DialogTitle id="challenge-dialog-title">{t("challenges.challengeGroup")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              fullWidth
              label={t("challenges.opponentGroup")}
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              onBlur={() => setGroupTouched(true)}
              error={groupTouched && !selectedGroupId}
              helperText={groupTouched && !selectedGroupId ? t("validation.selectRequired") : " "}
              SelectProps={{ native: true }}
            >
              <option value="">{t("challenges.selectGroup")}</option>
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
              label={t("challenges.goalLabel")}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onBlur={() => setGoalTouched(true)}
              error={goalTouched && !goal.trim()}
              helperText={goalTouched && !goal.trim() ? t("challenges.validationGoal") : t("challenges.goalHelper")}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              fullWidth
              label={t("challenges.targetLabel")}
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              onBlur={() => setTargetTouched(true)}
              error={targetTouched && targetCount < 1}
              helperText={targetTouched && targetCount < 1 ? t("challenges.validationTarget") : t("challenges.targetHelper")}
              inputProps={{ min: 1, max: 999 }}
            />
            <TextField
              fullWidth
              label={t("challenges.deadlineLabel")}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onBlur={() => setDateTouched(true)}
              error={dateTouched && !deadline}
              helperText={dateTouched && !deadline ? t("challenges.validationDeadline") : " "}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label={t("challenges.proposedDateLabel")}
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              helperText={t("challenges.proposedDateHelper")}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetDialog}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleSendChallenge}
            disabled={challengeGroup.isPending || !selectedGroupId || !goal.trim() || targetCount < 1 || !deadline}
          >
            {challengeGroup.isPending ? <CircularProgress size={20} color="inherit" /> : t("challenges.sendChallenge")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
