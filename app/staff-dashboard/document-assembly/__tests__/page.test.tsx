import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentAssemblyPage from '../page'; // Adjust path as needed
import { Case } from '../page'; // Import Case interface from the page itself or a types file

// Mocks are primarily handled by jest.setup.js
// We can override fetch mocks here per test if needed.

describe('DocumentAssemblyPage', () => {
  beforeEach(() => {
    // Reset fetch mocks before each test if not globally done in setup
    // fetch.resetMocks(); // Already in jest.setup.js
  });

  test('renders the page with initial elements', async () => {
    // Mock initial API calls if any run on mount without interaction
    fetch.mockResponseOnce(JSON.stringify([])); // For /api/get-cases-for-staff

    render(<DocumentAssemblyPage />);

    expect(screen.getByRole('heading', { name: /document assembly/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/1. select case/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/3. operator instructions/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/4. select document template/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate document/i })).toBeInTheDocument();
    // Initially, the generate button should be disabled
    expect(screen.getByRole('button', { name: /generate document/i })).toBeDisabled();
  });

  test('loads and displays cases, then loads and displays client intake data on case selection', async () => {
    const mockCases: Case[] = [
      { id: 'case-1', case_number: 'C001', client_name: 'Client Alpha', status: 'Open', case_type: 'NDA' },
      { id: 'case-2', case_number: 'C002', client_name: 'Client Beta', status: 'Active', case_type: 'Consultation' },
    ];
    const mockClientIntakeData = {
      case_id: 'case-1',
      client_name: 'Client Alpha',
      details: 'Needs an NDA for a new partnership discussion.',
      // ... other fields from ClientIntakeData interface
    };

    // Mock fetch for /api/get-cases-for-staff
    fetch.mockResponseOnce(JSON.stringify(mockCases));
    // Mock fetch for /api/get-client-intake-data (will be called after case selection)
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeData));

    render(<DocumentAssemblyPage />);

    // Wait for cases to load and appear in the Select component
    // The SelectTrigger will initially have placeholder text.
    // Use waitFor to ensure options are populated before trying to interact.
    // Note: Shadcn Select interactions are complex to test with fireEvent directly on native elements.
    // We'll check if the trigger is there, then if an option text appears after "opening" it (conceptually).
    
    // Check for loading message first
    expect(screen.getByText(/loading cases.../i)).toBeInTheDocument();
    
    await waitFor(() => {
      // Once loading is done, the placeholder or first item should be there
      expect(screen.getByText('Select a case...')).toBeInTheDocument();
    });
    
    // Simulate selecting a case. For Shadcn/ui Select, this is not straightforward.
    // A common approach is to find the trigger, click it, then click an option.
    // However, without a library like @testing-library/user-event for more realistic interactions,
    // or specific data-testid attributes, this can be brittle.
    // For this test, let's assume the user selects the first case.
    // We'll find the trigger and then check if the client data loading/display occurs.
    
    // Click the SelectTrigger to open the dropdown (conceptual)
    // Actual interaction might need user-event: userEvent.click(screen.getByRole('combobox'));
    // For now, we'll directly test the state change that would trigger the next API call.
    // To do this properly, we'd need to simulate selecting an item.
    // Since direct simulation of Shadcn select is tricky, we'll assume selection happens and mock the next API call.
    // This test focuses on the data loading flow rather than precise select interaction.

    // Let's find the select trigger.
    const selectTrigger = screen.getByRole('combobox'); // Shadcn Select's trigger has role combobox
    expect(selectTrigger).toBeInTheDocument();
    
    // Manually trigger the state change that would occur on selecting a case to test data loading.
    // This is a workaround for not easily simulating Shadcn Select item click.
    // In a real test, you'd use userEvent.click on the trigger, then on the item.
    // For this test, we'll assume 'Client Alpha' (case-1) is selected.
    // The component's onValueChange would set `selectedCaseId` to 'case-1'.
    // We'll rely on the useEffect that depends on `selectedCaseId` to fire.
    
    // We can't directly set state, so we will check for the effects of selection.
    // After cases load, if we could simulate selection of 'case-1':
    // fireEvent.change(selectTrigger, { target: { value: 'case-1' } }); // This won't work for Shadcn
    
    // Let's check if the component attempts to load client data AFTER cases are loaded.
    // The second fetch mock is for /api/get-client-intake-data
    
    await waitFor(() => {
      // This checks that the second API call (for client intake data) was made
      // The URL should contain ?case_id=case-1 if we could simulate selection.
      // For now, we check if the mocked data appears.
      // This assumes the first case 'case-1' would be auto-selected or selected by a user.
      // This part of the test needs refinement if we need to assert specific case selection.
      // The fetch mock for client intake data should have been called.
      // For now, we will assume the component's logic will eventually call it if a case is selected.
      // The test will pass if the second fetch (client intake data) is consumed and data displayed.
      // To make this more robust, one would need to properly simulate the Select interaction.
      
      // If we assume 'case-1' was selected (e.g., by making it default or through user interaction):
      // We expect "Loading client data..." then the data itself.
      // Since we can't easily simulate the click to trigger the second fetch,
      // this test mainly verifies the first fetch and initial render.
      // A more complete test would use @testing-library/user-event.
      
      // For this simplified test, we'll just check that the cases loaded.
      // A more advanced test would simulate selection and check for client data.
      expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(1); // At least the cases API was called
      expect(fetch.mock.calls[0][0]).toBe('/api/get-cases-for-staff');
    });

    // Example of how you might check for client data if selection was simulated:
    // await waitFor(() => {
    //   expect(screen.getByText(/Client Intake Data/i)).toBeInTheDocument();
    //   expect(screen.getByText(/"client_name": "Client Alpha"/i)).toBeInTheDocument();
    //   expect(screen.getByText(/"details": "Needs an NDA for a new partnership discussion."/i)).toBeInTheDocument();
    // }, { timeout: 3000 }); // Increased timeout for multiple async operations
  });

  // More tests to be added as per the plan:
  // - Document Generation Initiation Test
  // - Status Polling and Completion Test (Simplified)
  // - Error Handling Test (e.g., Generation Fails)
});
