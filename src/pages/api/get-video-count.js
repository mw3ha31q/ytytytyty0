import { fetchVideoCount } from '../../lib/youtube.js';

export async function POST({ request }) {
  const { email } = await request.json();
  
  try {
    const count = await fetchVideoCount(email);
    return new Response(JSON.stringify({ count, suspended: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    
    
    const suspended = Boolean(error?.suspended);
    return new Response(JSON.stringify({ 
      count: 0, 
      error: true,
      suspended,
      message: error?.message || 'Unknown error'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}