/** @jest-environment node */

import { middleware } from '../middleware'; // Adjust path if your middleware.ts is not in the root
import { NextResponse, NextRequest } from 'next/server';

// --- Mocks ---
const mockGetSession = jest.fn();
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();

// Mock @supabase/auth-helpers-nextjs
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createMiddlewareClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
    from: mockSupabaseFrom,
  })),
}));

// Spy on NextResponse methods to check calls
// Note: It's often better to check the actual Response object returned by middleware
// but for simplicity in this setup, spying can indicate intent.
const mockRedirect = jest.fn();
const mockNext = jest.fn();

jest.spyOn(NextResponse, 'redirect').mockImplementation(mockRedirect);
jest.spyOn(NextResponse, 'next').mockImplementation(mockNext);


// --- Test Suite ---
describe('Middleware Authorization Logic', () => {
  beforeEach(() => {
    // Clear all mock implementations and call history before each test
    jest.clearAllMocks();

    // Setup default chaining for Supabase client mocks
    // supabase.from('users').select('role').eq('id', session.user.id).single()
    mockSupabaseFrom.mockImplementation(() => ({
      select: mockSupabaseSelect.mockImplementation(() => ({
        eq: mockSupabaseEq.mockImplementation(() => ({
          single: mockSupabaseSingle,
        })),
      })),
    }));
  });

  // Helper to create NextRequest objects
  const createRequest = (pathname: string, base: string = 'http://localhost:3000') => {
    return new NextRequest(new URL(pathname, base));
  };

  // --- Test Scenarios ---

  // Scenario 1: Unauthenticated Access
  describe('Unauthenticated Access', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    });

    it('should redirect from /admin-dashboard to /', async () => {
      const req = createRequest('/admin-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });

    it('should redirect from /staff-dashboard to /', async () => {
      const req = createRequest('/staff-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });

    it('should redirect from /client-dashboard to /', async () => {
      const req = createRequest('/client-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });

    it('should redirect from a protected API route (/api/create-user-direct) to /', async () => {
      const req = createRequest('/api/create-user-direct'); // Example admin API
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });

    it('should allow access to /setup', async () => {
      const req = createRequest('/setup');
      await middleware(req);
      // NextResponse.next() should be called by the middleware if no redirect happens
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow access to / (root)', async () => {
      const req = createRequest('/');
      // For root, if no session, it should just pass through (or be handled by page itself)
      // The middleware's job is to protect non-public routes.
      // The current middleware logic: if !session and pathname !== '/', redirect to '/'.
      // So, if !session and pathname IS '/', it should call res (NextResponse.next()).
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow access to /api/login (public API)', async () => {
      const req = createRequest('/api/login');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // Scenario 2: Authenticated Admin User
  describe('Authenticated Admin User', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'admin-user-id' } } }, error: null });
      mockSupabaseSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });
    });

    it('should allow access to /admin-dashboard', async () => {
      const req = createRequest('/admin-dashboard');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow access to /staff-dashboard', async () => {
      const req = createRequest('/staff-dashboard');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow access to /client-dashboard', async () => {
      const req = createRequest('/client-dashboard');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow access to critical admin API route (/api/admin-confirm-email/)', async () => {
      const req = createRequest('/api/admin-confirm-email/');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // Scenario 3: Authenticated Staff User
  describe('Authenticated Staff User', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'staff-user-id' } } }, error: null });
      mockSupabaseSingle.mockResolvedValue({ data: { role: 'staff' }, error: null });
    });

    it('should redirect from /admin-dashboard to /staff-dashboard', async () => {
      const req = createRequest('/admin-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/staff-dashboard', req.url));
    });

    it('should redirect from critical admin API route (/api/admin-confirm-email/) to /staff-dashboard', async () => {
      const req = createRequest('/api/admin-confirm-email/');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/staff-dashboard', req.url));
    });

    it('should allow access to /staff-dashboard', async () => {
      const req = createRequest('/staff-dashboard');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should redirect from /client-dashboard to /staff-dashboard', async () => {
      // A staff member trying to access client dashboard should be redirected to their own.
      // Current middleware logic: if userRole !== 'client' && userRole !== 'admin', then redirect for /client-dashboard
      const req = createRequest('/client-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/staff-dashboard', req.url));
    });
  });

  // Scenario 4: Authenticated Client User
  describe('Authenticated Client User', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'client-user-id' } } }, error: null });
      mockSupabaseSingle.mockResolvedValue({ data: { role: 'client' }, error: null });
    });

    it('should redirect from /admin-dashboard to /client-dashboard', async () => {
      const req = createRequest('/admin-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/client-dashboard', req.url));
    });

    it('should redirect from /staff-dashboard to /client-dashboard', async () => {
      const req = createRequest('/staff-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/client-dashboard', req.url));
    });

    it('should redirect from critical admin API route (/api/admin-confirm-email/) to /client-dashboard', async () => {
      const req = createRequest('/api/admin-confirm-email/');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/client-dashboard', req.url));
    });

    it('should allow access to /client-dashboard', async () => {
      const req = createRequest('/client-dashboard');
      await middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // Scenario 5: Error Fetching User Role
  describe('Error Fetching User Role', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'any-user-id' } } }, error: null });
      mockSupabaseSingle.mockRejectedValue(new Error('Database connection error'));
    });

    it('should redirect from /admin-dashboard to / due to role fetch error', async () => {
      const req = createRequest('/admin-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });

    it('should redirect from protected API route (/api/admin-confirm-email/) to / due to role fetch error', async () => {
      const req = createRequest('/api/admin-confirm-email/');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });
  });

  // Scenario 6: User with no specific role in DB (role is null or undefined)
  describe('Authenticated User with No Specific Role', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'no-role-user-id' } } }, error: null });
      // Simulate userData being { role: null } or just {}
      mockSupabaseSingle.mockResolvedValue({ data: null, error: null }); // or { data: { role: null }, error: null }
    });

    it('should redirect from /admin-dashboard to /', async () => {
      const req = createRequest('/admin-dashboard');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });

    it('should redirect from critical admin API route (/api/admin-confirm-email/) to /', async () => {
      const req = createRequest('/api/admin-confirm-email/');
      await middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalledWith(new URL('/', req.url));
    });
  });

});
