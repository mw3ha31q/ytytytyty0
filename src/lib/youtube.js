import { google } from 'googleapis';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Use absolute path for Docker container
const ACCOUNTS_FILE = '/app/accounts_db.json';

export function loadAccounts() {
  try {
    // Check if file exists
    if (!fs.existsSync(ACCOUNTS_FILE)) {
      console.error(`accounts_db.json not found at ${ACCOUNTS_FILE}`);
      return {};
    }
    const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading accounts_db.json:', error);
    return {};
  }
}

export function saveAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

export function makeOAuthClient(email, data = {}) {
  const clientId = data.clientid || data.clientId;
  const clientSecret = data.client_secret;
  const redirect = data.redirect_uri || 'http://localhost:3000/api/auth';
  
  return new google.auth.OAuth2(clientId, clientSecret, redirect);
}

export function getAuthUrl(email, data = {}) {
  const oauth2Client = makeOAuthClient(email, data);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube.upload', 
            'https://www.googleapis.com/auth/youtube.force-ssl'],
    login_hint: email,
    state: email
  });
}

export function getAccountWithLeastVideos() {
  const accounts = loadAccounts();
  let selectedAccount = null;
  let minVideos = Infinity;
  
  for (const [email, data] of Object.entries(accounts)) {
    if (data.token) {
      const videoCount = data.video_count || 0;
      if (videoCount < minVideos) {
        minVideos = videoCount;
        selectedAccount = { email, data, videoCount };
      }
    }
  }
  
  return selectedAccount;
}

export function incrementVideoCount(email) {
  const accounts = loadAccounts();
  if (accounts[email]) {
    accounts[email].video_count = (accounts[email].video_count || 0) + 1;
    saveAccounts(accounts);
  }
}

// export async function fetchVideoCount(email) {
//   const accounts = loadAccounts();
//   const accountData = accounts[email];
  
//   if (!accountData || !accountData.token) {
//     return 0;
//   }
  
//   try {
//     const oauth2Client = makeOAuthClient(email, accountData);
//     oauth2Client.setCredentials(accountData.token);
    
//     const youtube = google.youtube({
//       version: 'v3',
//       auth: oauth2Client
//     });
    
//     const channelResponse = await youtube.channels.list({
//       part: ['statistics'],
//       mine: true
//     });
    
//     if (channelResponse.data.items && channelResponse.data.items.length > 0) {
//       const videoCount = parseInt(channelResponse.data.items[0].statistics.videoCount) || 0;
      
//       accounts[email].video_count = videoCount;
//       saveAccounts(accounts);
      
//       return videoCount;
//     }
//   } catch (error) {
//     console.error(`Error fetching video count for ${email}:`, error);
//   }
  
//   return 0;
// }

export async function fetchVideoCount(email) {
  const accounts = loadAccounts();
  const accountData = accounts[email];

  if (!accountData || !accountData.token) return { count: 0, suspended: false };

  try {
    const oauth2Client = makeOAuthClient(email, accountData);
    oauth2Client.setCredentials(accountData.token);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const channelResponse = await youtube.channels.list({
      part: ['statistics'],
      mine: true
    });

    if (channelResponse.data.items && channelResponse.data.items.length > 0) {
      const videoCount = parseInt(channelResponse.data.items[0].statistics.videoCount) || 0;
      accounts[email].video_count = videoCount;
      saveAccounts(accounts);
      return { count: videoCount, suspended: false };
    }
  } catch (error) {
    console.error(`Error fetching video count for ${email}:`, error);

    if (error?.message?.includes('suspended')) {
      return { count: 0, suspended: true };
    }
  }

  return { count: 0, suspended: false };
}


export async function syncAllVideoCounts() {
  const accounts = loadAccounts();
  const results = {};
  
  for (const email of Object.keys(accounts)) {
    if (accounts[email].token) {
      const count = await fetchVideoCount(email);
      results[email] = count;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

export async function uploadVideo(email, videoData, filePath) {
  const accounts = loadAccounts();
  const accountData = accounts[email];
  
  if (!accountData || !accountData.token) {
    throw new Error('No token found for this account');
  }
  
  const oauth2Client = makeOAuthClient(email, accountData);
  oauth2Client.setCredentials(accountData.token);
  
  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });
  
  const res = await youtube.videos.insert({
    part: ['id', 'snippet', 'status'],
    notifySubscribers: true,
    requestBody: {
      snippet: {
        title: videoData.title,
        description: videoData.description,
        tags: videoData.tags ? videoData.tags.split(',').map(t => t.trim()) : [],
        categoryId: videoData.categoryId || '22'
      },
      status: {
        privacyStatus: videoData.privacy || 'private'
      }
    },
    media: {
      body: fs.createReadStream(filePath)
    }
  });
  
  incrementVideoCount(email);
  
  return res.data;
}