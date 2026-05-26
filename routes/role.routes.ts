import { Router } from "express";
import {
  assignRole,
  removeRole,
  setPrimaryRole,
  getUserRoles,
  cleanupStaleRoles, 
  cleanupAllStaleRoles
} from "../controllers/role.controller";

import authorize from "../middlewares/auth.middleware";
import { hasPermission, isConnectGoStaff } from "../middlewares/role.middleware";

const userRoleRouter = Router({ mergeParams: true });

// Get user roles
userRoleRouter.get('/', authorize, getUserRoles);

// Assign role to user
userRoleRouter.post('/', 
  authorize, 
  hasPermission(['manage_users', 'assign_roles']), 
  assignRole
);

// Remove role from user
userRoleRouter.delete('/:roleId', 
  authorize, 
  hasPermission(['manage_users', 'assign_roles']), 
  removeRole
);

// Set primary role
userRoleRouter.put('/primary', 
  authorize, 
  setPrimaryRole
);

userRoleRouter.post('/cleanup-all', authorize, isConnectGoStaff(), cleanupAllStaleRoles);
userRoleRouter.post('/:id/roles/cleanup', authorize, isConnectGoStaff(), cleanupStaleRoles);

export default userRoleRouter;