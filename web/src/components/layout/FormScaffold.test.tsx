import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { FormScaffold } from './FormScaffold';

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('FormScaffold', () => {
  it('renderiza o título do formulário', () => {
    renderWithTheme(
      <FormScaffold title="Editar Perfil" closeDestination="/">
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
  });

  it('renderiza botão de fechar com ícone X', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/">
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.getByLabelText('Fechar')).toBeInTheDocument();
  });

  it('renderiza botão de voltar quando closeVariant=back', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/" closeVariant="back">
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });

  it('renderiza children', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/">
        <span>Campos do formulário</span>
      </FormScaffold>
    );
    expect(screen.getByText('Campos do formulário')).toBeInTheDocument();
  });

  it('renderiza footer quando fornecido', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/" footer={<button>Salvar</button>}>
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });

  it('não renderiza footer quando não fornecido', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/">
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.queryByRole('button')).not.toBeNull();
  });

  it('desabilita botão de fechar quando loading', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/" loading>
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.getByLabelText('Fechar')).toBeDisabled();
  });

  it('renderiza com aria attributes no header', () => {
    renderWithTheme(
      <FormScaffold title="Criar Jogo" closeDestination="/">
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.getByRole('heading', { name: 'Criar Jogo' })).toBeInTheDocument();
  });

  it('não mostra dialog dirty quando isDirty=false', () => {
    renderWithTheme(
      <FormScaffold title="Teste" closeDestination="/" isDirty={false}>
        <div>Conteúdo</div>
      </FormScaffold>
    );
    expect(screen.queryByText('Descartar mudanças?')).not.toBeInTheDocument();
  });
});
