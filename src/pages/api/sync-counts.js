import { syncAllVideoCounts, loadAccounts, saveAccounts, makeOAuthClient } from '../../lib/youtube.js';
import { google } from 'googleapis';

export async function POST({ request }) {
  // User auth is already checked by middleware
  // and user data is attached to request
  const user = request.user;
  
  if (!user || !user.groups.includes('admin')) {
    return new Response('Forbidden', { status: 403 });
  }
  
  try {
    // Get single account if specified
    const body = await request.text();
    let targetEmail = null;
    
    if (body) {
      try {
        const data = JSON.parse(body);
        targetEmail = data.email;
      } catch {
        // No specific email, sync all
      }
    }
    
    const accounts = loadAccounts();
    const results = {};
    
    if (targetEmail) {
      // Sync single account
      if (!accounts[targetEmail] || !accounts[targetEmail].token) {
        return new Response(JSON.stringify({ error: 'Account not found or not connected' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const count = await fetchSingleAccountVideoCount(targetEmail, accounts[targetEmail]);
      results[targetEmail] = count;
      
    } else {
      // Sync all accounts
      for (const [email, data] of Object.entries(accounts)) {
        if (data.token) {
          try {
            const count = await fetchSingleAccountVideoCount(email, data);
            results[email] = count;
            // Rate limiting between accounts
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error syncing ${email}:`, error);
            results[email] = { error: error.message };
          }
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ 
      error: 'Sync failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function fetchSingleAccountVideoCount(email, accountData) {
  const oauth2Client = makeOAuthClient(email, accountData);
  oauth2Client.setCredentials(accountData.token);
  
  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });
  
  try {
    // Get channel statistics
    const channelResponse = await youtube.channels.list({
      part: ['statistics'],
      mine: true
    });
    
    if (channelResponse.data.items && channelResponse.data.items.length > 0) {
      const videoCount = parseInt(channelResponse.data.items[0].statistics.videoCount) || 0;
      
      // Update accounts file
      const accounts = loadAccounts();
      accounts[email].video_count = videoCount;
      accounts[email].last_updated = new Date().toISOString();
      saveAccounts(accounts);
      
      return {
        count: videoCount,
        updated: true
      };
    }
    
    return {
      count: 0,
      error: 'No channel found'
    };
    
  } catch (error) {
    if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
      console.error(`Token expired for ${email}`);
      throw new Error('Token expired - reconnect account');
    }
    throw error;
  }
}