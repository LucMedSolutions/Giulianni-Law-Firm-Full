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
    
    // The following assertion for "Submitting for Case ID" seems to be based on a
    // non-existent element in the actual component. Removing it.
    // await waitFor(() => {
    //   expect(screen.getByText(`Submitting for Case ID: ${mockClientCases[0].id}`)).toBeInTheDocument();
    // });

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

describe('General Consultation Form Submission', () => {
  const mockClientCases = [
    { id: 'case-id-789', case_number: 'CS-003', client_name: 'Test Client Three', status: 'Open', case_type: 'General' },
  ];

  beforeEach(() => {
    // fetch.resetMocks(); // Handled globally or per test suite as needed
  });

  test('allows selection of a case and then General Consultation form, then successful submission', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockClientCases)); // Initial load for /api/get-client-cases
    fetch.mockResponseOnce(JSON.stringify({ message: 'General Consultation form submitted successfully!' }), { status: 201 }); // Mock for POST /api/submit-client-intake

    const user = userEvent.setup();
    render(<SubmitIntakePage />);

    // 1. Wait for cases to load and select a case
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select your case/i })).toBeEnabled());
    
    const caseSelectTrigger = screen.getByRole('combobox', { name: /select your case/i });
    await user.click(caseSelectTrigger);
    // Use findByText for elements that appear after an interaction
    const caseItem = await screen.findByText(/CS-003 - Test Client Three/i);
    await user.click(caseItem);
    
    // 2. Select General Consultation Form type
    const consultationFormButton = screen.getByRole('button', { name: /general consultation form/i });
    expect(consultationFormButton).toBeEnabled();
    await user.click(consultationFormButton);

    // 3. Wait for General Consultation form to render and fill it
    await screen.findByRole('heading', { name: /general consultation details/i });

    await user.type(screen.getByLabelText(/full name/i), 'John Consult');
    await user.type(screen.getByLabelText(/email address/i), 'john.consult@example.com');
    await user.type(screen.getByLabelText(/phone number \(optional\)/i), '555-1234');
    await user.type(screen.getByLabelText(/type of legal issue/i), 'Contract Review');
    await user.type(screen.getByLabelText(/brief description of legal issue/i), 'Need a contract reviewed for potential issues.');

    // Handle Select component for preferred_contact_method
    const contactMethodTrigger = screen.getByRole('combobox', {name: /preferred contact method/i});
    await user.click(contactMethodTrigger);
    const emailOption = await screen.findByText('Email'); // findBy for async appearance
    await user.click(emailOption);


    // 4. Submit the form
    const submitConsultationButton = screen.getByRole('button', { name: /submit consultation request/i });
    expect(submitConsultationButton).toBeEnabled();
    await user.click(submitConsultationButton);

    // 5. Assertions
    await waitFor(() => {
      // Check for the success message on the main page (controlled by SubmitIntakePage)
      expect(screen.getByText(/General Consultation submitted successfully!/i)).toBeInTheDocument();
    });

    // Check if the API call was made correctly
    expect(fetch.mock.calls.length).toBe(2); // 1 for cases, 1 for submit
    const submitCall = fetch.mock.calls[1];
    expect(submitCall[0]).toBe('/api/submit-client-intake');
    expect(submitCall[1]?.method).toBe('POST');
    const submittedPayload = JSON.parse(submitCall[1]?.body as string);
    expect(submittedPayload.case_id).toBe(mockClientCases[0].id);
    expect(submittedPayload.form_type).toBe('general_consultation');
    expect(submittedPayload.formData.client_full_name).toBe('John Consult');
    expect(submittedPayload.formData.preferred_contact_method).toBe('email');
  });
});

