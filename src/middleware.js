// src/middleware.js
import crypto from 'crypto';
import fs from 'fs';

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PUBLIC_PATHS = ['/login', '/api/login'];
const USERS_FILE = '/app/users.json';

export function onRequest({ request, url }, next) {
  // Skip auth for public paths
  if (PUBLIC_PATHS.some(path => url.pathname.startsWith(path))) {
    return next();
  }
  
  // Check for session cookie
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const session = cookies.auth_session;
  
  const user = verifySession(session);
  
  if (!user) {
    // Redirect to login for HTML pages, 401 for API
    if (url.pathname.startsWith('/api/')) {
      return new Response('Unauthorized', { status: 401 });
    }
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login' }
    });
  }
  
  // Role-based access control
  const path = url.pathname;
  
  // Admin-only routes
  if (path.startsWith('/accounts') && !user.groups.includes('admin')) {
    return new Response('Forbidden - Admin access required', { status: 403 });
  }
  
  // Uploader routes (upload API, main page)
  if (path.startsWith('/api/upload') && !user.groups.includes('uploader')) {
    return new Response('Forbidden - Uploader access required', { status: 403 });
  }
  
  // Sync routes - admin only
  if (path.startsWith('/api/sync') && !user.groups.includes('admin')) {
    return new Response('Forbidden - Admin access required', { status: 403 });
  }
  
  // Store user in request for use in pages/endpoints
  request.user = user;
  
  return next();
}

function verifySession(signedToken) {
  if (!signedToken) return null;
  
  try {
    const parts = signedToken.split('.');
    if (parts.length !== 2) return null;
    
    const [token, signature] = parts;
    if (!token || !signature) return null;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures (both are hex strings, so we can compare directly)
    if (signature !== expectedSignature) {
      console.log('Signature mismatch');
      return null;
    }
    
    // Decode user data
    const userData = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    
    // Check expiration
    if (userData.exp && userData.exp < Date.now()) {
      console.log('Session expired');
      return null;
    }
    
    // Validate user still exists and has same role
    const users = loadUsers();
    const currentUser = users.users[userData.username];
    
    if (!currentUser) {
      console.log('User not found:', userData.username);
      return null;
    }
    
    // Return current user data (in case roles changed)
    return {
      username: userData.username,
      role: currentUser.role,
      groups: currentUser.groups || []
    };
    
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const parts = cookie.trim().split('=');
    if (parts.length === 2) {
      cookies[parts[0]] = parts[1];
    }
  });
  return cookies;
}

function loadUsers() {
  try {
    // First check if file exists
    if (!fs.existsSync(USERS_FILE)) {
      console.log('Users file not found, creating default');
      // Create default superadmin
      const defaultUsers = {
        users: {
          superadmin: {
            // Default password: "changeme"
            password: crypto.pbkdf2Sync('changeme', SECRET, 1000, 64, 'sha256').toString('hex'),
            role: 'admin',
            groups: ['admin', 'uploader']
          }
        }
      };
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
      return defaultUsers;
    }
    
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users:', error);
    return { users: {} };
  }
}