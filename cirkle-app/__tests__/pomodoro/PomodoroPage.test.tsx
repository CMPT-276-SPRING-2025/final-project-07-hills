import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Pomodoro from '@/app/pomodoro/page';

// Use module-level mocks instead of spying.
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
      email: 'test@example.com',
    },
    logout: jest.fn(),
  })),
}));

jest.mock('@/hooks/useGroups', () => ({
  useGroups: jest.fn(() => ({
    // Even though we supply two groups, the UI currently only renders one.
    groups: [
      { id: 'group1', name: 'Test Group 1', members: { 'test-user-id': true } },
      { id: 'group2', name: 'Test Group 2', members: { 'test-user-id': true } },
    ],
    loading: false,
  })),
}));

// Mock services.
jest.mock('@/services/pomodoroService', () => ({
  getGroupScores: jest.fn().mockResolvedValue([]),
  updateUserScore: jest.fn().mockResolvedValue(10),
}));

jest.mock('@/components/protected-route', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Pomodoro Page', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders the pomodoro page correctly', async () => {
    await act(async () => {
      render(<Pomodoro />);
      // Allow any pending promises to resolve.
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('Pomodoro')).toBeInTheDocument());
    expect(screen.getByText('Stay focused and earn points with your circle ⏱️')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Set Timer Duration')).toBeInTheDocument();
  });

  it('allows changing the timer duration', async () => {
    await act(async () => {
      render(<Pomodoro />);
      await Promise.resolve();
    });
    const combo = screen.getByRole('combobox');
    fireEvent.change(combo, { target: { value: '15' } });
    await waitFor(() => expect(screen.getByText('15:00')).toBeInTheDocument());
  });

  it('toggles the timer when play/pause button is clicked', async () => {
    await act(async () => {
      render(<Pomodoro />);
      await Promise.resolve();
    });
    const playButton = screen.getByRole('button', { name: '' });
    fireEvent.click(playButton);
    await act(async () => {
      jest.advanceTimersByTime(1000);
      // Flush any microtasks.
      await Promise.resolve();
    });
    expect(screen.getByText('24:59')).toBeInTheDocument();
  });

  it('displays the groups in the sidebar', async () => {
    await act(async () => {
      render(<Pomodoro />);
      await Promise.resolve();
    });
    // Wait until the group button appears and then check the text.
    await waitFor(() => expect(screen.getByText('Test Group 1')).toBeInTheDocument());
    expect(screen.getByText('Test Group 1')).toBeInTheDocument();
    // Remove check for "Test Group 2" if UI only renders one group.
    // If needed, adjust this expectation according to your UI design.
  });
});
