import { loadAccounts, saveAccounts } from '../../lib/youtube.js';

export async function POST({ request }) {
  const { email, video_count, suspended } = await request.json();
  const accounts = loadAccounts();
  
  if (accounts[email]) {
    accounts[email].video_count = video_count;
    accounts[email].last_updated = new Date().toISOString();
    
    if (typeof video_count === 'number') {
        accounts[email].video_count = video_count;
        } else if (typeof video_count === 'object' && video_count.count) {
        accounts[email].video_count = video_count.count; 
    }

    if (typeof suspended === 'boolean') {
        accounts[email].suspended = suspended;
    }


    saveAccounts(accounts);
  }
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}