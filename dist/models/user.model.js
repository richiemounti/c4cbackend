"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.ROLE_PRESETS = exports.DEFAULT_PERMISSIONS = void 0;
exports.resolveRoleGrant = resolveRoleGrant;
// models/user.model.ts - UPDATED WITH NEW ROLES
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Define a schema for ConnectGo roles (Internal System Administrators & Support)
const connectGoRolesEnum = ['owner', 'admin', 'accountManager', 'analyst'];
// Define a schema for client roles (Project-Level Roles)
const clientRolesEnum = [
    'manager',
    'projectCreator',
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
];
// Roles that require organization (all client roles except manager)
const rolesRequiringOrg = [
    'projectCreator',
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
];
exports.DEFAULT_PERMISSIONS = {
    submitData: false,
    useDataCollector: false,
    viewRiskRegister: false,
    generateReports: false,
    learnAndTell: false,
    inviteUsers: false,
};
// Maps the subset of legacy permission strings that correspond to the 6 flags
// above. Only these strings are flag-checkable — everything else stays governed
// by the existing role-based permission map.
const CLIENT_PERMISSION_FLAG_MAP = {
    submit_data: 'submitData',
    data_collector: 'useDataCollector',
    risk_register: 'viewRiskRegister',
    report: 'generateReports',
    learn_and_tell: 'learnAndTell',
    invite_users: 'inviteUsers',
    assign_roles: 'inviteUsers',
};
// Default isOrgAdmin/permissions bundle per client role. Used as a fallback at
// invite/role-assignment time whenever explicit overrides aren't provided.
exports.ROLE_PRESETS = {
    manager: {
        isOrgAdmin: true,
        permissions: { submitData: true, useDataCollector: true, viewRiskRegister: true, generateReports: true, learnAndTell: true, inviteUsers: true },
    },
    projectCreator: {
        isOrgAdmin: false,
        permissions: Object.assign(Object.assign({}, exports.DEFAULT_PERMISSIONS), { submitData: true, viewRiskRegister: true, generateReports: true, learnAndTell: true }),
    },
    leadership: {
        isOrgAdmin: false,
        permissions: Object.assign(Object.assign({}, exports.DEFAULT_PERMISSIONS), { viewRiskRegister: true, generateReports: true, learnAndTell: true }),
    },
    hq: {
        isOrgAdmin: false,
        permissions: Object.assign(Object.assign({}, exports.DEFAULT_PERMISSIONS), { viewRiskRegister: true, generateReports: true, learnAndTell: true }),
    },
    communications: {
        isOrgAdmin: false,
        permissions: Object.assign(Object.assign({}, exports.DEFAULT_PERMISSIONS), { generateReports: true, learnAndTell: true }),
    },
    fieldStaff: {
        isOrgAdmin: false,
        permissions: Object.assign(Object.assign({}, exports.DEFAULT_PERMISSIONS), { submitData: true, viewRiskRegister: true }),
    },
    fieldAgent: {
        isOrgAdmin: false,
        permissions: Object.assign(Object.assign({}, exports.DEFAULT_PERMISSIONS), { submitData: true, useDataCollector: true }),
    },
};
// Resolves the isOrgAdmin/permissions to store on a role entry at invite or
// role-assignment time: explicit overrides win, falling back to that role's preset.
function resolveRoleGrant(role, overrides) {
    var _a, _b, _c;
    const preset = (_a = exports.ROLE_PRESETS[role]) !== null && _a !== void 0 ? _a : { isOrgAdmin: false, permissions: Object.assign({}, exports.DEFAULT_PERMISSIONS) };
    return {
        isOrgAdmin: (_b = overrides === null || overrides === void 0 ? void 0 : overrides.isOrgAdmin) !== null && _b !== void 0 ? _b : preset.isOrgAdmin,
        permissions: Object.assign(Object.assign({}, preset.permissions), ((_c = overrides === null || overrides === void 0 ? void 0 : overrides.permissions) !== null && _c !== void 0 ? _c : {})),
    };
}
// Define the role schema
const roleSchema = new mongoose_1.Schema({
    role: {
        type: String,
        enum: [...connectGoRolesEnum, ...clientRolesEnum],
        required: true
    },
    // If the role is client-based (except manager), this field is required
    organization: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        required: function () {
            return rolesRequiringOrg.includes(this.role);
        }
    },
    // For project-specific roles
    projects: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Project'
        }],
    // Org-admin bypass: grants every permission scoped to this role's organization.
    isOrgAdmin: {
        type: Boolean,
        default: false
    },
    // Option B: explicit permission-flag grants toggled at invitation time.
    // These augment (not replace) the role-based permissions above.
    permissions: {
        type: {
            submitData: { type: Boolean, default: false },
            useDataCollector: { type: Boolean, default: false },
            viewRiskRegister: { type: Boolean, default: false },
            generateReports: { type: Boolean, default: false },
            learnAndTell: { type: Boolean, default: false },
            inviteUsers: { type: Boolean, default: false },
        },
        default: () => (Object.assign({}, exports.DEFAULT_PERMISSIONS))
    }
});
const userSchema = new mongoose_1.Schema({
    userName: {
        type: String,
        required: [true, 'Username is required'],
        trim: true,
        minLength: 2,
        maxLength: 50,
    },
    name: {
        type: String,
        required: function () {
            return !this.isTemporaryUser;
        },
        trim: true,
        validate: {
            validator: function (value) {
                if (this.isTemporaryUser)
                    return true;
                return value.length >= 2 && value.length <= 50;
            },
            message: 'Name must be between 2 and 50 characters'
        },
        default: ''
    },
    email: {
        type: String,
        required: [true, 'User Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: function () {
            return !this.isTemporaryUser;
        },
        minLength: [8, 'Password must be at least 8 characters'],
        validate: {
            validator: function (value) {
                if (this.isTemporaryUser || !value)
                    return true;
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(value);
            },
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        }
    },
    photo: {
        type: String,
        default: null
    },
    // Primary role (highest precedence role)
    primaryRole: {
        type: String,
        enum: [...connectGoRolesEnum, ...clientRolesEnum],
        default: 'manager'
    },
    // Array of roles with associated organizations/projects
    roles: [roleSchema],
    isConnectGoStaff: {
        type: Boolean,
        default: false
    },
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    },
    // Password reset fields
    resetPasswordToken: {
        type: String,
        default: undefined,
        select: false
    },
    resetPasswordExpires: {
        type: Date,
        default: undefined,
        select: false
    },
    // Invitation fields
    invitationToken: {
        type: String,
        default: undefined,
        select: false
    },
    invitationExpires: {
        type: Date,
        default: undefined,
        select: false
    },
    invitedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    invitedToOrganization: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        default: null
    },
    invitedToProjects: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Project'
        }],
    invitedRole: {
        type: String,
        enum: [...connectGoRolesEnum, ...clientRolesEnum],
        default: null
    },
    invitationAccepted: {
        type: Boolean,
        default: false
    },
    invitationAcceptedAt: {
        type: Date,
        default: null
    },
    isTemporaryUser: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
