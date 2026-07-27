"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/eula.routes.ts
const express_1 = require("express");
const eula_controller_1 = require("../controllers/eula.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const eulaRouter = (0, express_1.Router)();
// Public routes
eulaRouter.get('/content', eula_controller_1.getEulaContent);
// Protected routes (require authentication)
eulaRouter.get('/check', auth_middleware_1.default, eula_controller_1.checkEulaStatus);
eulaRouter.post('/sign', auth_middleware_1.default, eula_controller_1.signEula);
eulaRouter.get('/history', auth_middleware_1.default, eula_controller_1.getSignatureHistory);
// Admin routes (require ConnectGo staff privileges)
eulaRouter.get('/admin/signatures', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), eula_controller_1.getAllSignatures);
eulaRouter.put('/admin/signatures/:id/revoke', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), eula_controller_1.revokeSignature);
eulaRouter.get('/admin/statistics', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), eula_controller_1.getSignatureStatistics);
exports.default = eulaRouter;
//# sourceMappingURL=eula.routes.js.map