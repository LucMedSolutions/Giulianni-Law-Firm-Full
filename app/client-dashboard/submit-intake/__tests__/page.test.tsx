import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event'; // For more complex interactions like Select
import SubmitIntakePage from '../page'; // Adjust path as needed
// import { Case } from '../page'; // Case type is defined locally in page.tsx

// Mocks are primarily handled by jest.setup.js
// We can override fetch mocks here per test if needed.

describe('SubmitIntakePage', () => {
  const mockClientCases = [
    { id: 'case-id-123', case_number: 'CS-001', client_name: 'Test Client One', status: 'Open', case_type: 'NDA' },
    { id: 'case-id-456', case_number: 'CS-002', client_name: 'Test Client Two', status: 'Open', case_type: 'Consultation' },
  ];

  beforeEach(() => {
    // fetch.resetMocks(); // Already in jest.setup.js
    // Mock the useSearchParams to return null for 'case_id' as this page no longer uses it directly
    // This is now handled by the global mock in jest.setup.js, but could be overridden here if needed.
  });

  test('renders the page and loads client cases into select dropdown', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockClientCases)); // For /api/get-client-cases

    render(<SubmitIntakePage />);

    expect(screen.getByRole('heading', { name: /client intake center/i })).toBeInTheDocument();
    expect(screen.getByText(/loading your cases.../i)).toBeInTheDocument();

    // Wait for cases to load
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /select your case/i })).toBeInTheDocument();
    });
    
    // Check if cases are populated (conceptual, actual interaction is more complex)
    // Click the trigger to open (if using userEvent)
    // For this test, just ensure the loading message disappears and select is present
    expect(screen.queryByText(/loading your cases.../i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /select your case/i })).toBeEnabled();
  });

  test('allows selection of a case and then NDA form, then successful NDA form submission', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockClientCases)); // Initial load for /api/get-client-cases
    fetch.mockResponseOnce(JSON.stringify({ message: 'NDA Request form submitted successfully!' }), { status: 201 }); // Mock for POST /api/submit-client-intake

    const user = userEvent.setup();
    render(<SubmitIntakePage />);

    // 1. Wait for cases to load and select a case
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select your case/i })).toBeEnabled());
    
    const caseSelectTrigger = screen.getByRole('combobox', { name: /select your case/i });
    await user.click(caseSelectTrigger);
    await screen.findByText(/CS-001 - Test Client One/i); // Wait for item to be available
    await user.click(screen.getByText(/CS-001 - Test Client One/i));
    
    await waitFor(() => {
      expect(screen.getByText(`Submitting for Case ID: ${mockClientCases[0].id}`)).toBeInTheDocument();
    });

    // 2. Select NDA Form type
    const ndaFormButton = screen.getByRole('button', { name: /nda request form/i });
    expect(ndaFormButton).toBeEnabled(); // Should be enabled after case selection
    await user.click(ndaFormButton);

    // 3. Wait for NDA form to render and fill it
    await screen.findByRole('heading', { name: /nda request details/i });

    await user.type(screen.getByLabelText(/disclosing party name/i), 'Discloser Inc.');
    await user.type(screen.getByLabelText(/disclosing party address/i), '123 Disclose St');
    await user.type(screen.getByLabelText(/receiving party name/i), 'Receiver Ltd.');
    await user.type(screen.getByLabelText(/receiving party address/i), '456 Receive Ave');
    // For date input, type might not work as expected across all browsers/setups in RTL if it's a native date picker.
    // fireEvent.change might be more reliable for native date pickers if userEvent.type has issues.
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: '2024-01-01' } });
    await user.type(screen.getByLabelText(/purpose of nda/i), 'To discuss a potential partnership.');
    await user.type(screen.getByLabelText(/definition of confidential information/i), 'All business plans and trade secrets.');

    // 4. Submit the form
    const submitNdaButton = screen.getByRole('button', { name: /submit nda request/i });
    expect(submitNdaButton).toBeEnabled();
    await user.click(submitNdaButton);

    // 5. Assertions
    await waitFor(() => {
      // Check for the success message on the main page
      expect(screen.getByText(/NDA Request submitted successfully!/i)).toBeInTheDocument();
    });

    // Check if the API call was made correctly
    expect(fetch.mock.calls.length).toBe(2); // 1 for cases, 1 for submit
    const submitCall = fetch.mock.calls[1];
    expect(submitCall[0]).toBe('/api/submit-client-intake');
    expect(submitCall[1]?.method).toBe('POST');
    const submittedPayload = JSON.parse(submitCall[1]?.body as string);
    expect(submittedPayload.case_id).toBe(mockClientCases[0].id);
    expect(submittedPayload.form_type).toBe('nda_request');
    expect(submittedPayload.formData.disclosing_party_name).toBe('Discloser Inc.');
  });
  
  // Test for General Consultation Form submission could be added similarly.
  // Test for error handling on form submission (e.g., backend validation error).
});
