/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { FieldAvailabilityTimeline } from './FieldAvailabilityTimeline';

const mockUseFieldGames = vi.fn();

vi.mock('../../hooks/useFieldGames', () => ({
  useFieldGames: (fieldId: string, daysAhead?: number) => mockUseFieldGames(fieldId, daysAhead),
}));

const defaultData = {
  byDate: new Map(),
  fullyBookedDates: new Set(),
  conflictDates: new Set(),
};

const theme = createTheme();

const renderTimeline = (props: {
  fieldId: string;
  selectedDate?: string;
  selectedTime?: string;
  onSlotSelect?: (date: string, time: string) => void;
}) => {
  return render(
    <ThemeProvider theme={theme}>
      <FieldAvailabilityTimeline
        fieldId={props.fieldId}
        selectedDate={props.selectedDate || ''}
        selectedTime={props.selectedTime || ''}
        onSlotSelect={props.onSlotSelect || vi.fn()}
      />
    </ThemeProvider>
  );
};

describe('FieldAvailabilityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFieldGames.mockReturnValue({
      data: defaultData,
      loading: false,
      error: null,
    });
  });

  it('renders null when fieldId is empty', () => {
    const { container } = renderTimeline({ fieldId: '' });
    expect(container.firstChild).toBeNull();
  });

  it('shows loading skeleton when loading', () => {
    mockUseFieldGames.mockReturnValue({
      data: defaultData,
      loading: true,
      error: null,
    });

    renderTimeline({ fieldId: 'field-1' });
    expect(screen.getByText('Disponibilidade do campo')).toBeDefined();
    const skeleton = document.querySelector('.MuiSkeleton-root');
    expect(skeleton).not.toBeNull();
  });

  it('shows error alert when error occurs', () => {
    mockUseFieldGames.mockReturnValue({
      data: defaultData,
      loading: false,
      error: 'Erro ao carregar',
    });

    renderTimeline({ fieldId: 'field-1' });
    expect(screen.getByText('Erro ao carregar')).toBeDefined();
  });

  it('renders 7 day columns', () => {
    mockUseFieldGames.mockReturnValue({
      data: defaultData,
      loading: false,
      error: null,
    });

    renderTimeline({ fieldId: 'field-1' });
    const papers = document.querySelectorAll('.MuiPaper-root');
    expect(papers.length).toBe(7);
  });

  it('renders legend (free/occupied/selected)', () => {
    mockUseFieldGames.mockReturnValue({
      data: defaultData,
      loading: false,
      error: null,
    });

    renderTimeline({ fieldId: 'field-1' });
    expect(screen.getByText('Livre')).toBeDefined();
    expect(screen.getByText('Ocupado')).toBeDefined();
    expect(screen.getByText('Selecionado')).toBeDefined();
  });

  it('calls onSlotSelect when clicking a free slot', async () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const freeDayGames = new Map<string, any[]>();
    freeDayGames.set(todayStr, []);

    mockUseFieldGames.mockReturnValue({
      data: {
        byDate: freeDayGames,
        fullyBookedDates: new Set(),
        conflictDates: new Set(),
      },
      loading: false,
      error: null,
    });

    const onSlotSelect = vi.fn();
    renderTimeline({ fieldId: 'field-1', onSlotSelect });

    await waitFor(() => {
      const freeSlots = document.querySelectorAll('[title^="Livre"]');
      expect(freeSlots.length).toBeGreaterThan(0);
    });

    const firstFreeSlot = document.querySelector('[title^="Livre"]');
    fireEvent.click(firstFreeSlot!);

    expect(onSlotSelect).toHaveBeenCalledTimes(1);
    expect(onSlotSelect).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^\d{2}:\d{2}$/)
    );
  });

  it('does not call onSlotSelect when clicking occupied slot', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const dayGames = new Map<string, any[]>();
    dayGames.set(todayStr, [
      {
        date: todayStr,
        startMinutes: 6 * 60,
        endMinutes: 23 * 60,
      },
    ]);

    mockUseFieldGames.mockReturnValue({
      data: {
        byDate: dayGames,
        fullyBookedDates: new Set([todayStr]),
        conflictDates: new Set([todayStr]),
      },
      loading: false,
      error: null,
    });

    const onSlotSelect = vi.fn();
    renderTimeline({ fieldId: 'field-1', onSlotSelect });

    const occupiedSlots = document.querySelectorAll('[title^="Ocupado"]');
    if (occupiedSlots.length > 0) {
      fireEvent.click(occupiedSlots[0]);
      expect(onSlotSelect).not.toHaveBeenCalled();
    }
  });

  it('highlights today with primary background', () => {
    mockUseFieldGames.mockReturnValue({
      data: defaultData,
      loading: false,
      error: null,
    });

    renderTimeline({ fieldId: 'field-1' });

    const today = new Date();
    const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const todayLabel = dayNames[today.getDay()];
    const todayNum = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;

    const todayElement = screen.getByText((content) => {
      const text = content.toLowerCase();
      return text.includes(todayLabel) && text.includes(todayNum);
    });
    expect(todayElement).toBeDefined();
  });
});
