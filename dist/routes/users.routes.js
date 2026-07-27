"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const invitation_validation_middleware_1 = require("../middlewares/invitation.validation.middleware");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const role_routes_1 = __importDefault(require("./role.routes"));
const userRouter = (0, express_1.Router)();
// Public routes (no authentication)
userRouter.get('/verify-invitation/:token', user_controller_1.verifyInvitation);
userRouter.post('/accept-invitation', invitation_validation_middleware_1.validateAcceptInvitation, user_controller_1.acceptInvitation);
// Protected routes (authentication required)
userRouter.use(auth_middleware_1.default); // Apply to all routes below
// Invitation management (Manager only)
userRouter.post('/invite', (0, role_middleware_1.hasPermission)(['manage_users', 'manage_client_users', 'invite_users']), invitation_validation_middleware_1.validateInviteUser, user_controller_1.inviteUser);
userRouter.get('/organization/:organizationId', user_controller_1.getOrganizationUsers);
userRouter.delete('/invitation/:userId', (0, role_middleware_1.hasPermission)(['manage_users', 'manage_client_users']), user_controller_1.revokeInvitation);
userRouter.post('/resend-invitation/:userId', (0, role_middleware_1.hasPermission)(['manage_users', 'manage_client_users']), user_controller_1.resendInvitation);
// User management
userRouter.get('/', (0, role_middleware_1.hasPermission)(['manage_users', 'manage_client_users']), user_controller_1.getUsers);
userRouter.get('/:id', user_controller_1.getUser);
userRouter.put('/:id', invitation_validation_middleware_1.validateUpdateUser, user_controller_1.updateUser);
userRouter.put('/:userId/permissions', user_controller_1.updateUserPermissions);
userRouter.delete('/:id', (0, role_middleware_1.hasPermission)(['manage_users', 'manage_client_users']), user_controller_1.archiveUser);
// Mount the role management routes as sub-routes
userRouter.use('/:id/roles', role_routes_1.default);
exports.default = userRouter;
//# sourceMappingURL=users.routes.js.map