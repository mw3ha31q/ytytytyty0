import crypto from 'crypto';
import fs from 'fs';

const USERS_FILE = '/app/users.json';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { users: {} };
  }
}

export function hashPassword(password) {
  return crypto.pbkdf2Sync(password, SECRET, 1000, 64, 'sha256').toString('hex');
}

export function verifyPassword(password, hash) {
  const testHash = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
}

export function authenticateUser(username, password) {
  const { users } = loadUsers();
  const user = users[username];
  
  if (!user || !verifyPassword(password, user.password)) {
    return null;
  }
  
  return {
    username,
    role: user.role,
    groups: user.groups
  };
}

export function createSession(userData) {
  const sessionData = JSON.stringify(userData);
  const token = Buffer.from(sessionData).toString('base64');
  const signature = crypto.createHmac('sha256', SECRET).update(token).digest('hex');
  return `${token}.${signature}`;
}

export function verifySession(signedToken) {
  // ... verify signature and return user data ...
}