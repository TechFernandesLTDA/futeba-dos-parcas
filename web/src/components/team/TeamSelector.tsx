import React from 'react';
import { Autocomplete, TextField, Box, Typography, Avatar } from '@mui/material';
import { useTeams } from '../../contexts/TeamsContext';

interface TeamSelectorProps {
  value: string | null;
  onChange: (teamId: string | null) => void;
  label?: string;
  optional?: boolean;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({
  value,
  onChange,
  label = 'Time do Coração',
  optional = false,
}) => {
  const { teams, loading } = useTeams();

  const selectedTeam = teams.find((t) => t.id === value) || null;

  return (
    <Autocomplete
      value={selectedTeam}
      onChange={(_, newValue) => {
        onChange(newValue?.id || null);
      }}
      options={teams}
      loading={loading}
      loadingText="Carregando times..."
      noOptionsText="Nenhum time encontrado"
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {option.badgeUrl ? (
              <Avatar
                src={option.badgeUrl}
                alt={option.name}
                sx={{ width: 28, height: 28 }}
                imgProps={{ style: { objectFit: 'contain' } }}
              />
            ) : (
              <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.light' }}>
                {option.shortName || option.name.substring(0, 3)}
              </Avatar>
            )}
            <Box>
              <Typography variant="body2">{option.name}</Typography>
              {option.category && (
                <Typography variant="caption" color="text.secondary">
                  {option.category}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={optional ? `${label} (opcional)` : label}
          placeholder="Buscar time..."
        />
      )}
      renderTags={() => null}
      fullWidth
      clearOnBlur
      handleHomeEndKeys
    />
  );
};
