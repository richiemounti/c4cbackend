import { Router } from "express";
import { 
  getUser, 
  getUsers, 
  inviteUser, 
  verifyInvitation, 
  acceptInvitation, 
  getOrganizationUsers, 
  revokeInvitation, 
  resendInvitation, 
  updateUser, 
  archiveUser 
} from "../controllers/user.controller";
import { 
  validateInviteUser, 
  validateAcceptInvitation, 
  validateUpdateUser 
} from "../middlewares/invitation.validation.middleware";
import authorize from "../middlewares/auth.middleware";
import { hasPermission } from "../middlewares/role.middleware";
import userRoleRouter from "./role.routes";

const userRouter = Router();

// Public routes (no authentication)
userRouter.get('/verify-invitation/:token', verifyInvitation);
userRouter.post('/accept-invitation', validateAcceptInvitation, acceptInvitation);

// Protected routes (authentication required)
userRouter.use(authorize); // Apply to all routes below

// Invitation management (Manager only)
userRouter.post('/invite', hasPermission(['manage_users', 'manage_client_users', 'invite_users']), validateInviteUser, inviteUser);
userRouter.get('/organization/:organizationId', getOrganizationUsers);
userRouter.delete('/invitation/:userId', hasPermission(['manage_users', 'manage_client_users']), revokeInvitation);
userRouter.post('/resend-invitation/:userId', hasPermission(['manage_users', 'manage_client_users']), resendInvitation);


// User management
userRouter.get('/', hasPermission(['manage_users', 'manage_client_users']), getUsers);
userRouter.get('/:id', getUser);
userRouter.put('/:id', validateUpdateUser, updateUser);
userRouter.delete('/:id', hasPermission(['manage_users', 'manage_client_users']), archiveUser);

// Mount the role management routes as sub-routes
userRouter.use('/:id/roles', userRoleRouter);

export default userRouter;