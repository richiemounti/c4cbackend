"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/category.routes.ts
const express_1 = require("express");
const category_controller_1 = require("../controllers/category.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const categoryRouter = (0, express_1.Router)();
// Public routes
categoryRouter.get('/', category_controller_1.getCategories);
categoryRouter.get('/:id', category_controller_1.getCategory);
// categoryRouter.get('/:id/themes', getCategoryThemes);
// ConnectGo staff only routes
categoryRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), category_controller_1.createCategory);
categoryRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), category_controller_1.updateCategory);
categoryRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), category_controller_1.archiveCategory);
categoryRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), category_controller_1.restoreCategory);
categoryRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), category_controller_1.deleteCategory);
exports.default = categoryRouter;
//# sourceMappingURL=category.routes.js.map