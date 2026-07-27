"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userHasProjectAccess = userHasProjectAccess;
exports.isCreatorOrHasAccess = isCreatorOrHasAccess;
exports.isUserAuthenticated = isUserAuthenticated;
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Helper function to check if a user has access to a project
 */
function userHasProjectAccess(req, projectId) {
    // If no user, return false
    if (!req.user)
        return false;
    try {
        // Type assertion with our explicit interface
        const user = req.user;
        // If user is ConnectGo staff, grant access
        if (user.isConnectGoStaff)
            return true;
        // Convert string to ObjectId if needed
        const projectObjectId = typeof projectId === 'string'
            ? new mongoose_1.default.Types.ObjectId(projectId)
            : projectId;
        return user.hasProjectAccess(projectObjectId);
    }
    catch (error) {
        console.error('Error checking project access:', error);
        return false;
    }
}
/**
 * Helper function to check if a user is the creator or has project access
 */
function isCreatorOrHasAccess(req, creatorId, projectId) {
    if (!req.user)
        return false;
    try {
        // Type assertion with our explicit interface
        const user = req.user;
        // Convert IDs to strings for comparison
        const creatorIdStr = creatorId.toString();
        const userIdStr = user._id.toString();
        const isCreator = userIdStr === creatorIdStr;
        const hasProjectAccess = userHasProjectAccess(req, projectId);
        const isConnectGoStaff = user.isConnectGoStaff;
        return isCreator || hasProjectAccess || isConnectGoStaff;
    }
    catch (error) {
        console.error('Error checking creator/access:', error);
        return false;
    }
}
/**
 * Type guard to check if a user is authenticated
 */
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
//# sourceMappingURL=authHelpers.js.map