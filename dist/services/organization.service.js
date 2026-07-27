"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserOrganizations = exports.createOrganizationForManager = void 0;
const organization_model_1 = __importDefault(require("../models/organization.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
/**
 * Create a new organization for a manager
 */
const createOrganizationForManager = (userId, organizationData, session) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the user
        const user = yield user_model_1.default.findById(userId).session(session || null);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user is a manager
        if (user.primaryRole !== 'manager') {
            const error = new Error('Only managers can create organizations');
            error.statusCode = 403;
            throw error;
        }
        // Create the organization
        const creationOptions = session ? { session } : {};
        const organizations = yield organization_model_1.default.create([Object.assign(Object.assign({}, organizationData), { creator: userId })], creationOptions);
        const organization = organizations[0];
        // Update the user's role to include the organization
        const managerRoleIndex = user.roles.findIndex((r) => r.role === 'manager');
        if (managerRoleIndex !== -1) {
            // Update existing manager role
            user.roles[managerRoleIndex].organization = organization._id;
        }
        else {
            // Add manager role with organization
            user.roles.push({
                role: 'manager',
                organization: organization._id
            });
        }
        // Save the user
        yield user.save(session ? { session } : {});
        return organization;
    }
    catch (error) {
        throw error;
    }
});
exports.createOrganizationForManager = createOrganizationForManager;
/**
 * Get all organizations accessible by a user
 */
const getUserOrganizations = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the user
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        // For ConnectGo staff, return all organizations
        if (user.isConnectGoStaff) {
            return organization_model_1.default.find({ archived: { $ne: true } });
        }
        // Get organization IDs from user roles
        const organizationIds = user.roles
            .filter((r) => r.organization)
            .map((r) => r.organization);
        // Return organizations that match these IDs
        return organization_model_1.default.find({
            _id: { $in: organizationIds },
            archived: { $ne: true }
        });
    }
    catch (error) {
        throw error;
    }
});
exports.getUserOrganizations = getUserOrganizations;
//# sourceMappingURL=organization.service.js.map