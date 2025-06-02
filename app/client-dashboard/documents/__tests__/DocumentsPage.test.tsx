import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientDocumentsPage from '../page'; // Adjust path as necessary
import { useToast } from '@/components/ui/use-toast'; // Ensure this path is correct

// Mock DocumentUpload component
jest.mock('@/components/document-upload', () => {
  // Mocking a functional component that accepts props and calls onUploadComplete
  return jest.fn(({ onUploadComplete, userId, userRole }) => (
    <div data-testid="document-upload-mock">
      <p>Mocked Document Upload</p>
      <p>UserID: {userId}</p>
      <p>UserRole: {userRole}</p>
      {/* Simulate calling onUploadComplete for testing */}
      <button
        onClick={() =>
          onUploadComplete?.({
            dbDocument: { id: 'doc1', file_name: 'test_file.pdf' },
            aiTaskId: 'aiTask123',
            aiError: null
          })
        }
      >
        Simulate Full Success
      </button>
      <button
        onClick={() =>
          onUploadComplete?.({
            dbDocument: { id: 'doc2', file_name: 'another_file.docx' },
            aiTaskId: null,
            aiError: 'AI processing failed badly.'
          })
        }
      >
        Simulate AI Error
      </button>
    </div>
  ));
});

// Mock useToast hook
const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock Supabase client for this page (mainly for session and document list)
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    // ... other auth methods if page uses them
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn(),
  // ... other Supabase methods if page uses them
};
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => mockSupabase),
}));


// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    // other router methods
  }),
  usePathname: () => '/client-dashboard/documents', // Mock current pathname
}));


describe('ClientDocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getSession (valid session)
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'client-user-id', role: 'client' } } },
      error: null,
    });

    // Default mock for fetching user profile linked to session
    // Default mock for fetching cases for the client
    // Default mock for fetching documents for those cases
    const mockUserSelect = jest.fn().mockResolvedValue({ data: { role: 'client', full_name: 'Test Client' }, error: null });
    const mockCasesSelect = jest.fn().mockResolvedValue({ data: [{ id: 'case-id-1', case_number: 'CASE001' }], error: null });
    const mockDocumentsSelect = jest.fn().mockResolvedValue({
        data: [{ id: 'doc-id-1', filename: 'existing_doc.pdf', file_type: 'application/pdf', upload_time: new Date().toISOString(), storage_url: 'path/to/doc1.pdf', bucket_name: 'docs', status: 'approved', cases: {id: 'case-id-1', case_number: 'CASE001'} }],
        error: null
    });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: mockUserSelect };
      }
      if (tableName === 'cases') {
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnValue({ data: [{ id: 'case-id-1', case_number: 'CASE001' }], error: null }) }; // Simplified for now
      }
      if (tableName === 'documents') {
        return { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: mockDocumentsSelect };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn(), in: jest.fn().mockReturnThis(), order: jest.fn() }; // Default fallback
    });
  });

  test('renders the documents page and opens upload modal', async () => {
    render(<ClientDocumentsPage />);

    // Check for page title or key elements
    expect(screen.getByRole('heading', { name: /Your Documents/i })).toBeInTheDocument();

    // Check for existing document (from mock)
    await waitFor(() => {
        expect(screen.getByText('existing_doc.pdf')).toBeInTheDocument();
    });

    // Find and click the "Upload Document" button
    const uploadButton = screen.getByRole('button', { name: /Upload Document/i });
    fireEvent.click(uploadButton);

    // Check if the mocked DocumentUpload component is rendered
    await waitFor(() => {
      expect(screen.getByTestId('document-upload-mock')).toBeInTheDocument();
      expect(screen.getByText('Mocked Document Upload')).toBeInTheDocument();
      // Check if props are passed to the mock
      expect(screen.getByText('UserID: client-user-id')).toBeInTheDocument();
      expect(screen.getByText('UserRole: client')).toBeInTheDocument();
    });
  });

  test('handles onUploadComplete with full success (AI task ID)', async () => {
    render(<ClientDocumentsPage />);

    // Open the modal
    const uploadButton = screen.getByRole('button', { name: /Upload Document/i });
    fireEvent.click(uploadButton);
    await screen.findByTestId('document-upload-mock'); // Wait for modal to open

    // Simulate onUploadComplete from the mock
    const simulateSuccessButton = screen.getByRole('button', { name: 'Simulate Full Success' });
    fireEvent.click(simulateSuccessButton);

    // Check for toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Upload Successful",
        description: `Document "test_file.pdf" uploaded. AI processing started (Task ID: aiTask123).`,
        variant: "success",
      });
    });
    // Check if document list refresh was attempted (fetchDocuments calls supabase.from('documents').select)
    // The mock for from('documents') is mockDocumentsSelect.
    // We expect it to be called once on page load, then again after upload.
    expect(mockDocumentsSelect).toHaveBeenCalledTimes(2);
  });

  test('handles onUploadComplete with AI error', async () => {
    render(<ClientDocumentsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Upload Document/i }));
    await screen.findByTestId('document-upload-mock');

    const simulateAiErrorButton = screen.getByRole('button', { name: 'Simulate AI Error' });
    fireEvent.click(simulateAiErrorButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Upload Complete, AI Issue",
        description: `Document "another_file.docx" uploaded, but AI processing call failed: AI processing failed badly.. You may be able to retry from the upload modal if it was left open or if you reopen it for that file.`,
        variant: "warning",
        duration: 10000,
      });
    });
    expect(mockDocumentsSelect).toHaveBeenCalledTimes(2);
  });
});
