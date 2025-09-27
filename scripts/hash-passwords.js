const crypto = require('crypto');
const password = process.argv[2];
const secret = process.env.SESSION_SECRET || 'your-secret';
const hash = crypto.pbkdf2Sync(password, secret, 1000, 64, 'sha256').toString('hex');
console.log(hash);