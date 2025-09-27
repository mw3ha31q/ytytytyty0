// src/pages/api/auth/callback.js
import { loadAccounts, saveAccounts, makeOAuthClient } from '../../../lib/youtube.js';

export async function GET({ url, request }) {
  // Check if user is authenticated (middleware should have verified this)
  const user = request.user;
  if (!user || !user.groups.includes('admin')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // email
  const setup = url.searchParams.get('setup');
  
  // Handle setup request (show auth URL)
  if (setup) {
    const accounts = loadAccounts();
    const accountData = accounts[setup];
    
    if (!accountData) {
      return new Response('Account not found', { status: 404 });
    }
    
    const oauth2Client = makeOAuthClient(setup, accountData);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ],
      state: setup,
      redirect_uri: accountData.redirect_uri || `${url.origin}/api/auth/callback`
    });
    
    // Redirect to Google OAuth
    return new Response(null, {
      status: 302,
      headers: { 'Location': authUrl }
    });
  }
  
  // Handle OAuth callback
  if (code && state) {
    try {
      const accounts = loadAccounts();
      const accountData = accounts[state];
      
      if (!accountData) {
        return new Response('Account configuration not found', { status: 404 });
      }
      
      const oauth2Client = makeOAuthClient(state, accountData);
      oauth2Client.redirectUri = accountData.redirect_uri || `${url.origin}/api/auth/callback`;
      
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      // Save tokens
      accounts[state].token = tokens;
      accounts[state].last_updated = new Date().toISOString();
      saveAccounts(accounts);
      
      // Success page
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authorization Success</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .success {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 { color: #28a745; }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
            a:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✓ Authorization Successful</h1>
            <p>Account ${state} has been connected.</p>
            <a href="/">Back to Dashboard</a>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
      
    } catch (error) {
      console.error('OAuth error:', error);
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authorization Error</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .error {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 { color: #dc3545; }
            pre {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 4px;
              text-align: left;
              overflow-x: auto;
              max-width: 500px;
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #6c757d;
              color: white;
              text-decoration: none;
              border-radius: 4px;
            }
            a:hover { background: #5a6268; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>✗ Authorization Failed</h1>
            <p>Could not complete authorization.</p>
            <pre>${error.message}</pre>
            <a href="/">Back to Dashboard</a>
          </div>
        </body>
        </html>
      `, {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
  
  return new Response('Invalid request', { status: 400 });
}