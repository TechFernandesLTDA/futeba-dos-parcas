import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  FormLabel,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  InputAdornment,
  Alert,
  CircularProgress,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useCreateGame } from '../../hooks/useGames';
import { useGroupDetail } from '../../hooks/useGroups';
import { useLocations } from '../../hooks/useLocations';
import { FieldType, PixKeyType } from '../../types/game';
import { FIELD_TYPE_LABELS, PIX_KEY_TYPE_LABELS } from '../../types/game';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('CreateGameScreen');

interface GameFormData {
  locationId: string;
  locationName: string;
  locationAddress: string;
  locationLat?: number;
  locationLng?: number;
  date: string;
  time: string;
  endTime: string;
  fieldType: FieldType;
  gameType: string;
  maxPlayers: number;
  maxGoalkeepers: number;
  numberOfTeams: number;
  dailyPrice: number;
  pixPaymentEnabled: boolean;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixBeneficiaryName: string;
  rules: string;
  groupId?: string;
  groupName?: string;
  isPublic: boolean;
}

const steps = ['Local e Data', 'Configurações', 'Pagamento', 'Regras'];

const CUSTOM_LOCATION = '__custom__';

const defaultFormData: GameFormData = {
  locationId: '',
  locationName: '',
  locationAddress: '',
  date: '',
  time: '',
  endTime: '',
  fieldType: 'SOCIETY',
  gameType: 'SOCIETY',
  maxPlayers: 14,
  maxGoalkeepers: 2,
  numberOfTeams: 2,
  dailyPrice: 0,
  pixPaymentEnabled: false,
  pixKey: '',
  pixKeyType: 'RANDOM',
  pixBeneficiaryName: '',
  rules: '',
  isPublic: false,
};

