#!/usr/bin/env node
"use strict";
/**
 * Module dependencies.
 */
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
const app_1 = __importDefault(require("../app"));
const debug_1 = __importDefault(require("debug"));
const http_1 = __importDefault(require("http"));
const env_1 = require("../config/env");
const mongodb_1 = require("../database/mongodb");
// ── Socket.io ──────────────────────────────────────────────────────────────
const socket_service_1 = require("../services/socket.service");
const debug = (0, debug_1.default)('youthimpactbackend:server');
let server;
/**
 * Connect to MongoDB first, then start everything else.
 */
startApplication();
function startApplication() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, mongodb_1.connectToDatabase)();
            console.log('MongoDB connected successfully');
            startServer();
            setupHealthChecks();
        }
        catch (err) {
            console.error('Failed to start application:', err);
            process.exit(1);
        }
    });
}
/**
 * Start the Express server and attach Socket.io after DB is ready.
 */
function startServer() {
    const port = env_1.env.PORT;
    app_1.default.set('port', port);
    // Create the HTTP server wrapping the Express app
    server = http_1.default.createServer(app_1.default);
    // ── Initialize Socket.io on the same HTTP server ─────────────────────────
    (0, socket_service_1.initSocket)(server);
    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);
    function onError(error) {
        if (error.syscall !== 'listen') {
            throw error;
        }
        const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.error(bind + ' is already in use');
                process.exit(1);
                break;
            default:
                throw error;
        }
    }
    function onListening() {
        const addr = server.address();
        const bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + ((addr === null || addr === void 0 ? void 0 : addr.port) || 'unknown');
        console.log(`Youth Impact Platform API is running in ${env_1.env.NODE_ENV} mode on http://localhost:${port}`);
        debug('Listening on ' + bind);
    }
}
/**
 * Periodic database health checks.
 */
function setupHealthChecks() {
    const healthCheckInterval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
        const isConnected = yield (0, mongodb_1.checkDatabaseConnection)();
        if (!isConnected) {
            console.warn('Database connection lost during health check');
        }
    }), 30000);
    process.on('SIGINT', () => clearInterval(healthCheckInterval));
    process.on('SIGTERM', () => clearInterval(healthCheckInterval));
}
/**
 * Graceful shutdown.
 */
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
function gracefulShutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Shutting down gracefully...');
        yield (0, mongodb_1.disconnectFromDatabase)();
        if (server) {
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        }
        else {
            process.exit(0);
        }
        setTimeout(() => {
            console.error('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000);
    });
}
//# sourceMappingURL=www.js.map