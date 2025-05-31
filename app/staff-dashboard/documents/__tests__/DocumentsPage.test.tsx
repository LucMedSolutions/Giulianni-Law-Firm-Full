import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StaffDocumentsPage from '../page'; // Adjust path as necessary
import { useToast } from '@/components/ui/use-toast';

// Mock DocumentUpload component
jest.mock('@/components/document-upload', () => {
  return jest.fn(({ onUploadComplete, userId, userRole }) => (
    <div data-testid="document-upload-mock">
      <p>Mocked Staff Document Upload</p>
      <p>UserID: {userId}</p>
      <p>UserRole: {userRole}</p>
      <button
        onClick={() =>
          onUploadComplete?.({
            dbDocument: { id: 'doc1-staff', file_name: 'staff_test_file.pdf' },
            aiTaskId: 'aiTask-staff-123',
            aiError: null
          })
        }
      >
        Simulate Staff Full Success
      </button>
      <button
        onClick={() =>
          onUploadComplete?.({
            dbDocument: { id: 'doc2-staff', file_name: 'staff_another_file.docx' },
            aiTaskId: null,
            aiError: 'Staff AI processing failed badly.'
          })
        }
      >
        Simulate Staff AI Error
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

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn(),
};
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => mockSupabase),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/staff-dashboard/documents', // Mock current pathname
}));


describe('StaffDocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for getSession (valid staff session)
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'staff-user-id' } } }, // Role is fetched from 'users' table
      error: null,
    });

    // Mock for fetching user profile (staff role)
    const mockUserSelectStaff = jest.fn().mockResolvedValue({ data: { role: 'staff', full_name: 'Test Staff' }, error: null });
    // Mock for fetching all documents (staff/admin view)
    const mockDocumentsSelectStaff = jest.fn().mockResolvedValue({
        data: [{ id: 'doc-id-staff-1', filename: 'staff_existing_doc.pdf', file_type: 'application/pdf', upload_time: new Date().toISOString(), storage_url: 'path/to/staff_doc1.pdf', bucket_name: 'docs', status: 'approved', cases: {id: 'case-s-1', case_number: 'S_CASE001'}, users: {full_name: 'Test Uploader'} }],
        error: null
    });

    mockSupabase.from.mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: mockUserSelectStaff };
      }
      if (tableName === 'documents') {
        // Staff page fetches all documents, not filtered by case_id client-side initially
        return { select: jest.fn().mockReturnThis(), order: mockDocumentsSelectStaff };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn(), in: jest.fn().mockReturnThis(), order: jest.fn() };
    });
  });

  test('renders the staff documents page and opens upload modal', async () => {
    render(<StaffDocumentsPage />);

    expect(screen.getByRole('heading', { name: /Documents/i })).toBeInTheDocument(); // Page title

    await waitFor(() => {
        expect(screen.getByText('staff_existing_doc.pdf')).toBeInTheDocument();
    });

    const uploadButton = screen.getByRole('button', { name: /Upload Document/i });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByTestId('document-upload-mock')).toBeInTheDocument();
      expect(screen.getByText('Mocked Staff Document Upload')).toBeInTheDocument();
      expect(screen.getByText('UserID: staff-user-id')).toBeInTheDocument();
      expect(screen.getByText('UserRole: staff')).toBeInTheDocument(); // Assuming default role from mock is 'staff'
    });
  });

  test('handles onUploadComplete with full success (AI task ID) for staff', async () => {
    render(<StaffDocumentsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Upload Document/i }));
    await screen.findByTestId('document-upload-mock');

    const simulateSuccessButton = screen.getByRole('button', { name: 'Simulate Staff Full Success' });
    fireEvent.click(simulateSuccessButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Upload Successful",
        description: `Document "staff_test_file.pdf" uploaded. AI processing started (Task ID: aiTask-staff-123).`,
        variant: "success",
      });
    });
    // Check if document list refresh was attempted
    const mockDocumentsSelectStaff = mockSupabase.from('documents').select().order; // Get the mock correctly
    expect(mockDocumentsSelectStaff).toHaveBeenCalledTimes(2); // Once on load, once on refresh
  });

  test('handles onUploadComplete with AI error for staff', async () => {
    render(<StaffDocumentsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Upload Document/i }));
    await screen.findByTestId('document-upload-mock');

    const simulateAiErrorButton = screen.getByRole('button', { name: 'Simulate Staff AI Error' });
    fireEvent.click(simulateAiErrorButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Upload Complete, AI Issue",
        description: `Document "staff_another_file.docx" uploaded, but AI processing call failed: Staff AI processing failed badly.. You may be able to retry from the upload modal.`,
        variant: "warning",
        duration: 10000,
      });
    });
    const mockDocumentsSelectStaff = mockSupabase.from('documents').select().order;
    expect(mockDocumentsSelectStaff).toHaveBeenCalledTimes(2);
  });
});
