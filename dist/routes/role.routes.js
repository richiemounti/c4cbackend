"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const role_controller_1 = require("../controllers/role.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const userRoleRouter = (0, express_1.Router)({ mergeParams: true });
// Get user roles
userRoleRouter.get('/', auth_middleware_1.default, role_controller_1.getUserRoles);
// Assign role to user
userRoleRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['manage_users', 'assign_roles']), role_controller_1.assignRole);
// Remove role from user
userRoleRouter.delete('/:roleId', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['manage_users', 'assign_roles']), role_controller_1.removeRole);
// Set primary role
userRoleRouter.put('/primary', auth_middleware_1.default, role_controller_1.setPrimaryRole);
userRoleRouter.post('/cleanup-all', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), role_controller_1.cleanupAllStaleRoles);
userRoleRouter.post('/:id/roles/cleanup', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), role_controller_1.cleanupStaleRoles);
exports.default = userRoleRouter;
//# sourceMappingURL=role.routes.js.map