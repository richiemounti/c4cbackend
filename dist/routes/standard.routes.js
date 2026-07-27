"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/standard.routes.ts
const express_1 = require("express");
const standard_controller_1 = require("../controllers/standard.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const standardRouter = (0, express_1.Router)();
// Public routes
standardRouter.get('/', standard_controller_1.getStandards);
standardRouter.get('/:id', standard_controller_1.getStandard);
// ConnectGo staff only routes
standardRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), standard_controller_1.createStandard);
standardRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), standard_controller_1.updateStandard);
standardRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), standard_controller_1.archiveStandard);
standardRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), standard_controller_1.restoreStandard);
exports.default = standardRouter;
//# sourceMappingURL=standard.routes.js.map