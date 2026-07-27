"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/indicator.routes.ts
const express_1 = require("express");
const indicator_controller_1 = require("../controllers/indicator.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const indicatorRouter = (0, express_1.Router)();
// Public routes
indicatorRouter.get('/', indicator_controller_1.getIndicators);
indicatorRouter.get('/:id', indicator_controller_1.getIndicator);
// ConnectGo staff only routes
indicatorRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), indicator_controller_1.createIndicator);
indicatorRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), indicator_controller_1.updateIndicator);
indicatorRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), indicator_controller_1.archiveIndicator);
indicatorRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), indicator_controller_1.restoreIndicator);
indicatorRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), indicator_controller_1.deleteIndicator);
exports.default = indicatorRouter;
//# sourceMappingURL=indicator.routes.js.map