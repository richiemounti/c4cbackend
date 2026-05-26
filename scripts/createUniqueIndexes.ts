import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function createIndexes() {
  await connectToDatabase();
  
    const db = mongoose.connection.db;
    if (!db) {
    console.error('❌ Database connection not established');
    process.exit(1);
    }
  
  console.log('Checking for duplicates first...');

  const projectDupes = await db.collection('projectsetups').aggregate([
    { $group: { _id: '$project', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  const siteDupes = await db.collection('projectsitesetups').aggregate([
    { $group: { _id: '$projectSite', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (projectDupes.length > 0) {
    console.error('❌ Duplicate projectsetups found — fix these before creating index:', projectDupes);
    await disconnectFromDatabase();
    process.exit(1);
  }

  if (siteDupes.length > 0) {
    console.error('❌ Duplicate projectsitesetups found — fix these before creating index:', siteDupes);
    await disconnectFromDatabase();
    process.exit(1);
  }

  console.log('✅ No duplicates found, safe to create indexes\n');

  console.log('Creating unique index on projectsetups...');
  await db.collection('projectsetups').createIndex(
    { project: 1 },
    { unique: true, name: 'project_1_unique' }
  );
  console.log('✅ projectsetups index created');

  console.log('Creating unique index on projectsitesetups...');
  await db.collection('projectsitesetups').createIndex(
    { projectSite: 1 },
    { unique: true, name: 'projectSite_1_unique' }
  );
  console.log('✅ projectsitesetups index created');

  console.log('\nVerifying...');
  const projectIndexes = await db.collection('projectsetups').indexes();
  const siteIndexes = await db.collection('projectsitesetups').indexes();

  const projectUnique = projectIndexes.find((i: any) => i.unique && i.key?.project);
  const siteUnique = siteIndexes.find((i: any) => i.unique && i.key?.projectSite);

  console.log(projectUnique ? '✅ projectsetups unique index confirmed' : '❌ projectsetups index not found');
  console.log(siteUnique ? '✅ projectsitesetups unique index confirmed' : '❌ projectsitesetups index not found');

  await disconnectFromDatabase();
}

createIndexes().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});