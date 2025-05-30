import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentUpload from '../document-upload'; // Adjust path if component is in a subfolder of components

// Mock Supabase client
// We need to mock all specific functions used by DocumentUpload
const mockSupabaseClient = {
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    listBuckets: jest.fn(),
    remove: jest.fn(), // Added remove for potential cleanup paths
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn(),
  insert: jest.fn(),
  // Add any other specific Supabase functions if DocumentUpload uses them directly
  // e.g., .eq(), .order(), .single() if they are chained directly on the client instance
  // For now, assuming these are chained on the query builder returned by from()
  // and select() or insert() would handle the final part of the chain.
};

// Mock the module that provides the createClient function
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Mocking useRouter, as it's used indirectly by DocumentUpload via other components or hooks
// For DocumentUpload itself, it's not directly used, but good practice if children components might use it.
// If DocumentUpload specifically used router, we'd mock its return values.
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    // other router methods if needed
  })),
  usePathname: jest.fn(() => '/mock-path'), // if pathname is used
}));


describe('DocumentUpload Component', () => {
  // Define default props needed for the component
  const defaultProps = {
    userId: 'test-user-id',
    userRole: 'client' as 'client' | 'staff' | 'admin', // Ensure type correctness
    // caseId is optional, so not always needed
    // onUploadComplete is optional
  };

  // Reset mocks before each test to ensure test isolation
  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mock implementations
    // These can be overridden in specific tests for different scenarios (e.g., error cases)
    mockSupabaseClient.storage.listBuckets.mockResolvedValue({
      data: [{ name: 'documents-bucket', id: '1', public: false, created_at: '', updated_at: '' }],
      error: null,
    });

    // Mock for fetchCases - assuming it fetches a list of cases
    // The .select().order() chain
    mockSupabaseClient.from.mockImplementation(() => ({ // from('cases') or from('case_assignments')
        select: jest.fn().mockImplementation(() => ({ // select('id, case_number, ...') or select('case_id')
            eq: jest.fn().mockReturnThis(), // For .eq('client_id', userId) or .eq('user_id', userId)
            in: jest.fn().mockReturnThis(), // For .in('id', caseIds)
            order: jest.fn().mockResolvedValue({ // .order('created_at', ...)
                data: [{ id: 'case-1', case_number: 'CASE-001', client_name: 'Test Client', case_type: 'General' }],
                error: null,
            }),
            // If select is directly followed by .single() or .maybeSingle() for some reason
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
        // from('documents').insert().select().single()
        insert: jest.fn().mockImplementation(() => ({ // insert({...})
            select: jest.fn().mockImplementation(() => ({ // .select()
                single: jest.fn().mockResolvedValue({ // .single()
                    data: { id: 'doc-new-id', file_name: 'test.pdf', /* ... other fields ... */ },
                    error: null,
                }),
            })),
        })),
    }));


    // Mock for storage upload
    mockSupabaseClient.storage.from('documents-bucket').upload.mockResolvedValue({
      data: { path: 'test-user-id/test-file.pdf' },
      error: null,
    });
  });

  test('renders correctly with minimal props', () => {
    render(<DocumentUpload {...defaultProps} />);

    expect(screen.getByText('Upload Document')).toBeInTheDocument(); // CardTitle
    expect(screen.getByLabelText('Select Case')).toBeInTheDocument();
    expect(screen.getByLabelText('Select File')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Document' })).toBeInTheDocument();
  });

  test('handles valid file selection', async () => {
    render(<DocumentUpload {...defaultProps} />);
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    const testFile = new File(['hello'], 'hello.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Check if the file name is displayed (part of the success message or file info display)
    // The component currently shows a success message: `File "${selectedFile.name}" selected and valid.`
    await waitFor(() => {
      expect(screen.getByText(`File "hello.png" selected and valid.`)).toBeInTheDocument();
    });
    // Also check if the file details (name, size) are shown
    expect(screen.getByText(/hello.png \(\d+\.\d{2} MB\)/)).toBeInTheDocument();
  });

  test('handles invalid file type selection', async () => {
    render(<DocumentUpload {...defaultProps} />);
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    const invalidFile = new File(['dummy'], 'test.zip', { type: 'application/zip' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid file type: application\/zip. Allowed types: PDF, Word, Excel, JPG, PNG, TXT, CSV./i)
      ).toBeInTheDocument();
    });
    // Ensure the file input is cleared (value is empty)
    expect(fileInput.value).toBe('');
  });

  test('handles file too large selection', async () => {
    render(<DocumentUpload {...defaultProps} />);
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    // MAX_FILE_SIZE_MB is 10, so 11MB is too large. (10 * 1024 * 1024 for bytes)
    const oversizedFile = new File(['a'.repeat(11 * 1024 * 1024)], 'oversized.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByText(/File is too large \(11.00MB\). Maximum size: 10MB./i)).toBeInTheDocument();
    });
    expect(fileInput.value).toBe('');
  });

  test('handles successful document upload', async () => {
    const mockOnUploadComplete = jest.fn();
    render(<DocumentUpload {...defaultProps} onUploadComplete={mockOnUploadComplete} />);

    // 1. Select a file
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    const testFile = new File(['hello'], 'test-success.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await waitFor(() => {
      expect(screen.getByText(`File "test-success.pdf" selected and valid.`)).toBeInTheDocument();
    });

    // 2. Select a case (assuming cases are loaded via mocked fetchCases)
    // Wait for cases to be "loaded" (mocked response should be immediate but good practice)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    const caseSelectTrigger = screen.getByRole('combobox'); // Shadcn Select trigger role
    fireEvent.mouseDown(caseSelectTrigger); // Open the select dropdown

    // Find and click the case item. Case data from beforeEach mock.
    // This relies on the mocked case data being [{ id: 'case-1', case_number: 'CASE-001', ...}]
    const caseOption = await screen.findByText(/CASE-001/); // Use findByText for elements that appear
    fireEvent.click(caseOption);

    // Verify case selection (optional, depends on UI feedback for selection)
    // For example, if the trigger updates its text:
    // await waitFor(() => expect(screen.getByText(/CASE-001/)).toBeInTheDocument());


    // 3. Click upload button
    const uploadButton = screen.getByRole('button', { name: 'Upload Document' });
    fireEvent.click(uploadButton);

    // 4. Assert success
    await waitFor(() => {
      expect(screen.getByText('Document uploaded successfully!')).toBeInTheDocument();
    });
    expect(mockOnUploadComplete).toHaveBeenCalledTimes(1);
    // Check if it's called with the document data that insert().select().single() returns
    expect(mockOnUploadComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc-new-id', file_name: 'test-success.pdf' })
    );
    // Check if file input is cleared
    expect(fileInput.value).toBe('');
  });

  test('handles storage upload failure', async () => {
    // Override default mock for storage.upload to simulate failure
    mockSupabaseClient.storage.from('documents-bucket').upload.mockResolvedValueOnce({
      data: null,
      error: new Error('Simulated storage upload failure'),
    });

    render(<DocumentUpload {...defaultProps} />);
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    const testFile = new File(['hello'], 'test-storage-fail.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await screen.findByText(`File "test-storage-fail.pdf" selected and valid.`); // Wait for file to be processed

    const caseSelectTrigger = screen.getByRole('combobox');
    fireEvent.mouseDown(caseSelectTrigger);
    const caseOption = await screen.findByText(/CASE-001/);
    fireEvent.click(caseOption);

    const uploadButton = screen.getByRole('button', { name: 'Upload Document' });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed: Failed to upload to any available bucket. Last error: Simulated storage upload failure/i)).toBeInTheDocument();
    });
  });

  test('handles database insert failure and attempts cleanup', async () => {
    // Mock successful storage upload (default from beforeEach is fine)
    // Override default mock for database insert to simulate failure
     mockSupabaseClient.from.mockImplementationOnce(() => ({ // For from('documents')
        select: jest.fn().mockReturnThis(), // Not used directly by insert path
        insert: jest.fn().mockImplementationOnce(() => ({ // insert({...})
            select: jest.fn().mockImplementationOnce(() => ({ // .select()
                single: jest.fn().mockResolvedValueOnce({ // .single()
                    data: null,
                    error: new Error('Simulated database insert failure'),
                }),
            })),
        })),
    }));
    // Mock for storage remove (for cleanup attempt)
    mockSupabaseClient.storage.from('documents-bucket').remove.mockResolvedValueOnce({
        data: [{ path: 'test-user-id/test-db-fail.pdf' }], // Simulate successful removal
        error: null,
    });


    render(<DocumentUpload {...defaultProps} />);
    const fileInput = screen.getByLabelText('Select File') as HTMLInputElement;
    const testFile = new File(['hello'], 'test-db-fail.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });
    await screen.findByText(`File "test-db-fail.pdf" selected and valid.`);

    const caseSelectTrigger = screen.getByRole('combobox');
    fireEvent.mouseDown(caseSelectTrigger); // Using mouseDown as it's often used for select triggers
    const caseOption = await screen.findByText(/CASE-001/);
    fireEvent.click(caseOption);

    const uploadButton = screen.getByRole('button', { name: 'Upload Document' });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed: Failed to save document metadata: Simulated database insert failure/i)).toBeInTheDocument();
    });

    // Check if cleanup was attempted
    // The path used in remove would be dynamically generated, so checking for specific path is hard.
    // Instead, we check if the 'remove' function was called on the correct bucket.
    // Note: The actual path generated is like `${selectedCase.case_number}/${timestamp}-${randomId}.${fileExt}`
    // For this test, we just ensure remove was called.
    expect(mockSupabaseClient.storage.from('documents-bucket').remove).toHaveBeenCalled();
  });
});
