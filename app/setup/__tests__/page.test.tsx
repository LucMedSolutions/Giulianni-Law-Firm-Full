import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupPage from '../page'; // Assuming the test file is in app/setup/__tests__

// Mock next/navigation
// The useRouter hook is used for redirection after setup completion.
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(), // Mock the push function
    replace: jest.fn(), // Mock replace if used
    refresh: jest.fn(), // Mock refresh if used
  })),
}));

describe('SetupPage Functionality', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Store original fetch
    originalFetch = global.fetch;
    // Mock global.fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('renders loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Keep fetch pending
    render(<SetupPage />);
    expect(screen.getByText(/Checking setup status.../i)).toBeInTheDocument();
  });

  test('disables form and shows completion message if admin setup is complete', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isAdminSetupComplete: true }),
    });

    render(<SetupPage />);

    // Wait for the "Setup Complete" message
    await waitFor(() => {
      expect(screen.getByText(/Setup Complete/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Initial setup is complete. Admin user already exists. This page is no longer active./i)).toBeInTheDocument();

    // Check if form elements are disabled or not interactable
    // Full Name input
    const fullNameInput = screen.getByPlaceholderText('Admin User');
    expect(fullNameInput).toBeDisabled();

    // Email input
    const emailInput = screen.getByPlaceholderText('admin@example.com');
    expect(emailInput).toBeDisabled();

    // Password input
    const passwordInput = screen.getByPlaceholderText('********');
    expect(passwordInput).toBeDisabled();

    // Role select (might need a more specific selector if just "Role" label is ambiguous)
    // For simplicity, let's check the submit button which is more uniquely identifiable by its default role/name.
    const submitButton = screen.getByRole('button', { name: /Create Admin User/i });
    expect(submitButton).toBeDisabled();

    // Check if redirection is called (optional, depends on how critical it is to test the redirect itself)
    // This requires the mock for useRouter to be effective.
    const { useRouter } = require('next/navigation');
    const mockRouter = useRouter();
    await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/');
    }, { timeout: 6000 }); // Wait for the timeout in the component
  });

  test('enables form if admin setup is NOT complete', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isAdminSetupComplete: false }),
    });

    render(<SetupPage />);

    // Wait for the form to be potentially available (past the loading state)
    // Check for a form element, e.g., the "Full Name" input field's label or placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Admin User')).toBeInTheDocument();
    });

    // Check if form elements are enabled
    const fullNameInput = screen.getByPlaceholderText('Admin User');
    expect(fullNameInput).toBeEnabled();

    const emailInput = screen.getByPlaceholderText('admin@example.com');
    expect(emailInput).toBeEnabled();

    const passwordInput = screen.getByPlaceholderText('********');
    expect(passwordInput).toBeEnabled();

    const submitButton = screen.getByRole('button', { name: /Create Admin User/i });
    expect(submitButton).toBeEnabled();

    // Ensure no "setup complete" message is shown
    expect(screen.queryByText(/Initial setup is complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Setup Complete/i)).not.toBeInTheDocument();
  });

  test('shows an error message if API for setup check returns an error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error during setup check' }),
    });

    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Error checking setup status:/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Server error during setup check/i)).toBeInTheDocument();

    // Form should ideally not be submittable or inputs might be disabled/hidden
    const submitButton = screen.queryByRole('button', { name: /Create Admin User/i });
    // Depending on implementation, button might be absent or disabled.
    // If it's always rendered, check for disabled state.
    // For this test, let's assume if an error in check occurs, the form part is not rendered.
    expect(submitButton).not.toBeInTheDocument();
  });

  test('shows an error message if fetch throws a network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network failed'));

    render(<SetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/Error checking setup status:/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Network failed/i)).toBeInTheDocument();

    const submitButton = screen.queryByRole('button', { name: /Create Admin User/i });
    expect(submitButton).not.toBeInTheDocument();
  });

  // TODO: Add tests for form submission (success and failure) when setup is not complete.
  // This would involve mocking the '/api/create-user-direct' endpoint.
});
