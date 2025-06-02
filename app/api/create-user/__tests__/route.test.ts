import { POST } from '../route'; // Adjust the import path as necessary
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

// Mock @supabase/auth-helpers-nextjs
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: jest.fn(),
}));

// Mock @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock the withTimeout utility if it's used in the route, otherwise this can be removed.
// Assuming it's a utility that might be imported, e.g., from '@/utils/timeout'
jest.mock('../../../../utils/timeout', () => ({ // Adjust path if necessary
  withTimeout: jest.fn((promise, timeout) => promise), // Simple pass-through mock
}));


describe('POST /api/create-user', () => {
  let mockRequest: NextRequest;
  let mockCookiesGet;
  let mockGetSession: jest.Mock;
  let mockCreateUser: jest.Mock;
  let mockInsert: jest.Mock;
  let mockDeleteUser: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for cookies().get
    mockCookiesGet = jest.fn().mockReturnValue({ value: 'test-cookie' });
    (cookies as jest.Mock).mockReturnValue({ get: mockCookiesGet });
    
    // Default mock for createRouteHandlerClient
    mockGetSession = jest.fn();
    (createRouteHandlerClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    });

    // Default mock for createClient (Supabase admin client)
    mockCreateUser = jest.fn();
    mockInsert = jest.fn();
    mockDeleteUser = jest.fn();
    (createClient as jest.Mock).mockReturnValue({
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: mockDeleteUser,
        },
      },
      from: jest.fn().mockReturnValue({
        insert: mockInsert,
      }),
    });

    // Mock request object
    mockRequest = {
      json: jest.fn(),
    } as unknown as NextRequest;

    // Set necessary environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  // Test Case 1: Successful User Creation
  it('should create a user successfully and return 200', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test User',
      role: 'client', // or 'staff' with staffRole
      // staffRole: 'lawyer', // if role is 'staff'
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin-user-id' } } } });
    const createdAuthUser = { data: { user: { id: 'new-user-id', email: userData.email } }, error: null };
    mockCreateUser.mockResolvedValueOnce(createdAuthUser);
    mockInsert.mockResolvedValueOnce({ error: null }); // For 'users' table
    mockInsert.mockResolvedValueOnce({ error: null }); // For 'audit_logs' table

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ message: 'User created successfully', userId: 'new-user-id' });
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Or false, depending on your route's logic
      user_metadata: {
        full_name: userData.full_name,
        role: userData.role,
        staff_role: userData.staffRole, 
      },
    });
    expect(createClient().from).toHaveBeenCalledWith('users');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'new-user-id',
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      staff_role: userData.staffRole,
    }));
    expect(createClient().from).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        action: 'create_user',
        user_id: 'new-user-id',
        details: expect.stringContaining('User test@example.com created by admin-user-id'),
    }));
  });

  // Test Case 2: Missing Required Fields (e.g., email)
  it('should return 400 if required fields are missing', async () => {
    const userData = {
      // email: 'test@example.com', // Missing email
      password: 'password123',
      full_name: 'Test User',
      role: 'client',
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'Missing required fields: email' });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // Test Case 3: Staff Role Missing for Staff User
  it('should return 400 if role is staff but staffRole is missing', async () => {
    const userData = {
      email: 'staff@example.com',
      password: 'password123',
      full_name: 'Staff User',
      role: 'staff',
      // staffRole: 'paralegal', // Missing staffRole
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'staffRole is required if role is staff' });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
  
  // Test Case 4: Supabase Auth User Creation Failure (e.g., user already exists)
  it('should return 400 if Supabase auth user creation fails (user already exists)', async () => {
    const userData = {
      email: 'exists@example.com',
      password: 'password123',
      full_name: 'Existing User',
      role: 'client',
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin-user-id' } } } });
    mockCreateUser.mockResolvedValueOnce({ 
      data: { user: null }, 
      error: { message: 'User already registered', status: 400 } // Simulate Supabase error for existing user
    });

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400); // As per Supabase error status for user exists
    expect(responseBody).toEqual({ error: 'Error creating user in Supabase Auth: User already registered' });
    expect(mockCreateUser).toHaveBeenCalled();
    expect(createClient().from).not.toHaveBeenCalledWith('users'); // users table insert should not be called
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should return 500 if Supabase auth user creation fails (other auth error)', async () => {
    const userData = {
      email: 'authfail@example.com',
      password: 'password123',
      full_name: 'Auth Fail User',
      role: 'client',
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin-user-id' } } } });
    mockCreateUser.mockResolvedValueOnce({ 
      data: { user: null }, 
      error: { message: 'Some other auth error', status: 500 } 
    });

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Error creating user in Supabase Auth: Some other auth error' });
    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // Test Case 5: Supabase 'users' Table Insert Failure
  it('should return 500 and attempt to delete auth user if users table insert fails', async () => {
    const userData = {
      email: 'dbfail@example.com',
      password: 'password123',
      full_name: 'DB Fail User',
      role: 'client',
    };
    const newUserId = 'new-user-dbfail-id';
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin-user-id' } } } });
    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: newUserId, email: userData.email } }, error: null });
    mockInsert.mockResolvedValueOnce({ error: { message: 'Database insert error' } }); // users table insert fails
    mockDeleteUser.mockResolvedValueOnce({ error: null }); // Auth user cleanup succeeds
    // Mock audit log insert to succeed
    (createClient().from as jest.Mock).mockImplementation((tableName) => {
        if (tableName === 'users') {
            return { insert: mockInsert }; // Fails
        }
        if (tableName === 'audit_logs') {
            return { insert: jest.fn().mockResolvedValueOnce({ error: null }) }; // Succeeds
        }
        return { insert: jest.fn() };
    });


    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Error inserting user data into database: Database insert error' });
    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1); // Only the users table insert should have been attempted and failed
    expect(mockDeleteUser).toHaveBeenCalledWith(newUserId);
  });

  // Test Case 6: Supabase 'users' Table Insert Failure and Auth User Cleanup Failure
  it('should return 500 and log cleanup error if users table insert and auth user cleanup fail', async () => {
    const userData = {
      email: 'fullfail@example.com',
      password: 'password123',
      full_name: 'Full Fail User',
      role: 'client',
    };
    const newUserId = 'new-user-fullfail-id';
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin-user-id' } } } });
    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: newUserId, email: userData.email } }, error: null });
    
    const usersTableInsertMock = jest.fn().mockResolvedValueOnce({ error: { message: 'DB insert error' } });
    const auditLogsInsertMock = jest.fn().mockResolvedValueOnce({ error: null });

    (createClient().from as jest.Mock).mockImplementation((tableName) => {
        if (tableName === 'users') {
            return { insert: usersTableInsertMock };
        }
        if (tableName === 'audit_logs') {
            return { insert: auditLogsInsertMock };
        }
        return { insert: jest.fn() };
    });

    mockDeleteUser.mockResolvedValueOnce({ error: { message: 'Auth cleanup error' } });
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Error inserting user data into database: DB insert error' });
    expect(mockCreateUser).toHaveBeenCalled();
    expect(usersTableInsertMock).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(newUserId);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `CRITICAL: Failed to delete Supabase Auth user ${newUserId} after database insert failure:`, 
      expect.objectContaining({ message: 'Auth cleanup error' })
    );
    
    consoleErrorSpy.mockRestore();
  });

  // Test Case 7: Timeout during auth.getSession (Simplified: assume it returns null session)
  // The withTimeout logic in the actual route determines how this is handled.
  // If withTimeout throws a specific error, mock that. If it proceeds with a warning, test that.
  // For this example, we'll assume the route is robust and proceeds, logging a warning.
  it('should proceed with user creation if getSession times out (logs warning)', async () => {
    const userData = {
      email: 'timeout@example.com',
      password: 'password123',
      full_name: 'Timeout User',
      role: 'client',
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    
    // Simulate getSession returning no session (e.g., due to timeout or other issue)
    // The route's withTimeout should handle the actual timeout behavior.
    // Here, we mock the outcome of a timeout as perceived by the main logic.
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: {name: 'TimeoutError', message: 'Session fetch timed out'} }); 
    // Or, if withTimeout makes it return, e.g. { data: { session: null }, error: new Error("Timeout") }
    // Or, if withTimeout is mocked to return a specific error that the route then catches.
    
    const createdAuthUser = { data: { user: { id: 'new-user-timeout-id', email: userData.email } }, error: null };
    mockCreateUser.mockResolvedValueOnce(createdAuthUser);

    const usersTableInsertMock = jest.fn().mockResolvedValueOnce({ error: null });
    const auditLogsInsertMock = jest.fn().mockResolvedValueOnce({ error: null });

    (createClient().from as jest.Mock).mockImplementation((tableName) => {
        if (tableName === 'users') {
            return { insert: usersTableInsertMock };
        }
        if (tableName === 'audit_logs') {
            return { insert: auditLogsInsertMock };
        }
        return { insert: jest.fn() };
    });
    
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ message: 'User created successfully', userId: 'new-user-timeout-id' });
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Warning: Could not retrieve current session, proceeding with user creation. Audit log will reflect unknown admin.",
      expect.objectContaining({name: 'TimeoutError', message: 'Session fetch timed out'})
    );
    expect(auditLogsInsertMock).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.stringContaining('User timeout@example.com created by unknown admin (session fetch timeout)'),
    }));
    
    consoleWarnSpy.mockRestore();
  });

  // Test Case 8: Timeout during admin.createUser
  it('should return 504 if admin.createUser times out', async () => {
    const userData = {
      email: 'auth-timeout@example.com',
      password: 'password123',
      full_name: 'Auth Timeout User',
      role: 'client',
    };
    (mockRequest.json as jest.Mock).mockResolvedValueOnce(userData);
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'admin-user-id' } } } });

    // Mock withTimeout to throw a specific error for createUser
     (createClient as jest.Mock).mockReturnValue({
      auth: {
        admin: {
          // Simulate withTimeout throwing an error for createUser
          createUser: jest.fn().mockRejectedValueOnce(new Error('Timeout during createUser')),
          deleteUser: mockDeleteUser,
        },
      },
      from: jest.fn().mockReturnValue({
        insert: mockInsert,
      }),
    });
    // If withTimeout is a separate utility, mock it directly:
    // (withTimeout as jest.Mock).mockImplementation((promiseFunc, timeout) => {
    //   if (promiseFunc.name.includes('createUser')) { // Heuristic, better to identify mock target
    //     return Promise.reject(new Error('Timeout during createUser'));
    //   }
    //   return promiseFunc(); // Default pass-through
    // });


    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(504); // Gateway Timeout or similar
    expect(responseBody).toEqual({ error: 'Timeout creating user in Supabase Auth' });
    expect(mockInsert).not.toHaveBeenCalled(); // No DB insert should occur
  });

  // CI-Specific Test Probe
  it('should check and log CI environment variable', () => {
    const isCI = process.env.CI === 'true';
    const ciSystem = process.env.CI_SYSTEM_NAME || 'Unknown'; // Example of another common CI variable

    console.log(`[CI_PROBE] process.env.CI = ${process.env.CI}`);
    console.log(`[CI_PROBE] Test is running in CI environment (based on process.env.CI): ${isCI}`);
    console.log(`[CI_PROBE] CI System (process.env.CI_SYSTEM_NAME): ${ciSystem}`);
    
    // A simple assertion to ensure the test runs and completes.
    // This assertion doesn't depend on whether it's CI or not, just that the code runs.
    expect(typeof isCI).toBe('boolean');

    // Optional: If you want to enforce that CI=true in your actual CI environment, you could do:
    // if (process.env.EXPECT_IN_CI === 'true') { // An example custom variable you might set in your CI pipeline
    //   expect(isCI).toBe(true);
    //   console.log('[CI_PROBE] EXPECT_IN_CI is true, asserting process.env.CI is true.');
    // }
  });
});
