import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentList from '../document-list'; // Assuming path is correct

// Mock next/navigation (if any Link components or router hooks are used internally, though not obvious from snippet)
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

// Mock Supabase client (for delete functionality, not directly for signed URLs)
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  delete: jest.fn().mockReturnThis(), // for .delete().eq()
  storage: {
    from: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  },
};
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => mockSupabase),
}));

// Mock global fetch for the /api/download-document endpoint
global.fetch = jest.fn();

const mockDocuments = [
  {
    id: 'doc1',
    filename: 'document1.pdf',
    file_type: 'application/pdf',
    upload_time: new Date().toISOString(),
    notes: 'Test notes 1',
    status: 'approved',
    storage_url: 'path/to/document1.pdf', // This is the file path
    uploaded_by: 'user1',
    bucket_name: 'documents', // Assuming bucket_name is passed or known
  },
  {
    id: 'doc2',
    filename: 'document2.docx',
    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upload_time: new Date().toISOString(),
    notes: 'Test notes 2',
    status: 'pending',
    storage_url: 'path/to/document2.docx',
    uploaded_by: 'user2',
    bucket_name: 'documents',
  },
];

const defaultProps = {
  documents: mockDocuments,
  caseId: 'case123',
  isStaff: false,
  onDocumentDeleted: jest.fn(),
};

describe('DocumentList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful fetch for signed URL
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ signedUrl: 'https://mocked.supabase.co/signed/url/for/test' }),
    });
    // Default successful delete
    mockSupabase.delete.mockResolvedValue({ error: null });
    mockSupabase.storage.remove.mockResolvedValue({ error: null });
    mockSupabase.single.mockResolvedValue({ data: { storage_path: 'path/to/doc' }, error: null }); // For fetching doc before delete
  });

  test('renders documents correctly', () => {
    render(<DocumentList {...defaultProps} />);
    expect(screen.getByText('document1.pdf')).toBeInTheDocument();
    expect(screen.getByText('document2.docx')).toBeInTheDocument();
  });

  test('handles "Open in new tab" action successfully', async () => {
    const mockWindowOpen = jest.spyOn(window, 'open').mockImplementation(jest.fn());
    render(<DocumentList {...defaultProps} />);

    const openButtons = screen.getAllByTitle('Open in new tab');
    fireEvent.click(openButtons[0]); // Click "Open" for the first document

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/download-document?documentId=${mockDocuments[0].id}`);
    });
    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledWith('https://mocked.supabase.co/signed/url/for/test', '_blank', 'noopener,noreferrer');
    });

    mockWindowOpen.mockRestore();
  });

  test('handles "Download file" action successfully', async () => {
    const mockWindowOpen = jest.spyOn(window, 'open').mockImplementation(jest.fn());
    // Mock document.createElement and related methods for direct download simulation if needed
    // For this test, window.open is sufficient as getFreshSignedUrl is used.

    render(<DocumentList {...defaultProps} />);

    const downloadButtons = screen.getAllByTitle('Download file');
    fireEvent.click(downloadButtons[0]); // Click "Download" for the first document

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/download-document?documentId=${mockDocuments[0].id}`);
    });

    // The current DocumentList handleDownload creates an <a> tag and clicks it.
    // Let's verify the URL it would have used for that <a> tag's href.
    // Since getFreshSignedUrl is called, we expect window.open to be called by it if download attribute is not used.
    // The component's handleDownload was refactored to call getFreshSignedUrl, which should then open the URL.
    // The refactored handleDownload in DocumentList directly calls getFreshSignedUrl, which then calls window.open
    // So, we just need to check if window.open was called with the signed URL.

    // Correcting the assertion based on `handleDownload` using `getFreshSignedUrl` which might call `window.open`
    // or create a link. The test for `handleOpen` already confirms `window.open`.
    // If `handleDownload` specifically creates an `<a>` element and clicks it:
    const link = { href: '', download: '', target: '', rel: '', click: jest.fn(), removeChild: jest.fn(), appendChild: jest.fn() };
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValueOnce(link as any);
    const bodySpy = jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());


    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/download-document?documentId=${mockDocuments[0].id}`);
    });

    await waitFor(() => {
         expect(link.href).toBe('https://mocked.supabase.co/signed/url/for/test');
         expect(link.download).toBe(mockDocuments[0].filename);
         expect(link.click).toHaveBeenCalledTimes(1);
    });

    createElementSpy.mockRestore();
    bodySpy.mockRestore();
    removeChildSpy.mockRestore();
    mockWindowOpen.mockRestore(); // if it was used
  });

  test('handles API call failure when trying to get signed URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to generate signed URL' }),
      status: 500,
    });

    render(<DocumentList {...defaultProps} />);
    const openButtons = screen.getAllByTitle('Open in new tab');
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/download-document?documentId=${mockDocuments[0].id}`);
    });
    await waitFor(() => {
      // Check for the error message set by getFreshSignedUrl
      expect(screen.getByText(/Failed to get link for document: Failed to get fresh URL/i)).toBeInTheDocument();
    });
  });

  // TODO: Add tests for delete functionality if time permits, focusing on confirming dialog and Supabase calls.
});
