import mongoose from "mongoose";
import { env } from "../config/env";

if (!env.DB_URI) {
  throw new Error('Please define the DB_URI environment variable inside .env file');
}

const connectionOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2,
};

let isConnected = false;
let isReconnecting = false;   // guard against parallel reconnect attempts
let listenersAttached = false; // guard against stacking listeners

const scheduleReconnect = () => {
  if (isReconnecting) return; // already trying, don't stack
  isReconnecting = true;

  console.warn('MongoDB disconnected. Reconnecting in 10s...');

  setTimeout(async () => {
    try {
      await connectToDatabase();
    } catch (err) {
      // connectToDatabase exhausted its retries — just log once and wait
      // for the next disconnected event or manual restart
      console.error('MongoDB reconnect failed after all retries. Will retry on next disconnect event.');
    } finally {
      isReconnecting = false;
    }
  }, 10000); // longer delay — reduces log spam during sustained outages
};

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  // Log only the message, not the full error object
  mongoose.connection.on('error', (err: Error) => {
    console.error('MongoDB connection error:', err.message);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
    isConnected = true;
  });
};

export const connectToDatabase = async (retryCount = 5): Promise<typeof mongoose> => {
  if (isConnected) {
    return mongoose;
  }

  for (let attempt = retryCount; attempt >= 0; attempt--) {
    try {
      console.log(`Connecting to MongoDB... (attempt ${retryCount - attempt + 1}/${retryCount + 1})`);
      const connection = await mongoose.connect(env.DB_URI, connectionOptions);

      isConnected = true;
      attachListeners(); // safe — only attaches once
      console.log(`MongoDB connected: ${connection.connection.host} [${env.NODE_ENV}]`);
      return connection;

    } catch (error) {
      isConnected = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`MongoDB connection failed: ${message}`);

      if (attempt === 0) {
        console.error('All connection attempts exhausted.');
        throw error;
      }

      console.log(`Retrying in 5s... (${attempt} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Failed to connect to MongoDB');
};

export const disconnectFromDatabase = async (): Promise<void> => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  listenersAttached = false;
  console.log('MongoDB disconnected');
};

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    if (!isConnected || !mongoose.connection?.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
};