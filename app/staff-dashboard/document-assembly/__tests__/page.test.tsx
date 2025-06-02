import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentAssemblyPage from '../page'; 
// Assuming types are now correctly imported by the component from @/types and @/types/document-assembly
// For mockCases, we might need to import the Case type if it's not inferred correctly.
import { Case } from '@/types';


// Mocking Supabase client for auth.getSession
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id' } } }, // Mock a session
      })),
    },
  })),
}));

// Mocking window.open for document view/download tests
global.open = jest.fn();

const mockCasesList: Case[] = [
  { id: 'case-1', case_number: 'C001', client_name: 'Client Alpha', status: 'Open', case_type: 'NDA' },
  { id: 'case-2', case_number: 'C002', client_name: 'Client Beta', status: 'Active', case_type: 'Consultation' },
];

const mockClientIntakeDataResponse = { // This structure should align with ClientIntakeData type
  form_type: 'nda_request', 
  data: { 
    disclosing_party_name: 'Alpha Disclosing Party', 
    receiving_party_name: 'Alpha Receiving Party',
    purpose_of_nda: 'Initial discussions for project Alpha.'
  },
  // other fields like id, case_id, created_at if the API returns the full record
  // Based on component's usage (JSON.stringify(clientIntakeData)), it expects the 'data' part or similar.
  // The component's ClientIntakeData type is ClientIntakeDataContent | null
  // ClientIntakeDataContent = NdaRequestFormValues | GeneralConsultationFormValues | { [key: string]: any };
  // So, the mock should be just the content of the 'data' field if API returns that directly.
  // If API returns the full record, then the mock should reflect that, and component would access `clientIntakeData.data`.
  // For now, let's assume API returns the content of the `data` field directly for `get-client-intake-data`
};


