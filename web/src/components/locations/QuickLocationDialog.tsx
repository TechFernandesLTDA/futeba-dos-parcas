import React, { useState, useRef } from 'react';
import {

  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Box,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { FieldType, FIELD_TYPE_LABELS } from '../../types/game';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { createLogger } from '../../utils/logger';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { GAME_VALIDATION } from '../../utils/validationConstants';

const logger = createLogger('QuickLocationDialog');

interface QuickLocationDialogProps {
  open: boolean;
  onClose: () => void;
  onLocationCreated: (location: { id: string; name: string; address: string; capacity?: number; defaultPrice?: number }) => void;
}

export const QuickLocationDialog: React.FC<QuickLocationDialogProps> = ({
  open,
  onClose,
  onLocationCreated,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { user, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<FieldType>('SOCIETY');
  const [capacity, setCapacity] = useState<number>(14);
  const [defaultPrice, setDefaultPrice] = useState<number>(0);
  const [cepLoading, setCepLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cepAbortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setName('');
    setCep('');
    setAddress('');
    setType('SOCIETY');
    setCapacity(14);
    setDefaultPrice(0);
    setErrors({});
    setCepLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    setCep(digits);
    setErrors((prev) => ({ ...prev, cep: '' }));

    if (digits.length === 8) {
      cepAbortRef.current?.abort();
      const controller = new AbortController();
      cepAbortRef.current = controller;

      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('CEP not found');
        const data = await response.json();
        if (data.erro) {
          setErrors((prev) => ({ ...prev, cep: 'CEP nao encontrado' }));
          return;
        }
        const street = [data.logradouro, data.complemento].filter(Boolean).join(', ');
        const area = [data.bairro, data.localidade, data.uf].filter(Boolean).join(', ');
        const fullAddress = area ? `${street} - ${area}` : street;
        setAddress(fullAddress);
        if (!name.trim()) {
          setName(`Quadra ${data.logradouro?.split(' ')[0] || data.localidade || ''}`);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        setErrors((prev) => ({ ...prev, cep: 'Erro ao buscar CEP' }));
      } finally {
        setCepLoading(false);
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!address.trim()) newErrors.address = 'Endereço é obrigatório';
    if (capacity < GAME_VALIDATION.MIN_PLAYERS) newErrors.capacity = `Capacidade mínima: ${GAME_VALIDATION.MIN_PLAYERS}`;
    if (capacity > GAME_VALIDATION.MAX_PLAYERS) newErrors.capacity = `Capacidade máxima: ${GAME_VALIDATION.MAX_PLAYERS}`;
    if (defaultPrice < 0) newErrors.defaultPrice = 'Preço não pode ser negativo';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const uid = firebaseUser?.uid || user?.id;
    if (!uid) {
      showError(t('feedback.auth.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const locRef = collection(db, 'locations');
      const docRef = await addDoc(locRef, {
        name: name.trim(),
        address: address.trim(),
        cep: cep || '',
        field_type: type,
        primary_field_type: type,
        capacity: capacity,
        default_hourly_price: defaultPrice,
        owner_id: uid,
        managers: [uid],
        is_verified: false,
        is_active: true,
        field_count: 0,
        has_active_fields: false,
        has_lighting: false,
        has_parking: false,
        has_showers: false,
        amenities: [],
        rating: 0,
        rating_count: 0,
        opening_time: '06:00',
        closing_time: '23:00',
        operating_days: [1, 2, 3, 4, 5, 6, 7],
        min_game_duration_minutes: 60,
        description: '',
        street: '',
        number: '',
        complement: '',
        district: '',
        city: '',
        state: '',
        country: 'BR',
        neighborhood: '',
        region: '',
        instagram: '',
        phone: '',
        website: '',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      showSuccess(`Local "${name.trim()}" criado com sucesso!`);
      onLocationCreated({
        id: docRef.id,
        name: name.trim(),
        address: address.trim(),
        capacity,
        defaultPrice,
      });
      reset();
    } catch (err) {
      logger.error('Error creating location:', err);
      showError(getFirestoreErrorMessage(err) || 'Erro ao criar local');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Criar Local</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            autoFocus
            label="Nome do Local"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: '' })); }}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            label="CEP"
            value={cep}
            onChange={(e) => handleCepChange(e.target.value)}
            fullWidth
            placeholder="00000000"
            error={!!errors.cep}
            helperText={errors.cep || (cepLoading ? 'Buscando endereco...' : 'Digite o CEP para preencher automaticamente')}
            InputProps={{
              endAdornment: cepLoading ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : undefined,
            }}
            inputMode="numeric"
          />
          <TextField
            label="Endereco Completo"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setErrors((prev) => ({ ...prev, address: '' })); }}
            error={!!errors.address}
            helperText={errors.address}
            fullWidth
            required
            multiline
            rows={3}
            inputProps={{ maxLength: 500 }}
          />
          <TextField
            select
            label="Tipo de Campo"
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
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
              label="Capacidade (jogadores)"
              type="number"
              value={capacity}
              onChange={(e) => { const v = parseInt(e.target.value); setCapacity(isNaN(v) ? 14 : v); setErrors((prev) => ({ ...prev, capacity: '' })); }}
              error={!!errors.capacity}
              helperText={errors.capacity || `${GAME_VALIDATION.MIN_PLAYERS}-${GAME_VALIDATION.MAX_PLAYERS} jogadores`}
              fullWidth
              inputProps={{ min: GAME_VALIDATION.MIN_PLAYERS, max: GAME_VALIDATION.MAX_PLAYERS }}
            />
            <TextField
              label="Preço/hora (R$)"
              type="number"
              value={defaultPrice}
              onChange={(e) => { const v = parseFloat(e.target.value); setDefaultPrice(isNaN(v) ? 0 : v); setErrors((prev) => ({ ...prev, defaultPrice: '' })); }}
              error={!!errors.defaultPrice}
              helperText={errors.defaultPrice || 'Opcional'}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              }}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
        >
          {loading ? 'Salvando...' : 'Criar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
