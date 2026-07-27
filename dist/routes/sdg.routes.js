"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/sdg.routes.ts
const express_1 = require("express");
const sdg_controller_1 = require("../controllers/sdg.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const sdgRouter = (0, express_1.Router)();
// Public routes
sdgRouter.get('/', sdg_controller_1.getSDGs);
sdgRouter.get('/:id', sdg_controller_1.getSDG);
// ConnectGo staff only routes
sdgRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), sdg_controller_1.createSDG);
sdgRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), sdg_controller_1.updateSDG);
sdgRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), sdg_controller_1.archiveSDG);
sdgRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), sdg_controller_1.restoreSDG);
exports.default = sdgRouter;
//# sourceMappingURL=sdg.routes.js.map