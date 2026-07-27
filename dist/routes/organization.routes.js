"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/organization.routes.ts
const express_1 = require("express");
const organization_controller_1 = require("../controllers/organization.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const organizationRouter = (0, express_1.Router)();
// Public routes - require authentication but no specific permissions
organizationRouter.get('/', auth_middleware_1.default, organization_controller_1.getOrganizations);
// Get organizations for the currently logged-in user
organizationRouter.get('/my-organizations', auth_middleware_1.default, organization_controller_1.getMyOrganizations);
// Create organization - requires 'create_organization' permission (only managers and ConnectGo staff)
organizationRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_organization', 'manage_all']), organization_controller_1.createOrganization);
// Get organization by ID
organizationRouter.get('/:id', auth_middleware_1.default, organization_controller_1.getOrganization);
// Update organization
organizationRouter.put('/:id', auth_middleware_1.default, organization_controller_1.updateOrganization);
// Archive organization (soft delete)
organizationRouter.delete('/:id', auth_middleware_1.default, organization_controller_1.archiveOrganization);
// Restore archived organization
organizationRouter.post('/:id/restore', auth_middleware_1.default, organization_controller_1.restoreOrganization);
// Permanently delete organization (ConnectGo staff only)
organizationRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['delete_data']), organization_controller_1.deleteOrganization);
exports.default = organizationRouter;
//# sourceMappingURL=organization.routes.js.map