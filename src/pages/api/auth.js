import { loadAccounts, saveAccounts, makeOAuthClient, getAuthUrl } from '../../lib/youtube.js';

export async function GET({ url }) {
  const setupEmail = url.searchParams.get('setup');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // Email passed in state
  
  // If setup parameter, redirect to Google OAuth
  if (setupEmail) {
    const accounts = loadAccounts();
    const accountData = accounts[setupEmail];
    if (!accountData) {
      return new Response('Account not found', { status: 404 });
    }
    
    const authUrl = getAuthUrl(setupEmail, accountData);
    return Response.redirect(authUrl);
  }
  
  // Handle OAuth callback
  if (code && state) {
    try {
      const accounts = loadAccounts();
      const email = state;
      const accountData = accounts[email];
      
      if (!accountData) {
        throw new Error('Account not found');
      }
      
      const oauth2Client = makeOAuthClient(email, accountData);
      const { tokens } = await oauth2Client.getToken(code);
      
      // Save token
      accounts[email].token = tokens;
      saveAccounts(accounts);
      
      // Redirect to main page with success message
      return Response.redirect('/?auth=success');
      
    } catch (error) {
      console.error('Auth error:', error);
      return Response.redirect('/?auth=error');
    }
  }
  
  return new Response('Invalid request', { status: 400 });
}