// Middleware to ensure primaryRole is also in roles array
userSchema.pre('save', function (next) {
    if (!this.roles || this.roles.length === 0) {
        if (connectGoRolesEnum.includes(this.primaryRole)) {
            this.isConnectGoStaff = true;
            const newRole = { role: this.primaryRole };
            if (!this.roles) {
                this.set('roles', []);
            }
            this.roles.push(newRole);
        }
    }
    if (this.roles.length > 0 && !this.roles.some((r) => r.role === this.primaryRole)) {
        this.primaryRole = this.roles[0].role;
    }
    next();
});
// Add a method to check if the provided password is valid
userSchema.methods.isPasswordValid = function (password) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcryptjs_1.default.compare(password, this.password);
    });
};
// Add method to check user permissions based on role
userSchema.methods.hasPermission = function (permission, organizationId) {
    var _a;
    // Define permissions based on roles
    const permissions = {
        // ==================== ConnectGo Roles ====================
        owner: [
            'manage_all', 'billing_access', 'create_clients', 'system_settings',
            'export_all_reports', 'manage_users', 'delete_data', 'review_management'
        ],
        admin: [
            'create_clients', 'manage_users', 'system_settings', 'review_logs',
            'export_system_reports', 'create_projects', 'manage_all', 'review_management'
        ],
        accountManager: [
            'manage_client_users', 'export_client_reports', 'oversee_projects',
            'communicate_with_client', 'assign_roles', 'review_management', 'manage_all'
        ],
        analyst: [
            'visualize_results', 'backend_data_entry', 'review_management', 'assign_roles'
        ],
        // ==================== Client Roles ====================
        manager: [
            'manage_org_projects', 'approve_submissions', 'assign_roles',
            'export_org_reports', 'create_organization', 'invite_users', 'review_management',
            'manage_billing'
        ],
        projectCreator: [
            'create_projects', 'configure_projects', 'export_project_reports', 'review_management'
        ],
        leadership: [
            'visualize_results', 'build_surveys', 'report', 'risk_register',
            'learn_and_tell', 'review_submissions', 'review_management'
        ],
        hq: [
            'visualize_results', 'build_surveys', 'report', 'risk_register',
            'learn_and_tell', 'review_submissions', 'approve_reject_data', 'review_management'
        ],
        communications: [
            'visualize_results', 'build_surveys', 'report', 'risk_register',
            'learn_and_tell', 'review_submissions'
        ],
        fieldStaff: [
            'review_submissions', 'stakeholder_mapping', 'project_site_setup',
            'theory_of_change', 'review_management'
        ],
        fieldAgent: [
            'view_assignments', 'submit_data'
        ]
    };
    // 1. Check role-based permissions (existing system — untouched). This governs
    //    everything outside the 6 user-toggleable flags (project/stakeholder/site
    //    setup, reviews, billing, org creation, etc.) and must keep working exactly
    //    as before for every role, including non-managers like projectCreator/fieldStaff.
    const hasRolePermission = ((_a = permissions[this.primaryRole]) === null || _a === void 0 ? void 0 : _a.includes(permission)) || false;
    if (hasRolePermission)
        return true;
    const rolesToCheck = organizationId
        ? this.roles.filter((r) => r.organization && r.organization.toString() === organizationId.toString())
        : this.roles;
    // 2. Org-admin bypass: a role entry marked isOrgAdmin grants every permission
    //    within that entry's scope, regardless of which permission string is asked for.
    if (rolesToCheck.some((r) => r.isOrgAdmin))
        return true;
    // 3. Option B: explicit permission-flag grants toggled at invitation/edit time.
    //    Only the 6 client-facing flags are checkable this way.
    const flagKey = CLIENT_PERMISSION_FLAG_MAP[permission];
    if (flagKey) {
        return rolesToCheck.some((r) => { var _a; return ((_a = r.permissions) === null || _a === void 0 ? void 0 : _a[flagKey]) === true; });
    }
    return false;
};
// Add method to check if a user is an org-admin for a specific organization
userSchema.methods.isOrgAdminOf = function (organizationId) {
    if (this.isConnectGoStaff)
        return true;
    const orgIdStr = organizationId.toString();
    return this.roles.some((r) => { var _a; return ((_a = r.organization) === null || _a === void 0 ? void 0 : _a.toString()) === orgIdStr && r.isOrgAdmin === true; });
};
// Add method to check if user has project access
userSchema.methods.hasProjectAccess = function (projectId, organizationId) {
    // System-wide roles (ConnectGo staff) have access to all projects
    if (this.isConnectGoStaff) {
        return true;
    }
    // Convert projectId to string for comparison if needed
    const projectIdStr = typeof projectId === 'string' ? projectId : projectId.toString();
    const orgIdStr = organizationId === null || organizationId === void 0 ? void 0 : organizationId.toString();
    // For client roles, check project access in roles array
    for (const roleInfo of this.roles) {
        if (orgIdStr && roleInfo.organization && roleInfo.organization.toString() !== orgIdStr) {
            continue;
        }
        // Org-admins (default: manager) have access to all of their organization's projects.
        // Callers that don't pass organizationId keep the prior (coarser) behaviour of
        // granting access based on isOrgAdmin alone; the controller should still verify
        // projectId belongs to the expected organization where that matters.
        if (roleInfo.isOrgAdmin && roleInfo.organization) {
            return true;
        }
        // Check if project is in the allowed projects for this role
        if (roleInfo.projects &&
            roleInfo.projects.some((id) => id.toString() === projectIdStr)) {
            return true;
        }
    }
    return false;
};
// Add method to check if user has organization access
userSchema.methods.hasOrganizationAccess = function (organizationId) {
    // System-wide roles (ConnectGo staff) have access to all organizations
    if (this.isConnectGoStaff) {
        return true;
    }
    // Convert organizationId to string for comparison if needed
    const orgIdStr = typeof organizationId === 'string' ? organizationId : organizationId.toString();
    // For client roles, check organization access in roles array
    return this.roles.some((roleInfo) => roleInfo.organization && roleInfo.organization.toString() === orgIdStr);
};
// Create and export the model
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;
//# sourceMappingURL=user.model.js.map