describe('DocumentAssemblyPage - Feature Enabled', () => {
  let originalBackendUrl: string | undefined;
  const user = userEvent.setup();

  beforeEach(() => {
    fetch.resetMocks();
    originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    process.env.NEXT_PUBLIC_BACKEND_API_URL = 'http://mock-backend.com/api';
    // FEATURE_AI_DOC_ASSEMBLY_ENABLED is true by default in the component for these tests
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_API_URL = originalBackendUrl;
    jest.clearAllMocks(); // Clear all mocks, including jest.fn()
  });

  test('renders the page with initial elements and generate button disabled', async () => {
    fetch.mockResponseOnce(JSON.stringify([])); // For /api/get-cases-for-staff
    render(<DocumentAssemblyPage />);

    expect(screen.getByRole('heading', { name: /document assembly/i })).toBeInTheDocument();
    // Using getByText for labels of custom select components if getByLabelText is tricky
    expect(screen.getByText('1. Select Case')).toBeInTheDocument();
    expect(screen.getByLabelText(/3. operator instructions/i)).toBeInTheDocument();
    expect(screen.getByText('4. Select Document Template')).toBeInTheDocument();
    
    const generateButton = screen.getByRole('button', { name: /generate document/i });
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
  });

  test('loads and displays cases, then loads and displays client intake data on case selection', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockCasesList)); // For /api/get-cases-for-staff
    // For /api/get-client-intake-data, mock the direct data content
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeDataResponse.data)); 

    render(<DocumentAssemblyPage />);

    expect(screen.getByText(/loading cases.../i)).toBeInTheDocument();
    
    // Wait for cases to load and select trigger to be enabled
    const caseSelectTrigger = screen.getByRole('combobox', { name: /1. select case/i });
    await waitFor(() => expect(caseSelectTrigger).toBeEnabled());
    
    // Select a case
    await user.click(caseSelectTrigger);
    const caseOption = await screen.findByText('C001 - Client Alpha (Status: Open, Type: NDA)');
    await user.click(caseOption);

    // Verify client intake data is loaded and displayed
    // This section assumes the API returns the 'data' part of the intake form directly
    await waitFor(() => {
      expect(fetch.mock.calls.length).toBe(2); // get-cases, get-intake-data
      expect(fetch.mock.calls[1][0]).toBe('/api/get-client-intake-data?case_id=case-1');
      // Check for a key part of the intake data displayed in the <pre> tag
      expect(screen.getByText(/Alpha Disclosing Party/i)).toBeInTheDocument(); 
    }, { timeout: 3000 });
  });

  test('should successfully initiate document generation', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockCasesList)); // For /api/get-cases-for-staff
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeDataResponse.data)); // For /api/get-client-intake-data for case-1
    fetch.mockResponseOnce(JSON.stringify({ task_id: 'test-task-123' }), { status: 202 }); // For /generate-document/

    render(<DocumentAssemblyPage />);

    // 1. Select Case
    const caseSelectTrigger = screen.getByRole('combobox', { name: /1. select case/i });
    await waitFor(() => expect(caseSelectTrigger).toBeEnabled());
    await user.click(caseSelectTrigger);
    await user.click(await screen.findByText('C001 - Client Alpha (Status: Open, Type: NDA)'));
    await waitFor(() => expect(screen.getByText(/Alpha Disclosing Party/i)).toBeInTheDocument());

    // 2. Enter Operator Instructions
    const instructionsTextarea = screen.getByLabelText(/3. operator instructions/i);
    await user.type(instructionsTextarea, 'Please emphasize confidentiality clauses.');

    // 3. Select Template
    const templateSelectTrigger = screen.getByRole('combobox', { name: /4. select document template/i });
    await user.click(templateSelectTrigger);
    // Assuming 'nda_template.jinja2' corresponds to 'Non-Disclosure Agreement (NDA)' in staticTemplates
    const templateOption = await screen.findByText('Non-Disclosure Agreement (NDA)'); 
    await user.click(templateOption);
    
    const generateButton = screen.getByRole('button', { name: /generate document/i });
    await waitFor(() => expect(generateButton).toBeEnabled());

    // 4. Click Generate Document
    await user.click(generateButton);

    // 5. Assertions for API call
    await waitFor(() => {
      expect(fetch.mock.calls.length).toBe(3); // cases, intake-data, generate-document
      const generateCall = fetch.mock.calls[2];
      expect(generateCall[0]).toBe('http://mock-backend.com/api/generate-document/');
      expect(generateCall[1]?.method).toBe('POST');
      const payload = JSON.parse(generateCall[1]?.body as string);
      expect(payload.case_id).toBe('case-1');
      expect(payload.operator_instructions).toBe('Please emphasize confidentiality clauses.');
      expect(payload.template_id).toBe('nda_template.jinja2'); 
      expect(payload.user_id).toBe('test-user-id'); // From Supabase mock
    });

    // Assert UI changes (status message, etc.)
    expect(screen.getByText(/document generation queued. task id: test-task-123/i)).toBeInTheDocument();
    // The component sets initial status to 'pending' after successful task submission
    expect(screen.getByText(/task status: PENDING/i, { exact: false })).toBeInTheDocument(); 
  });

  // Stubs for further tests
  // describe('Status Polling and Completion', () => { /* ... */ });
  // describe('Error Handling', () => { /* ... */ });
  // describe('Feature Flag Disabled', () => { /* ... */ });
});