export const CreateGameScreen: React.FC = () => {
  useDocumentTitle('Criar Jogo');
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId?: string }>();
  const theme = useTheme();

  const { group } = useGroupDetail(groupId || null);
  const { createGame, loading, error } = useCreateGame();
  const { locations, loading: locationsLoading } = useLocations();
  const { showSuccess, showError } = useToast();
  const [useCustomLocation, setUseCustomLocation] = useState(false);

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<GameFormData>({
    ...defaultFormData,
    groupId: groupId || undefined,
    groupName: group?.name || undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (group && !formData.groupId) {
      setFormData((prev) => ({
        ...prev,
        groupId: groupId,
        groupName: group.name,
      }));
    }
  }, [group, groupId]);

  const handleInputChange = (field: keyof GameFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 0:
        if (!formData.locationName.trim()) {
          errors.locationName = useCustomLocation ? 'Nome do local é obrigatório' : 'Selecione uma quadra';
        }
        if (useCustomLocation && !formData.locationAddress.trim()) errors.locationAddress = 'Endereço é obrigatório';
        if (!formData.date) errors.date = 'Data é obrigatória';
        if (!formData.time) errors.time = 'Horário é obrigatório';
        break;
      case 1:
        if (formData.maxPlayers < 2 || formData.maxPlayers > 50) {
          errors.maxPlayers = 'Mínimo 2, máximo 50 jogadores';
        }
        if (formData.maxGoalkeepers < 0 || formData.maxGoalkeepers > 10) {
          errors.maxGoalkeepers = 'Máximo 10 goleiros';
        }
        break;
      case 2:
        if (formData.pixPaymentEnabled) {
          if (!formData.pixKey.trim()) errors.pixKey = 'Chave Pix é obrigatória';
          if (!formData.pixBeneficiaryName.trim()) {
            errors.pixBeneficiaryName = 'Nome do beneficiário é obrigatório';
          }
        }
        break;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) return;

    try {
      const gameId = await createGame({
        ...formData,
        visibility: formData.isPublic ? 'PUBLIC_CLOSED' : 'GROUP_ONLY',
        totalCost: 0,
        players: [],
        playersCount: 0,
        goalkeepersCount: 0,
        team1Name: 'Time 1',
        team2Name: 'Time 2',
        team1Score: 0,
        team2Score: 0,
        confirmationDeadlineHours: 0,
        requireCheckin: false,
        checkinRadiusMeters: 100,
      });
      showSuccess('Jogo criado com sucesso!');
      navigate(`/game/${gameId}`);
    } catch (err) {
      logger.error('Error creating game:', err);
      showError('Erro ao criar jogo. Tente novamente.');
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {formData.groupName && (
              <Alert severity="info">
                Criando jogo para o grupo: <strong>{formData.groupName}</strong>
              </Alert>
            )}

            {/* Seletor de quadras cadastradas */}
            <TextField
              select
              label="Quadra / Local"
              value={useCustomLocation ? CUSTOM_LOCATION : formData.locationId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === CUSTOM_LOCATION) {
                  setUseCustomLocation(true);
                  setFormData((prev) => ({ ...prev, locationId: '', locationName: '', locationAddress: '' }));
                } else {
                  setUseCustomLocation(false);
                  const loc = locations.find((l) => l.id === val);
                  if (loc) {
                    setFormData((prev) => ({
                      ...prev,
                      locationId: loc.id,
                      locationName: loc.name,
                      locationAddress: loc.address || `${loc.street || ''}, ${loc.number || ''} - ${loc.district || ''}, ${loc.city || ''}`.replace(/^, | - ,|, $/g, '').trim(),
                      locationLat: loc.latitude,
                      locationLng: loc.longitude,
                    }));
                  }
                }
              }}
              error={!!formErrors.locationName}
              helperText={formErrors.locationName || (locationsLoading ? 'Carregando quadras...' : `${locations.length} quadras disponíveis`)}
              fullWidth
              required
            >
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name} {loc.city ? `— ${loc.city}` : ''}
                </MenuItem>
              ))}
              <MenuItem value={CUSTOM_LOCATION}>
                ✏️ Outro local (digitar manualmente)
              </MenuItem>
            </TextField>

            {/* Campos manuais (quando "Outro local" selecionado) */}
            {useCustomLocation && (
              <>
                <TextField
                  label="Nome do Local"
                  value={formData.locationName}
                  onChange={(e) => handleInputChange('locationName', e.target.value)}
                  error={!!formErrors.locationName}
                  helperText={formErrors.locationName}
                  fullWidth
                  required
                  placeholder="Ex: Quadra do Parque, Ginásio Municipal"
                />

                <TextField
                  label="Endereço Completo"
                  value={formData.locationAddress}
                  onChange={(e) => handleInputChange('locationAddress', e.target.value)}
                  error={!!formErrors.locationAddress}
                  helperText={formErrors.locationAddress}
                  fullWidth
                  required
                  placeholder="Ex: Rua das Flores, 123 - Centro"
                />
              </>
            )}

            {/* Resumo do local selecionado */}
            {!useCustomLocation && formData.locationName && (
              <Alert severity="success" icon={false}>
                📍 <strong>{formData.locationName}</strong>
                <br />
                {formData.locationAddress}
              </Alert>
            )}

            <TextField
              label="Data"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              error={!!formErrors.date}
              helperText={formErrors.date}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Horário de Início"
                type="time"
                value={formData.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                error={!!formErrors.time}
                helperText={formErrors.time}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Horário de Término"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              select
              label="Tipo de Quadra"
              value={formData.fieldType}
              onChange={(e) => { handleInputChange('fieldType', e.target.value); handleInputChange('gameType', e.target.value); }}
              fullWidth
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Máx. Jogadores"
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => handleInputChange('maxPlayers', parseInt(e.target.value) || 14)}
                error={!!formErrors.maxPlayers}
                helperText={formErrors.maxPlayers}
                fullWidth
                inputProps={{ min: 2, max: 50 }}
              />

              <TextField
                label="Máx. Goleiros"
                type="number"
                value={formData.maxGoalkeepers}
                onChange={(e) => handleInputChange('maxGoalkeepers', parseInt(e.target.value) || 2)}
                error={!!formErrors.maxGoalkeepers}
                helperText={formErrors.maxGoalkeepers}
                fullWidth
                inputProps={{ min: 0, max: 10 }}
              />
            </Box>

            <TextField
              label="Número de Times"
              type="number"
              value={formData.numberOfTeams}
              onChange={(e) => handleInputChange('numberOfTeams', parseInt(e.target.value) || 2)}
              fullWidth
              inputProps={{ min: 2, max: 4 }}
            />

            <FormControl>
              <FormLabel>Visibilidade</FormLabel>
              <RadioGroup
                value={formData.isPublic ? 'public' : 'private'}
                onChange={(e) => handleInputChange('isPublic', e.target.value === 'public')}
              >
                <FormControlLabel
                  value="private"
                  control={<Radio />}
                  label="Apenas membros do grupo"
                />
                <FormControlLabel
                  value="public"
                  control={<Radio />}
                  label="Público (qualquer pessoa pode ver)"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Valor por Jogador"
              type="number"
              value={formData.dailyPrice}
              onChange={(e) => handleInputChange('dailyPrice', parseFloat(e.target.value) || 0)}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.pixPaymentEnabled}
                  onChange={(e) => handleInputChange('pixPaymentEnabled', e.target.checked)}
                />
              }
              label="Aceitar pagamento via Pix"
            />

            {formData.pixPaymentEnabled && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                <TextField
                  select
                  label="Tipo de Chave Pix"
                  value={formData.pixKeyType}
                  onChange={(e) => handleInputChange('pixKeyType', e.target.value)}
                  fullWidth
                >
                  {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Chave Pix"
                  value={formData.pixKey}
                  onChange={(e) => handleInputChange('pixKey', e.target.value)}
                  error={!!formErrors.pixKey}
                  helperText={formErrors.pixKey}
                  fullWidth
                  required
                />

                <TextField
                  label="Nome do Beneficiário"
                  value={formData.pixBeneficiaryName}
                  onChange={(e) => handleInputChange('pixBeneficiaryName', e.target.value)}
                  error={!!formErrors.pixBeneficiaryName}
                  helperText={formErrors.pixBeneficiaryName}
                  fullWidth
                  required
                />
              </Box>
            )}
          </Box>
        );

      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Regras do Jogo"
              value={formData.rules}
              onChange={(e) => handleInputChange('rules', e.target.value)}
              fullWidth
              multiline
              rows={6}
              placeholder="Ex: Jogadores devem chegar 15min antes...
- Não é permitido chute a gol sem camisa
- Cartão vermelho = R$10 a mais
- Bebidas não permitidas na quadra..."
            />

            <Alert severity="info">
              As regras serão exibidas para todos os jogadores confirmados.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Criar Jogo
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical" aria-label="Etapas de criação do jogo">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                <Card sx={{ mt: 2, mb: 2 }}>
                  <CardContent>{renderStepContent(index)}</CardContent>
                </Card>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    startIcon={<BackIcon />}
                  >
                    Voltar
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  {activeStep === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={loading}
                      endIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                    >
                      Criar Jogo
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NextIcon />}
                    >
                      Próximo
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Container>
    </Box>
  );
};
