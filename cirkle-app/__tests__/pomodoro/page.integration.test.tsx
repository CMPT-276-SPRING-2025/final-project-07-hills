jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn(() => null) }),
}));

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PomodoroContent } from '@/app/pomodoro/page';
import '@testing-library/jest-dom';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: '1', displayName: 'Test', email: 'test@test.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/hooks/useGroups', () => ({
  useGroups: () => ({
    groups: [{ id: 'g1', name: 'Test Group' }],
    loading: false,
  }),
}));

jest.mock('@/services/pomodoroService', () => ({
  getGroupScores: jest.fn(() =>
    Promise.resolve([{ userId: '1', userName: 'Test', userEmail: 'test@test.com', score: 3 }])
  ),
  updateUserScore: jest.fn(() => Promise.resolve(6)),
}));

describe('PomodoroContent - Integration Test', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders UI with group and leaderboard', async () => {
    await act(async () => {
      render(<PomodoroContent />);
    });

    expect(await screen.findByText(/test group/i)).toBeInTheDocument();
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pts/i)).toBeInTheDocument();
  });

  it('starts timer and completes without errors', async () => {
    await act(async () => {
      render(<PomodoroContent />);
    });

    const playBtn = screen.getAllByRole('button').find((btn) =>
      btn.querySelector('svg')
    );
    fireEvent.click(playBtn!);

    act(() => {
      jest.advanceTimersByTime(25 * 60 * 1000); // fast-forward 25 mins
    });

  });
});
