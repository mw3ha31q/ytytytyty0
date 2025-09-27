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
    const [token, signature] = signedToken.split('.');
    if (!token || !signature) return null;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    
    // Constant-time comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    
    // Decode user data
    const userData = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    
    // Validate user still exists and has same role
    const users = loadUsers();
    const currentUser = users.users[userData.username];
    
    if (!currentUser) return null;
    
    // Return current user data (in case roles changed)
    return {
      username: userData.username,
      role: currentUser.role,
      groups: currentUser.groups
    };
    
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

function parseCookies(cookieString) {
  const cookies = {};
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });
  return cookies;
}

function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { users: {} };
  }
}