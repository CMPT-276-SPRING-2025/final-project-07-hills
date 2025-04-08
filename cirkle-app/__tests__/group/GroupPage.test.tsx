import React from 'react';
import { render, screen } from '@testing-library/react';
import GroupPage from '@/app/group/[groupName]/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  useParams: () => ({
    groupName: 'test-group',
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
      email: 'test@example.com',
    },
  })),
}));

// Minimal mocks for group service so that no group is found.
jest.mock('@/services/groupService', () => ({
  getGroupById: jest.fn().mockRejectedValue(new Error("Group not found")),
  getGroupInviteCode: jest.fn().mockReturnValue('ABC123'),
  getUserGroups: jest.fn().mockResolvedValue([]),
}));

describe('Group Page', () => {
  it('renders the fallback/loading state when no group data is available', async () => {
    render(<GroupPage />);
    // Since your component currently displays "Loading..." before group data loads,
    // we assert that this text is present.
    const loadingText = await screen.findByText(/Loading.../i);
    expect(loadingText).toBeInTheDocument();
  });
});
