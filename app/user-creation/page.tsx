"use client";

import { useState, FormEvent } from 'react';

export default function UserCreationPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userMetadata, setUserMetadata] = useState('{\n  "role": "staff"\n}');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');
    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(userMetadata);
    } catch (error) {
      setMessage('Error: User Metadata is not valid JSON.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/create-supabase-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          metadata: parsedMetadata,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(`Error: ${result.error || 'Failed to create user'}`);
      } else {
        setMessage(`Success! User ${result.user?.email || ''} created with ID: ${result.user?.id || ''}. Please check Supabase Dashboard.`);
        setEmail('');
        setPassword('');
      }
    } catch (error: any) {
      console.error('Network or unexpected error:', error);
      setMessage(`Error: ${error.message || 'An unexpected error occurred.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: 'auto', padding: '20px' }}>
      <h1>Create Supabase Auth User</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="email">Email:</label><br />
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="password">Password:</label><br />
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="userMetadata">User Metadata (JSON):</label><br />
          <textarea id="userMetadata" value={userMetadata} onChange={(e) => setUserMetadata(e.target.value)} rows={5} required style={{ width: '100%', padding: '8px', fontFamily: 'monospace' }} />
        </div>
        <button type="submit" disabled={isLoading} style={{ padding: '10px 15px' }}>
          {isLoading ? 'Creating...' : 'Create User'}
        </button>
      </form>
      {message && (
        <div style={{ marginTop: '20px', padding: '10px', border: message.startsWith('Error:') ? '1px solid red' : '1px solid green' }}>
          {message}
        </div>
      )}
    </div>
  );
}
