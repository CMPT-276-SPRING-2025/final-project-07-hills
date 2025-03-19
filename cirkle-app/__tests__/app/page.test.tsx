import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '@/app/page';
import { signInWithGoogle } from '@/lib/auth';
import { useRouter } from 'next/navigation';

// Mock the auth module
jest.mock('@/lib/auth', () => ({
  signInWithGoogle: jest.fn(),
}));

// Mock the useRouter hook
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

describe('Home Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the welcome message', () => {
    render(<Home />);
    
    // Check for main content
    expect(screen.getByText('Welcome To')).toBeInTheDocument();
    expect(screen.getByText('Cirkle!')).toBeInTheDocument();
    expect(screen.getByText('COLLABORATIVE STUDY FOR')).toBeInTheDocument();
    expect(screen.getByText("'BETTER RESULTS'")).toBeInTheDocument();
    
    // Check for login button
    expect(screen.getByText('Login with Google')).toBeInTheDocument();
  });

  it('handles login button click correctly', async () => {
    // Mock the signInWithGoogle function to resolve successfully
    (signInWithGoogle as jest.Mock).mockResolvedValue({});
    
    // Mock router
    const mockRouter = { push: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    render(<Home />);
    
    // Find and click the login button
    const loginButton = screen.getByText('Login with Google');
    fireEvent.click(loginButton);
    
    // Check that the button shows loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    
    // Wait for the login process to complete
    await waitFor(() => {
      // Verify signInWithGoogle was called
      expect(signInWithGoogle).toHaveBeenCalled();
      
      // Verify router.push was called with the correct route
      expect(mockRouter.push).toHaveBeenCalledWith('/welcome');
    });
  });

  it('handles login error correctly', async () => {
    // Mock signInWithGoogle to reject with an error
    (signInWithGoogle as jest.Mock).mockRejectedValue(new Error('Authentication failed'));
    
    render(<Home />);
    
    // Find and click the login button
    const loginButton = screen.getByText('Login with Google');
    fireEvent.click(loginButton);
    
    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to sign in with Google. Please try again.')).toBeInTheDocument();
    });
  });
});