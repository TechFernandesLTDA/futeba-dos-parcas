import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BackIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  CheckInIcon,
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  Grid,
  MessageIcon,
  MoreVertIcon,
  PlaceIcon,
  PlayIcon,
  QrCodeIcon,
  resolveReactComponent,
  ShareIcon,
  SoccerIcon,
  VoteIcon,
} from './gameDetailRuntimeComponents';

const runtimeComponents = {
  Grid,
  SoccerIcon,
  CheckIcon,
  PlayIcon,
  CheckInIcon,
  VoteIcon,
  ShareIcon,
  DeleteIcon,
  EditIcon,
  QrCodeIcon,
  BackIcon,
  DuplicateIcon,
  CalendarIcon,
  MoreVertIcon,
  MessageIcon,
  CheckCircleIcon,
  PlaceIcon,
};

describe('componentes de runtime do detalhe do jogo', () => {
  it('importa e renderiza Grid e todos os ícones como componentes React válidos', () => {
    render(
      <>
        {Object.entries(runtimeComponents).map(([name, Component]) =>
          createElement(Component, { key: name, 'data-testid': name }),
        )}
      </>,
    );

    Object.keys(runtimeComponents).forEach((name) => {
      expect(screen.getByTestId(name)).toBeInTheDocument();
    });
  });

  it('normaliza módulos com default aninhado sem entregar um objeto ao React', () => {
    const Example = () => <span>exemplo</span>;
    const Resolved = resolveReactComponent({ default: { default: Example } }, 'Example');

    render(<Resolved />);

    expect(screen.getByText('exemplo')).toBeInTheDocument();
  });

  it('falha cedo e identifica um módulo que não exporta componente', () => {
    expect(() => resolveReactComponent({ default: {} }, 'Broken')).toThrow(
      'Componente React inválido: Broken',
    );
  });
});
