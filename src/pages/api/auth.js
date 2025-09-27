// src/lib/auth.js
import crypto from 'crypto';
import fs from 'fs';

const USERS_FILE = '/app/users.json';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

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
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch {
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
    if (parts.length !== 2) return null;
    
    const [token, signature] = parts;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', SECRET);
    hmac.update(token);
    const expectedSignature = hmac.digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Decode and validate
    const userData = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    
    // Check expiration
    if (userData.exp && userData.exp < Date.now()) {
      return null;
    }
    
    return userData;
  } catch {
    return null;
  }
}