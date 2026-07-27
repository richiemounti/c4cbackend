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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongodb_1 = require("../database/mongodb");
const healthRouter = (0, express_1.Router)();
/**
 * Health check endpoint
 * Returns status of API and its dependencies
 */
healthRouter.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Check database connection
    const isDatabaseConnected = yield (0, mongodb_1.checkDatabaseConnection)();
    // Overall health status
    const isHealthy = isDatabaseConnected;
    const status = {
        status: isHealthy ? 'ok' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
            database: {
                status: isDatabaseConnected ? 'connected' : 'disconnected'
            },
            api: {
                status: 'running',
                uptime: process.uptime()
            }
        }
    };
    // Return appropriate status code
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(status);
}));
exports.default = healthRouter;
//# sourceMappingURL=health.routes.js.map