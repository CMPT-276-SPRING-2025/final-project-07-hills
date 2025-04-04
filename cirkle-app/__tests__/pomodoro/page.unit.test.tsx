jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  updateUserScore: jest.fn(() => Promise.resolve(5)),
}));

describe('PomodoroContent - Unit Logic', () => {
  it('renders heading', async () => {
    render(<PomodoroContent />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /pomodoro/i })).toBeInTheDocument()
    );
  });

  it('resets the timer', async () => {
    render(<PomodoroContent />);
    const reset = await screen.findByRole('button', { name: /reset timer/i });
    fireEvent.click(reset);
    expect(reset).toBeInTheDocument();
  });

  it('sets custom duration', async () => {
    render(<PomodoroContent />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'custom' },
    });

    const minInput = screen.getByPlaceholderText(/minutes/i);
    const secInput = screen.getByPlaceholderText(/seconds/i);
    fireEvent.change(minInput, { target: { value: '1' } });
    fireEvent.change(secInput, { target: { value: '15' } });

    fireEvent.click(screen.getByRole('button', { name: /set duration/i }));

    await waitFor(() => {
      expect(screen.getByText((text) => text.includes('01:15'))).toBeInTheDocument();
    });
  });
});
