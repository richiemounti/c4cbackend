import mongoose from 'mongoose';
import User from '../models/user.model';
import { resolve } from 'path';
import { config } from 'dotenv';
import * as fs from 'fs';

// Load environment variables with better path resolution
const envPaths = [
  resolve(__dirname, '../.env.development.local'),
  resolve(__dirname, '../.env.development'),
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env')
];

// Try to load from the first existing file
let envLoaded = false;
for (const path of envPaths) {
  if (fs.existsSync(path)) {
    console.log(`Loading environment from ${path}`);
    config({ path });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('No .env file found, using process.env variables');
}

const VALID_ROLES = [
  'owner', 'admin', 'accountManager', 'analyst',
  'manager', 'projectCreator', 'leadership', 'hq',
  'communications', 'fieldStaff', 'fieldAgent'
];

const VALID_CONNECTGO_ROLES = ['owner', 'admin', 'accountManager', 'analyst'];

async function removeStaleRoles() {
  // Debug environment variables
  console.log('Environment check:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`DB_URI exists: ${!!process.env.DB_URI}`);

  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    throw new Error('DB_URI environment variable is not set');
  }

  if (!dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
    throw new Error(
      `Invalid DB_URI format. Expected to start with "mongodb://" or "mongodb+srv://", but got: ${dbUri.substring(0, 20)}...`
    );
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB successfully\n');

  const usersWithStaleRoles = await User.find({
    'roles.role': { $nin: VALID_ROLES }
  });

  if (usersWithStaleRoles.length === 0) {
    console.log('✅ No users with stale roles found. Nothing to do.');
    await mongoose.connection.close();
    return;
  }

  console.log(`Found ${usersWithStaleRoles.length} user(s) with stale roles:\n`);

  for (const user of usersWithStaleRoles) {
    const staleRoles = user.roles
      .filter((r: any) => !VALID_ROLES.includes(r.role))
      .map((r: any) => r.role);

    console.log(`👤 ${user.email} — stale roles: [${staleRoles.join(', ')}]`);

    const before = user.roles.length;
    user.roles = user.roles.filter((r: any) => VALID_ROLES.includes(r.role)) as any;
    const removed = before - user.roles.length;

    // Fix primaryRole if it was one of the removed stale ones
    if (!VALID_ROLES.includes(user.primaryRole)) {
      user.primaryRole = user.roles.length > 0 ? user.roles[0].role : 'manager';
      console.log(`   ↳ primaryRole reset to: ${user.primaryRole}`);
    }

    // Fix isConnectGoStaff flag
    user.isConnectGoStaff = user.roles.some((r: any) =>
      VALID_CONNECTGO_ROLES.includes(r.role)
    );

    await user.save();
    console.log(`   ↳ Removed ${removed} stale role(s). ✅\n`);
  }

  console.log('🎉 Done. All stale roles removed.');
  await mongoose.connection.close();
  console.log('Database connection closed');
}

// Run if called directly
if (require.main === module) {
  removeStaleRoles()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}