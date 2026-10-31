import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  List,
  ListItem,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OwnedGroupRef } from '../../utils/deleteAccountErrors';

interface DeleteAccountBlockedGroupsDialogProps {
  open: boolean;
  groups: OwnedGroupRef[];
  onClose: () => void;
}

/**
 * Lista os grupos que impedem a exclusão (dono com outros membros ativos).
 * Não desloga: o usuário precisa transferir a posse antes (#4391).
 */
export const DeleteAccountBlockedGroupsDialog: React.FC<DeleteAccountBlockedGroupsDialogProps> = ({
  open,
  groups,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      role="alertdialog"
      aria-labelledby="delete-blocked-title"
      aria-describedby="delete-blocked-desc"
    >
      <DialogTitle id="delete-blocked-title">
        {t('settings.deleteBlockedTitle', { count: groups.length })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-blocked-desc">
          {t('settings.deleteBlockedDesc', { count: groups.length })}
        </DialogContentText>
        <List dense aria-label={t('settings.deleteBlockedListAria')}>
          {groups.map((group) => (
            <ListItem key={group.id} disableGutters>
              <Link
                component={RouterLink}
                to={`/group/${group.id}`}
                onClick={onClose}
                underline="hover"
                aria-label={t('settings.deleteBlockedGroupAria', { name: group.name })}
              >
                {group.name}
              </Link>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
