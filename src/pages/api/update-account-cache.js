import { loadAccounts, saveAccounts } from '../../lib/youtube.js';

export async function POST({ request }) {
  const { email, video_count, suspended } = await request.json();
  const accounts = loadAccounts();
  
  if (accounts[email]) {
    accounts[email].video_count = video_count;
    accounts[email].last_updated = new Date().toISOString();
    if (suspended) accounts[email].suspended = true;
    saveAccounts(accounts);
  }
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}