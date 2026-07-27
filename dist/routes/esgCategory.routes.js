"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/esgCategory.routes.ts
const express_1 = require("express");
const esgCategory_controller_1 = require("../controllers/esgCategory.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const esgCategoryRouter = (0, express_1.Router)();
// Public routes
esgCategoryRouter.get('/', esgCategory_controller_1.getESGCategories);
esgCategoryRouter.get('/:id', esgCategory_controller_1.getESGCategory);
// ConnectGo staff only routes
esgCategoryRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), esgCategory_controller_1.createESGCategory);
esgCategoryRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), esgCategory_controller_1.updateESGCategory);
esgCategoryRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), esgCategory_controller_1.archiveESGCategory);
esgCategoryRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), esgCategory_controller_1.restoreESGCategory);
exports.default = esgCategoryRouter;
//# sourceMappingURL=esgCategory.routes.js.map