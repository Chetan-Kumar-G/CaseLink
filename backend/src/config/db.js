import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

/**
 * Connects to MONGO_URI, or — in development without one — starts a local
 * MongoDB from mongodb-memory-server. With DEV_DB_PATH set (the default) the
 * data is stored on disk and survives restarts; set DEV_DB_PATH=memory for a
 * throwaway database that is re-seeded on every start.
 */
export async function connectDb() {
  let uri = env.mongoUri;
  let mode = 'external';
  if (!uri) {
    if (env.isProd) throw new Error('MONGO_URI is required in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const persistent = env.devDbPath !== 'memory';
    const instance = {};
    if (persistent) {
      const dbPath = path.resolve(env.devDbPath);
      fs.mkdirSync(dbPath, { recursive: true });
      Object.assign(instance, { dbPath, storageEngine: 'wiredTiger' });
    }
    console.log(`[db] MONGO_URI empty — starting local MongoDB (${persistent ? `persistent at ${instance.dbPath}` : 'in-memory'})…`);
    memoryServer = await MongoMemoryServer.create({ instance });
    uri = memoryServer.getUri('caselink');
    mode = persistent ? 'local' : 'memory';
  }
  mongoose.set('strictQuery', true);
  // Fail fast if the database is unreachable at boot; bounded pool for small instances.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 20 });
  console.log(`[db] connected (${mode})`);
  return { mode };
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop({ doCleanup: false });
}
