// src/pages/api/sync-counts.js
import { loadAccounts, fetchVideoCount, syncAllVideoCounts } from '../../lib/youtube.js';

// export async function POST({ request }) {
//   const { email } = await request.json();
//   const count = await fetchVideoCount(email);
//   return new Response(JSON.stringify({ count }));
// }

export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await fetchVideoCount(body.email);

    // If email is provided, sync single account
    if (body.email) {
      const accounts = loadAccounts();
      if (!accounts[body.email] || !accounts[body.email].token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Account not found or not connected' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      try {
        const count = await fetchVideoCount(body.email);

        return new Response(JSON.stringify({
          success: true,
          email: body.email,
          count,
          suspended: false
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          email: body.email,
          error: error?.message || 'Unknown error',
          suspended: Boolean(error?.suspended)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } 
    // Otherwise sync all accounts
    else {
      const results = await syncAllVideoCounts();
      
      return new Response(JSON.stringify({ 
        success: true, 
        results 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}