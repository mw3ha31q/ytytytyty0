// src/pages/api/login.js
import { authenticateUser, createSession } from '../../lib/auth.js';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Login attempt for:', username);
    const user = authenticateUser(username, password);
    
    if (user) {
      const sessionToken = createSession(user);
      console.log('Session created for:', username);
      
      // Set cookie with proper encoding
      const cookieValue = encodeURIComponent(sessionToken);
        
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Set-Cookie': `auth_session=${cookieValue}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`,
          'Content-Type': 'application/json'
        }
      });
    }
    
    console.log('Authentication failed for:', username);
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}