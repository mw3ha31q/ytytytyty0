import { fetchVideoCount } from '../../lib/youtube.js';

export async function POST({ request }) {
  const { email } = await request.json();
  
  try {
    const count = await fetchVideoCount(email);
    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Check for suspended account
    if (error.message?.includes('suspended') || error.message?.includes('authenticatedUserAccountSuspended')) {
      return new Response(JSON.stringify({ 
        count: 0, 
        error: true,
        suspended: true,
        message: 'Account suspended'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Return other errors with message
    return new Response(JSON.stringify({ 
      count: 0, 
      error: true,
      message: error.message || 'Unknown error'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}