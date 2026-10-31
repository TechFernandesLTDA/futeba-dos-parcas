import React from 'react';
import {
  Checkbox,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { OpenInNew as OpenIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  FIELD_TYPE_CONFIG,
  LOCATION_PUBLICATION_STATUS_LABELS,
  Location,
} from '../../types/location';
import { getLocationPublicationStatus, getLocationNeighborhood } from './manageLocationFilters';

interface TableProps {
  locations: readonly Location[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (location: Location) => void;
  showSelection: boolean;
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
};

const formatDate = (value: unknown) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('pt-BR') : '—';
};

/** Tabela densa do desktop (#4372). As ações pesadas ficam na vista de cards. */
export const ManageLocationTable: React.FC<TableProps> = ({
  locations,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
  showSelection,
}) => {
  const { t } = useTranslation();
  const selectedCount = locations.filter((location) => selectedIds.has(location.id)).length;
  const allSelected = locations.length > 0 && selectedCount === locations.length;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100dvh - 280px)' }}>
      <Table size="small" stickyHeader aria-label={t('locations.manageFilters.tableLabel')}>
        <TableHead>
          <TableRow>
            {showSelection && (
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  inputProps={{ 'aria-label': t('locations.manageFilters.selectAll') }}
                />
              </TableCell>
            )}
            <TableCell>{t('locations.manageFilters.col.name')}</TableCell>
            <TableCell>{t('locations.manageFilters.col.place')}</TableCell>
            <TableCell>{t('locations.manageFilters.col.status')}</TableCell>
            <TableCell>{t('locations.manageFilters.col.type')}</TableCell>
            <TableCell>{t('locations.manageFilters.col.updated')}</TableCell>
            <TableCell align="right">{t('locations.manageFilters.col.open')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {locations.map((location) => {
            const publication = getLocationPublicationStatus(location);
            const neighborhood = getLocationNeighborhood(location);
            const selected = selectedIds.has(location.id);
            return (
              <TableRow
                key={location.id}
                hover
                selected={selected}
                onClick={() => onOpen(location)}
                sx={{ cursor: 'pointer' }}
              >
                {showSelection && (
                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onChange={() => onToggle(location.id)}
                      inputProps={{ 'aria-label': t('locations.manageFilters.selectRow', { name: location.name }) }}
                    />
                  </TableCell>
                )}
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" fontWeight={600} noWrap title={location.name}>{location.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {[location.street || location.address].filter(Boolean).join(' ')}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {[location.city, location.state].filter(Boolean).join(' - ') || '—'}
                  {neighborhood && (
                    <Typography variant="caption" color="text.secondary" component="div">{neighborhood}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={LOCATION_PUBLICATION_STATUS_LABELS[publication]}
                    color={publication === 'PUBLISHED' ? 'success' : publication === 'DRAFT' ? 'default' : 'warning'}
                    variant="outlined"
                    sx={{ mr: 0.5 }}
                  />
                  {location.isVerified !== true && (
                    <Chip size="small" color="warning" label={t('locations.manageFilters.unverified')} sx={{ mr: 0.5 }} />
                  )}
                  {location.isActive === false && (
                    <Chip size="small" color="error" variant="outlined" label={t('locations.manageFilters.inactive')} />
                  )}
                </TableCell>
                <TableCell>
                  {location.fieldType ? FIELD_TYPE_CONFIG[location.fieldType]?.label ?? location.fieldType : '—'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(location.updatedAt || location.createdAt)}</TableCell>
                <TableCell align="right">
                  <Tooltip title={t('locations.manageFilters.openLocation')}>
                    <IconButton
                      size="small"
                      aria-label={t('locations.manageFilters.openLocationNamed', { name: location.name })}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(location);
                      }}
                    >
                      <OpenIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
