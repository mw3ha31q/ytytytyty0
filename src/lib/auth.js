import crypto from 'crypto';
import fs from 'fs';

const USERS_FILE = '/app/users.json';
const SECRET = process.env.SESSION_SECRET || 'your-secret-key-here';

export function loadUsers() {
  try {
    // First check if file exists
    if (!fs.existsSync(USERS_FILE)) {
      console.log('Users file not found, creating default');
      // Create default superadmin
      const defaultUsers = {
        users: {
          superadmin: {
            // Default password: "changeme"
            password: hashPassword('changeme'),
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

export function hashPassword(password) {
  return crypto.pbkdf2Sync(password, SECRET, 1000, 64, 'sha256').toString('hex');
}

export function verifyPassword(password, hash) {
  const testHash = hashPassword(password);
  try {
    // Ensure both are valid hex strings
    if (!/^[a-f0-9]+$/i.test(hash) || !/^[a-f0-9]+$/i.test(testHash)) {
      console.log('Invalid hash format');
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch (error) {
    console.error('Password verification error:', error.message);
    return false;
  }
}

export function authenticateUser(username, password) {
  const { users } = loadUsers();
  const user = users[username];
  
  if (!user) {
    console.log('User not found:', username);
    return null;
  }
  
  if (!verifyPassword(password, user.password)) {
    console.log('Invalid password for:', username);
    return null;
  }
  
  console.log('User authenticated:', username);
  return {
    username,
    role: user.role,
    groups: user.groups || []
  };
}

export function createSession(userData) {
  // Add expiration time (24 hours)
  const sessionData = {
    ...userData,
    exp: Date.now() + (24 * 60 * 60 * 1000)
  };
  
  // Create base64 token
  const jsonString = JSON.stringify(sessionData);
  const token = Buffer.from(jsonString).toString('base64');
  
  // Create signature
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(token);
  const signature = hmac.digest('hex');
  
  return `${token}.${signature}`;
}

export function verifySession(signedToken) {
  if (!signedToken) return null;
  
  try {
    const parts = signedToken.split('.');
    if (parts.length !== 2) {
      console.log('Invalid token format');
      return null;
    }
    
    const [token, signature] = parts;
    if (!token || !signature) return null;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    
    // Timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return null;
    }
    
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      console.log('Signature verification failed');
      return null;
    }
    
    // Decode and validate
    const jsonString = Buffer.from(token, 'base64').toString('utf8');
    const userData = JSON.parse(jsonString);
    
    // Check expiration
    if (userData.exp && userData.exp < Date.now()) {
      console.log('Session expired');
      return null;
    }
    
    // Validate user still exists
    const { users } = loadUsers();
    const currentUser = users[userData.username];
    
    if (!currentUser) {
      console.log('User no longer exists:', userData.username);
      return null;
    }
    
    return {
      username: userData.username,
      role: currentUser.role,
      groups: currentUser.groups || []
    };
  } catch (error) {
    console.error('Session verification error:', error.message);
    return null;
  }
}

export function getUser(Astro) {
  const token = Astro.cookies.get('session')?.value;
  if (!token) return null;
  
  return verifySession(token);
}