import React from 'react';
import { Autocomplete, TextField, Box, Typography, Avatar } from '@mui/material';
import { useTeams } from '../../contexts/TeamsContext';
import { useTranslation } from 'react-i18next';
import { iconSizes } from '../../theme/iconSizes';

interface TeamSelectorProps {
  value: string | null;
  onChange: (teamId: string | null) => void;
  label?: string;
  optional?: boolean;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({
  value,
  onChange,
  label,
  optional = false,
}) => {
  const { t } = useTranslation();
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
      loadingText={t('teams.loading')}
      noOptionsText={t('teams.noOptions')}
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
                sx={{ width: iconSizes.sidebar, height: iconSizes.sidebar }}
                imgProps={{ style: { objectFit: 'contain' } }}
              />
            ) : (
              <Avatar sx={{ width: iconSizes.sidebar, height: iconSizes.sidebar, fontSize: 12, bgcolor: 'primary.light' }}>
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
          label={
            optional
              ? t('teams.optionalLabel', { label: label || t('teams.favorite') })
              : label || t('teams.favorite')
          }
          placeholder={t('placeholder.searchTeam')}
        />
      )}
      renderTags={() => null}
      fullWidth
      clearOnBlur
      handleHomeEndKeys
    />
  );
};
