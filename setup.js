#!/usr/bin/env node
// setup-users.js - Run this to set up user accounts

import crypto from 'crypto';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const SECRET = process.env.SESSION_SECRET || 'your-secret-key-here';
const USERS_FILE = './users.json';

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, SECRET, 1000, 64, 'sha256').toString('hex');
}

async function main() {
  console.log('\n=================================');
  console.log('YouTube Upload Panel - User Setup');
  console.log('=================================\n');
  
  const users = {};
  
  // Set up superadmin
  console.log('Setting up SUPERADMIN account...');
  const superadminPassword = await question('Enter password for superadmin (or press Enter for "changeme"): ');
  users.superadmin = {
    password: hashPassword(superadminPassword || 'changeme'),
    role: 'admin',
    groups: ['admin', 'uploader']
  };
  console.log('✓ Superadmin account configured\n');
  
  // Ask if they want to add more users
  const addMore = await question('Add more users? (y/n): ');
  
  if (addMore.toLowerCase() === 'y') {
    let adding = true;
    while (adding) {
      const username = await question('\nEnter username: ');
      const password = await question('Enter password: ');
      const role = await question('Enter role (admin/uploader): ');
      
      const groups = [];
      if (role === 'admin') {
        groups.push('admin', 'uploader');
      } else if (role === 'uploader') {
        groups.push('uploader');
      }
      
      users[username] = {
        password: hashPassword(password),
        role: role,
        groups: groups
      };
      
      console.log(`✓ User "${username}" added`);
      
      const continueAdding = await question('\nAdd another user? (y/n): ');
      adding = continueAdding.toLowerCase() === 'y';
    }
  }
  
  // Save to file
  const config = { users };
  fs.writeFileSync(USERS_FILE, JSON.stringify(config, null, 2));
  
  console.log('\n✅ Users configuration saved to users.json');
  console.log('\nIMPORTANT: Set the same SESSION_SECRET in your docker-compose.yaml:');
  console.log(`SESSION_SECRET=${SECRET}`);
  
  rl.close();
}

main().catch(console.error);