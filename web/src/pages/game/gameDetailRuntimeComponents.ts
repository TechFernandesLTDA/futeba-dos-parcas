import type { ElementType } from 'react';
import * as GridModule from '@mui/material/Unstable_Grid2';
import * as SoccerIconModule from '@mui/icons-material/SportsSoccer';
import * as CheckIconModule from '@mui/icons-material/Check';
import * as PlayIconModule from '@mui/icons-material/PlayArrow';
import * as CheckInIconModule from '@mui/icons-material/HowToReg';
import * as VoteIconModule from '@mui/icons-material/HowToVote';
import * as ShareIconModule from '@mui/icons-material/Share';
import * as DeleteIconModule from '@mui/icons-material/Delete';
import * as EditIconModule from '@mui/icons-material/Edit';
import * as QrCodeIconModule from '@mui/icons-material/QrCode2';
import * as BackIconModule from '@mui/icons-material/ArrowBack';
import * as DuplicateIconModule from '@mui/icons-material/ContentCopy';
import * as CalendarIconModule from '@mui/icons-material/CalendarMonth';
import * as MoreVertIconModule from '@mui/icons-material/MoreVert';
import * as MessageIconModule from '@mui/icons-material/ChatBubbleOutline';
import * as CheckCircleIconModule from '@mui/icons-material/CheckCircle';
import * as PlaceIconModule from '@mui/icons-material/Place';

const REACT_ELEMENT_TYPE_SYMBOLS = new Set([
  Symbol.for('react.forward_ref'),
  Symbol.for('react.lazy'),
  Symbol.for('react.memo'),
]);

const isReactElementType = (candidate: unknown): candidate is ElementType => {
  if (typeof candidate === 'function' || typeof candidate === 'string') {
    return true;
  }

  if (!candidate || typeof candidate !== 'object' || !('$$typeof' in candidate)) {
    return false;
  }

  return REACT_ELEMENT_TYPE_SYMBOLS.has(
    (candidate as { $$typeof?: symbol }).$$typeof as symbol,
  );
};

export const resolveReactComponent = (componentModule: unknown, name: string): ElementType => {
  let candidate = componentModule;

  for (let depth = 0; depth < 5; depth += 1) {
    if (isReactElementType(candidate)) {
      return candidate;
    }

    if (!candidate || typeof candidate !== 'object' || !('default' in candidate)) {
      break;
    }

    candidate = (candidate as { default?: unknown }).default;
  }

  throw new TypeError(`Componente React inválido: ${name}`);
};

export const Grid = resolveReactComponent(GridModule, 'Unstable_Grid2');
export const SoccerIcon = resolveReactComponent(SoccerIconModule, 'SportsSoccer');
export const CheckIcon = resolveReactComponent(CheckIconModule, 'Check');
export const PlayIcon = resolveReactComponent(PlayIconModule, 'PlayArrow');
export const CheckInIcon = resolveReactComponent(CheckInIconModule, 'HowToReg');
export const VoteIcon = resolveReactComponent(VoteIconModule, 'HowToVote');
export const ShareIcon = resolveReactComponent(ShareIconModule, 'Share');
export const DeleteIcon = resolveReactComponent(DeleteIconModule, 'Delete');
export const EditIcon = resolveReactComponent(EditIconModule, 'Edit');
export const QrCodeIcon = resolveReactComponent(QrCodeIconModule, 'QrCode2');
export const BackIcon = resolveReactComponent(BackIconModule, 'ArrowBack');
export const DuplicateIcon = resolveReactComponent(DuplicateIconModule, 'ContentCopy');
export const CalendarIcon = resolveReactComponent(CalendarIconModule, 'CalendarMonth');
export const MoreVertIcon = resolveReactComponent(MoreVertIconModule, 'MoreVert');
export const MessageIcon = resolveReactComponent(MessageIconModule, 'ChatBubbleOutline');
export const CheckCircleIcon = resolveReactComponent(CheckCircleIconModule, 'CheckCircle');
export const PlaceIcon = resolveReactComponent(PlaceIconModule, 'Place');