describe('DocumentAssemblyPage - Status Polling and Completion', () => {
  let originalBackendUrl: string | undefined;
  const user = userEvent.setup();

  beforeEach(() => {
    fetch.resetMocks();
    originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    process.env.NEXT_PUBLIC_BACKEND_API_URL = 'http://mock-backend.com/api';
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_API_URL = originalBackendUrl;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('should poll for status and display completion with document actions', async () => {
    const taskId = 'poll-task-456';
    fetch.mockResponseOnce(JSON.stringify(mockCasesList)); // get-cases
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeDataResponse.data)); // get-intake-data
    fetch.mockResponseOnce(JSON.stringify({ task_id: taskId }), { status: 202 }); // generate-document -> task_id

    // Mock polling responses
    fetch.mockResponseOnce(JSON.stringify({ status: 'in_progress', task_id: taskId, message: 'Processing step 1...' })); // first poll
    fetch.mockResponseOnce(JSON.stringify({ status: 'completed', task_id: taskId, result: { file_name: 'CompletedDoc.pdf', storage_path: 'docs/CompletedDoc.pdf', bucket_name: 'final-docs' }, message: 'Document generation complete.' })); // second poll

    // Mock signed URL response
    fetch.mockResponseOnce(JSON.stringify({ signedUrl: 'http://mockstorage.com/signed/CompletedDoc.pdf' }));


    render(<DocumentAssemblyPage />);

    // --- Initiate generation (same as previous test) ---
    const caseSelectTrigger = screen.getByRole('combobox', { name: /1. select case/i });
    await waitFor(() => expect(caseSelectTrigger).toBeEnabled());
    await user.click(caseSelectTrigger);
    await user.click(await screen.findByText('C001 - Client Alpha (Status: Open, Type: NDA)'));
    await waitFor(() => expect(screen.getByText(/Alpha Disclosing Party/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/3. operator instructions/i), 'Polling test instructions.');
    const templateSelectTrigger = screen.getByRole('combobox', { name: /4. select document template/i });
    await user.click(templateSelectTrigger);
    await user.click(await screen.findByText('Non-Disclosure Agreement (NDA)'));
    const generateButton = screen.getByRole('button', { name: /generate document/i });
    await waitFor(() => expect(generateButton).toBeEnabled());
    await user.click(generateButton);
    // --- End initiation ---

    // Initial status after generation call
    await waitFor(() => expect(screen.getByText(`Document generation queued. Task ID: ${taskId}. Polling for status...`)).toBeInTheDocument());
    expect(screen.getByText(/task status: PENDING/i, { exact: false })).toBeInTheDocument();

    // Advance timer to trigger first poll
    await act(async () => {
      jest.advanceTimersByTime(3000); // Interval is 3000ms
    });
    
    await waitFor(() => expect(screen.getByText(/task status: IN_PROGRESS - Processing step 1.../i)).toBeInTheDocument(), {timeout: 4000});

    // Advance timer to trigger second poll
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => expect(screen.getByText(/task status: COMPLETED - Document generation complete./i)).toBeInTheDocument(), {timeout: 4000});
    expect(screen.getByText('Generated document: CompletedDoc.pdf')).toBeInTheDocument();
    
    const viewButton = screen.getByRole('button', { name: /view document/i });
    const downloadButton = screen.getByRole('button', { name: /download document/i });
    expect(viewButton).toBeEnabled();
    expect(downloadButton).toBeEnabled();

    // Test "View Document"
    await user.click(viewButton);
    await waitFor(() => expect(fetch.mock.calls[fetch.mock.calls.length -1][0]).toBe('/api/get-signed-document-url?storage_path=docs%2FCompletedDoc.pdf&bucket_name=final-docs'));
    expect(global.open).toHaveBeenCalledWith('http://mockstorage.com/signed/CompletedDoc.pdf', '_blank');
  });
});

