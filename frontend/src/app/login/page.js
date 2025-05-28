// /frontend/src/app/login/page.js
'use client'; // Required for Next.js App Router components with event handlers

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage(''); // Clear previous messages

    if (!supabase) {
      setMessage('Supabase client is not initialized. Check .env.local variables.');
      return;
    }

    // Placeholder for actual Supabase login logic
    // For now, just log to console and set a message
    console.log('Attempting login with:', { email, password });
    setMessage('Login functionality to be implemented with Supabase.');
    
    // Example of Supabase auth (to be uncommented and completed later):
    // const { data, error } = await supabase.auth.signInWithPassword({
    //   email: email,
    //   password: password,
    // });
    // if (error) {
    //   setMessage(`Login failed: ${error.message}`);
    // } else {
    //   setMessage('Login successful! User: ' + data.user.email);
    //   // Redirect user or update UI
    // }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Login
        </button>
      </form>
      {message && <p style={{ marginTop: '15px', color: message.startsWith('Login failed') ? 'red' : 'green' }}>{message}</p>}
      {!supabase && <p style={{color: 'red', marginTop: '10px'}}>Supabase client not available. Check console and .env.local.</p>}
    </div>
  );
}
