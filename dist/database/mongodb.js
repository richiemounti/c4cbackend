"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseConnection = exports.disconnectFromDatabase = exports.connectToDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
if (!env_1.env.DB_URI) {
    throw new Error('Please define the DB_URI environment variable inside .env file');
}
const connectionOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 2,
};
let isConnected = false;
let isReconnecting = false; // guard against parallel reconnect attempts
let listenersAttached = false; // guard against stacking listeners
const scheduleReconnect = () => {
    if (isReconnecting)
        return; // already trying, don't stack
    isReconnecting = true;
    console.warn('MongoDB disconnected. Reconnecting in 10s...');
    setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, exports.connectToDatabase)();
        }
        catch (err) {
            // connectToDatabase exhausted its retries — just log once and wait
            // for the next disconnected event or manual restart
            console.error('MongoDB reconnect failed after all retries. Will retry on next disconnect event.');
        }
        finally {
            isReconnecting = false;
        }
    }), 10000); // longer delay — reduces log spam during sustained outages
};
const attachListeners = () => {
    if (listenersAttached)
        return;
    listenersAttached = true;
    // Log only the message, not the full error object
    mongoose_1.default.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err.message);
        isConnected = false;
    });
    mongoose_1.default.connection.on('disconnected', () => {
        isConnected = false;
        scheduleReconnect();
    });
    mongoose_1.default.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
        isConnected = true;
    });
};
const connectToDatabase = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (retryCount = 5) {
    if (isConnected) {
        return mongoose_1.default;
    }
    for (let attempt = retryCount; attempt >= 0; attempt--) {
        try {
            console.log(`Connecting to MongoDB... (attempt ${retryCount - attempt + 1}/${retryCount + 1})`);
            const connection = yield mongoose_1.default.connect(env_1.env.DB_URI, connectionOptions);
            isConnected = true;
            attachListeners(); // safe — only attaches once
            console.log(`MongoDB connected: ${connection.connection.host} [${env_1.env.NODE_ENV}]`);
            return connection;
        }
        catch (error) {
            isConnected = false;
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`MongoDB connection failed: ${message}`);
            if (attempt === 0) {
                console.error('All connection attempts exhausted.');
                throw error;
            }
            console.log(`Retrying in 5s... (${attempt} attempts left)`);
            yield new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    throw new Error('Failed to connect to MongoDB');
});
exports.connectToDatabase = connectToDatabase;
const disconnectFromDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!isConnected)
        return;
    yield mongoose_1.default.disconnect();
    isConnected = false;
    listenersAttached = false;
    console.log('MongoDB disconnected');
});
exports.disconnectFromDatabase = disconnectFromDatabase;
const checkDatabaseConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!isConnected || !((_a = mongoose_1.default.connection) === null || _a === void 0 ? void 0 : _a.db))
            return false;
        yield mongoose_1.default.connection.db.admin().ping();
        return true;
    }
    catch (_b) {
        return false;
    }
});
exports.checkDatabaseConnection = checkDatabaseConnection;
//# sourceMappingURL=mongodb.js.map