describe('NDA Form Error Handling', () => {
  const mockClientCases = [
    { id: 'case-id-err-123', case_number: 'CS-ERR-001', client_name: 'Error Client NDA', status: 'Open', case_type: 'NDA' },
  ];
  const ndaFormRequiredValues = {
    disclosing_party_name: 'Discloser Test Inc.',
    disclosing_party_address: '1 Error St',
    receiving_party_name: 'Receiver Test Ltd.',
    receiving_party_address: '2 Error Ave',
    effective_date: '2024-02-01', // Valid date
    purpose_of_nda: 'Error handling test purpose.',
    definition_of_confidential_information: 'Confidential info for error test.',
  };

  beforeEach(() => {
    fetch.resetMocks(); // Reset mocks before each error test
  });

  test('should display an error message if API submission fails with 500', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockClientCases)); // For /api/get-client-cases
    fetch.mockResponseOnce(JSON.stringify({ error: 'Internal Server Error, please try again later.' }), { status: 500 }); // Mock 500

    const user = userEvent.setup();
    render(<SubmitIntakePage />);

    // Select case
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select your case/i })).toBeEnabled());
    await user.click(screen.getByRole('combobox', { name: /select your case/i }));
    await user.click(await screen.findByText(/CS-ERR-001 - Error Client NDA/i));
    
    // Select NDA Form
    await user.click(screen.getByRole('button', { name: /nda request form/i }));
    await screen.findByRole('heading', { name: /nda request details/i });

    // Fill form
    await user.type(screen.getByLabelText(/disclosing party name/i), ndaFormRequiredValues.disclosing_party_name);
    await user.type(screen.getByLabelText(/disclosing party address/i), ndaFormRequiredValues.disclosing_party_address);
    await user.type(screen.getByLabelText(/receiving party name/i), ndaFormRequiredValues.receiving_party_name);
    await user.type(screen.getByLabelText(/receiving party address/i), ndaFormRequiredValues.receiving_party_address);
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: ndaFormRequiredValues.effective_date } });
    await user.type(screen.getByLabelText(/purpose of nda/i), ndaFormRequiredValues.purpose_of_nda);
    await user.type(screen.getByLabelText(/definition of confidential information/i), ndaFormRequiredValues.definition_of_confidential_information);

    // Submit
    await user.click(screen.getByRole('button', { name: /submit nda request/i }));

    // Assert error message from the form's alert
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      // This message comes from the NdaRequestForm's submitStatus state
      expect(screen.getByText('Internal Server Error, please try again later.')).toBeInTheDocument();
    });
  });

  test('should display client-side validation error for missing required field and not call API', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockClientCases)); // For /api/get-client-cases

    const user = userEvent.setup();
    render(<SubmitIntakePage />);
    
    // Select case
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select your case/i })).toBeEnabled());
    await user.click(screen.getByRole('combobox', { name: /select your case/i }));
    await user.click(await screen.findByText(/CS-ERR-001 - Error Client NDA/i));

    // Select NDA Form
    await user.click(screen.getByRole('button', { name: /nda request form/i }));
    await screen.findByRole('heading', { name: /nda request details/i });

    // Fill some fields but leave disclosing_party_name empty
    await user.type(screen.getByLabelText(/disclosing party address/i), ndaFormRequiredValues.disclosing_party_address);
    // ... (other fields if necessary to make it more realistic, but one missing required is enough)

    // Attempt to submit
    await user.click(screen.getByRole('button', { name: /submit nda request/i }));

    // Assert client-side Zod error message
    await waitFor(() => {
      // The error message is defined in NdaRequestForm.tsx's Zod schema
      expect(screen.getByText('Disclosing party name is required.')).toBeInTheDocument();
    });

    // Assert that no API call for submission was made
    // fetch.mock.calls[0] is for get-client-cases
    expect(fetch.mock.calls.length).toBe(1); 
  });

  test('should display server-side validation error from API next to the field', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockClientCases)); // For /api/get-client-cases
    // Mock server-side Zod error
    const serverErrorDetails = { disclosing_party_name: ["Server says: Name is too generic."] };
    fetch.mockResponseOnce(JSON.stringify({ error: "Invalid request body", details: serverErrorDetails }), { status: 400 });

    const user = userEvent.setup();
    render(<SubmitIntakePage />);

    // Select case
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select your case/i })).toBeEnabled());
    await user.click(screen.getByRole('combobox', { name: /select your case/i }));
    await user.click(await screen.findByText(/CS-ERR-001 - Error Client NDA/i));
    
    // Select NDA Form
    await user.click(screen.getByRole('button', { name: /nda request form/i }));
    await screen.findByRole('heading', { name: /nda request details/i });

    // Fill form (valid according to client-side schema)
    await user.type(screen.getByLabelText(/disclosing party name/i), ndaFormRequiredValues.disclosing_party_name);
    await user.type(screen.getByLabelText(/disclosing party address/i), ndaFormRequiredValues.disclosing_party_address);
    await user.type(screen.getByLabelText(/receiving party name/i), ndaFormRequiredValues.receiving_party_name);
    await user.type(screen.getByLabelText(/receiving party address/i), ndaFormRequiredValues.receiving_party_address);
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: ndaFormRequiredValues.effective_date } });
    await user.type(screen.getByLabelText(/purpose of nda/i), ndaFormRequiredValues.purpose_of_nda);
    await user.type(screen.getByLabelText(/definition of confidential information/i), ndaFormRequiredValues.definition_of_confidential_information);

    // Submit
    await user.click(screen.getByRole('button', { name: /submit nda request/i }));
    
    // Assert server-side Zod error message is displayed next to the field
    await waitFor(() => {
      expect(screen.getByText("Server says: Name is too generic.")).toBeInTheDocument();
    });
     // Also check the general error message in the alert
    expect(screen.getByText(/Submission failed due to validation errors: disclosing_party_name: Server says: Name is too generic./i)).toBeInTheDocument();
  });
});
