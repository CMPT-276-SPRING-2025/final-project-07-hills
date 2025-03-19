import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Welcome from '@/app/welcome/page';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

// Mock the firebase/auth module
jest.mock('firebase/auth', () => ({
  signOut: jest.fn(),
}));

// Mock the firebase.ts module
jest.mock('@/lib/firebase', () => ({
  auth: {},
}));

// Mock the useRouter hook
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Welcome Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders the welcome page with correct elements', () => {
    render(<Welcome />);
    
    // Check for main elements
    expect(screen.getByText('Welcome, Yogya!')).toBeInTheDocument();
    expect(screen.getByText('Your Cirkles')).toBeInTheDocument();
    expect(screen.getByText('CMPT 276')).toBeInTheDocument();
    expect(screen.getByText('Add or Join')).toBeInTheDocument();
  });

  it('loads groups from localStorage', () => {
    // Setup mock localStorage data
    const mockGroups = [{ name: 'Test Group 1' }, { name: 'Test Group 2' }];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockGroups));
    
    render(<Welcome />);
    
    // Check that groups from localStorage are rendered
    expect(screen.getByText('Test Group 1')).toBeInTheDocument();
    expect(screen.getByText('Test Group 2')).toBeInTheDocument();
  });

  it('handles sign out correctly', async () => {
    // Mock signOut to resolve successfully
    (signOut as jest.Mock).mockResolvedValue(undefined);
    
    // Mock router
    const mockRouter = { push: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    render(<Welcome />);
    
    // Find and click the sign out button
    const signOutButton = screen.getByText('Sign Out');
    fireEvent.click(signOutButton);
    
    // Wait for the sign out process to complete
    await waitFor(() => {
      // Verify signOut was called with auth
      expect(signOut).toHaveBeenCalledWith(auth);
      
      // Verify router.push was called with the home route
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });

  it('opens the modal when clicking Add or Join button', () => {
    render(<Welcome />);
    
    // Find and click the Add or Join button
    const addButton = screen.getByText('Add or Join');
    fireEvent.click(addButton);
    
    // Check that the modal is displayed
    expect(screen.getByText('Create a Group')).toBeInTheDocument();
    expect(screen.getByText('Join an Existing Group')).toBeInTheDocument();
  });

  it('allows creating a new group', async () => {
    // Mock router
    const mockRouter = { push: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    render(<Welcome />);
    
    // Open the modal
    const addButton = screen.getByText('Add or Join');
    fireEvent.click(addButton);
    
    // Click "Create a Group"
    const createGroupButton = screen.getByText('Create a Group');
    fireEvent.click(createGroupButton);
    
    // Check that the group name input is displayed
    expect(screen.getByPlaceholderText('Group Name')).toBeInTheDocument();
    
    // Enter a group name
    const input = screen.getByPlaceholderText('Group Name');
    fireEvent.change(input, { target: { value: 'New Test Group' } });
    
    // Click the create button
    const submitButton = screen.getByText('Create Group');
    fireEvent.click(submitButton);
    
    // Verify localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalled();
    
    // Verify navigation to the new group page
    expect(mockRouter.push).toHaveBeenCalledWith('/group/New%20Test%20Group');
  });
});