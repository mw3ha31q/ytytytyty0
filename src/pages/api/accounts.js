import { loadAccounts } from '../../lib/youtube.js';

export async function GET() {
  const accounts = loadAccounts();
  
  // Remove sensitive tokens from response
  const safeAccounts = {};
  for (const [email, data] of Object.entries(accounts)) {
    safeAccounts[email] = {
      hasToken: !!data.token,
      suspended: !!data.suspended,
      videosCount: data.videos ? data.videos.length : 0
    };
  }
  
  return new Response(JSON.stringify(safeAccounts), {
    headers: { 'Content-Type': 'application/json' }
  });
}