describe('DocumentAssemblyPage - Error Handling', () => {
  let originalBackendUrl: string | undefined;
  const user = userEvent.setup();

  beforeEach(() => {
    fetch.resetMocks();
    originalBackendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    process.env.NEXT_PUBLIC_BACKEND_API_URL = 'http://mock-backend.com/api';
     // FEATURE_AI_DOC_ASSEMBLY_ENABLED is true by default
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_API_URL = originalBackendUrl;
    jest.clearAllMocks();
  });

  test('should display error if /generate-document/ call fails (e.g., 500)', async () => {
    fetch.mockResponseOnce(JSON.stringify(mockCasesList));
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeDataResponse.data));
    fetch.mockResponseOnce(JSON.stringify({ error: 'Backend exploded during generation' }), { status: 500 });

    render(<DocumentAssemblyPage />);
    // Fill form and submit (condensed setup)
    await user.click(screen.getByRole('combobox', { name: /1. select case/i }));
    await user.click(await screen.findByText('C001 - Client Alpha (Status: Open, Type: NDA)'));
    await waitFor(() => expect(screen.getByText(/Alpha Disclosing Party/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/3. operator instructions/i), 'Test error case');
    await user.click(screen.getByRole('combobox', { name: /4. select document template/i }));
    await user.click(await screen.findByText('Non-Disclosure Agreement (NDA)'));
    await user.click(screen.getByRole('button', { name: /generate document/i }));

    await waitFor(() => expect(screen.getByText(/Failed to start document generation: Backend exploded during generation/i)).toBeInTheDocument());
  });
  
  test('should display error if status polling returns task error', async () => {
    const taskId = 'error-task-789';
    fetch.mockResponseOnce(JSON.stringify(mockCasesList));
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeDataResponse.data));
    fetch.mockResponseOnce(JSON.stringify({ task_id: taskId }), { status: 202 }); // Successful initiation
    fetch.mockResponseOnce(JSON.stringify({ status: 'error', task_id: taskId, error_message: 'AI task failed processing.' })); // Polling returns error

    jest.useFakeTimers();
    render(<DocumentAssemblyPage />);
    // Fill form and submit
    await user.click(screen.getByRole('combobox', { name: /1. select case/i }));
    await user.click(await screen.findByText('C001 - Client Alpha (Status: Open, Type: NDA)'));
    await waitFor(() => expect(screen.getByText(/Alpha Disclosing Party/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/3. operator instructions/i), 'Test polling error');
    await user.click(screen.getByRole('combobox', { name: /4. select document template/i }));
    await user.click(await screen.findByText('Non-Disclosure Agreement (NDA)'));
    await user.click(screen.getByRole('button', { name: /generate document/i }));

    await waitFor(() => expect(screen.getByText(`Document generation queued. Task ID: ${taskId}. Polling for status...`)).toBeInTheDocument());
    
    await act(async () => {
      jest.advanceTimersByTime(3000); // Trigger polling
    });

    await waitFor(() => expect(screen.getByText(/Task failed: AI task failed processing./i)).toBeInTheDocument());
    jest.useRealTimers();
  });

  test('should display error if NEXT_PUBLIC_BACKEND_API_URL is not configured', async () => {
    process.env.NEXT_PUBLIC_BACKEND_API_URL = ''; // Unset or make undefined
    fetch.mockResponseOnce(JSON.stringify(mockCasesList));
    fetch.mockResponseOnce(JSON.stringify(mockClientIntakeDataResponse.data));
    
    render(<DocumentAssemblyPage />);
    // Fill form and attempt to submit
    await user.click(screen.getByRole('combobox', { name: /1. select case/i }));
    await user.click(await screen.findByText('C001 - Client Alpha (Status: Open, Type: NDA)'));
    await waitFor(() => expect(screen.getByText(/Alpha Disclosing Party/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/3. operator instructions/i), 'Test config error');
    await user.click(screen.getByRole('combobox', { name: /4. select document template/i }));
    await user.click(await screen.findByText('Non-Disclosure Agreement (NDA)'));
    await user.click(screen.getByRole('button', { name: /generate document/i }));

    await waitFor(() => expect(screen.getByText(/Configuration Error: Backend API URL is not configured. Please contact support./i)).toBeInTheDocument());
  });
});

// describe('DocumentAssemblyPage - Feature Flag Disabled', () => {
//   // Test for feature flag disabled state will be added if module mocking proves feasible for the const.
//   // For now, this is deferred.
// });
