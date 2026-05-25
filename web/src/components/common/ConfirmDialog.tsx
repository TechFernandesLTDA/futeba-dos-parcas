import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  useTheme,
  useMediaQuery,
  type SxProps,
  type Theme,
} from '@mui/material';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  loadingLabel?: string;
  confirmColor?: 'error' | 'warning' | 'primary' | 'inherit' | 'success' | 'info' | 'secondary';
  confirmIcon?: ReactNode;
  confirmVariant?: 'contained' | 'outlined' | 'text';
  cancelDisabled?: boolean;
  fullScreen?: boolean;
  id?: string;
  sx?: SxProps<Theme>;
}

/**
 * Reusable confirmation dialog for destructive or irreversible actions.
 *
 * Replaces ~15 duplicated Dialog structures across screens that all follow
 * the same pattern: DialogTitle + message + Cancel/Confirm buttons with loading.
 */
export const ConfirmDialog = React.memo(function ConfirmDialog({
  open,
  title,
  children,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
  loadingLabel,
  confirmColor = 'error',
  confirmIcon,
  confirmVariant = 'contained',
  cancelDisabled = false,
  fullScreen: fullScreenProp,
  id,
  sx,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const fullScreen = fullScreenProp ?? isMobile;

  const titleId = id ? `${id}-title` : undefined;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
      sx={sx}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {children ?? (
          <DialogContentText>{message}</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading || cancelDisabled}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant={confirmVariant}
          disabled={loading}
          startIcon={
            loading
              ? <CircularProgress size={16} color="inherit" />
              : confirmIcon
          }
        >
          {loading ? (loadingLabel ?? `${confirmLabel}...`) : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export default ConfirmDialog;
