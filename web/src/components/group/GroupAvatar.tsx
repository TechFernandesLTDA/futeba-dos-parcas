import React from 'react';
import { Avatar, type AvatarProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getGroupLogoPreset, isGroupLogoColor } from '../../constants/groupLogos';

interface GroupAvatarProps extends Omit<AvatarProps, 'children' | 'src'> {
  name?: string | null;
  photoUrl?: string | null;
  logoPreset?: string | null;
  logoEmoji?: string | null;
  logoColor?: string | null;
  size?: number;
}

function initialsFor(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'G';
}

export const GroupAvatar: React.FC<GroupAvatarProps> = React.memo(({
  name,
  photoUrl,
  logoPreset,
  logoEmoji,
  logoColor,
  size = 56,
  sx,
  alt,
  ...avatarProps
}) => {
  const hasLogo = !!logoEmoji || !!logoPreset;
  const preset = hasLogo ? getGroupLogoPreset(logoPreset) : null;
  const emoji = logoEmoji || preset?.emoji;
  const color = isGroupLogoColor(logoColor) ? logoColor : preset?.color || 'primary.main';
  const avatarSx = [
    {
      width: size,
      height: size,
      bgcolor: color,
      fontSize: emoji ? size * 0.42 : size * 0.36,
      lineHeight: 1,
      boxSizing: 'border-box',
    },
    ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
  ] as SxProps<Theme>;

  return (
    <Avatar
      src={photoUrl || undefined}
      alt={alt || name || 'Grupo'}
      sx={avatarSx}
      {...avatarProps}
    >
      {emoji || initialsFor(name)}
    </Avatar>
  );
});

GroupAvatar.displayName = 'GroupAvatar';
