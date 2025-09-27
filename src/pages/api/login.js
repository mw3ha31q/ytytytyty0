import { authenticateUser, createSession } from '../../lib/auth.js';

export async function POST({ request }) {
  const { username, password } = await request.json();
  
  const user = authenticateUser(username, password);
  
  if (user) {
    const sessionToken = createSession(user);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Set-Cookie': `auth_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}