// models/user.model.ts - UPDATED WITH NEW ROLES
import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from 'bcryptjs';

// Define a schema for ConnectGo roles (Internal System Administrators & Support)
const connectGoRolesEnum = ['owner', 'admin', 'accountManager', 'analyst'] as const;
type ConnectGoRole = typeof connectGoRolesEnum[number];

// Define a schema for client roles (Project-Level Roles)
const clientRolesEnum = [
    'manager', 
    'projectCreator', 
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
] as const;
type ClientRole = typeof clientRolesEnum[number];

// Roles that require organization (all client roles except manager)
const rolesRequiringOrg = [
    'projectCreator', 
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
];

// Define interface for role
interface IRole {
  role: string;
  organization?: mongoose.Types.ObjectId;
  projects?: mongoose.Types.ObjectId[];
}

// Define interface for User document
export interface IUserDocument extends Document {
  userName: string;
  name: string;
  email: string;
  password: string;
  photo?: string;
  primaryRole: string;
  roles: IRole[];
  isConnectGoStaff: boolean;
  archived: boolean;
  archivedAt?: Date;
  
  // Password reset fields
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  
  // Invitation fields
  invitationToken?: string;
  invitationExpires?: Date;
  invitedBy?: mongoose.Types.ObjectId;
  invitedToOrganization?: mongoose.Types.ObjectId;
  invitedToProjects?: mongoose.Types.ObjectId[];
  invitedRole?: string;
  invitationAccepted?: boolean;
  invitationAcceptedAt?: Date;
  isTemporaryUser?: boolean;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Method signatures
  isPasswordValid(password: string): Promise<boolean>;
  hasPermission(permission: string): boolean;
  hasProjectAccess(projectId: mongoose.Types.ObjectId | string): boolean;
  hasOrganizationAccess(organizationId: mongoose.Types.ObjectId | string): boolean;
}

// Define model interface with static methods (if any)
export interface IUserModel extends Model<IUserDocument> {
  // Add any static methods here
}

// Define the role schema
const roleSchema = new Schema<IRole>({
  role: {
    type: String,
    enum: [...connectGoRolesEnum, ...clientRolesEnum],
    required: true
  },
  // If the role is client-based (except manager), this field is required
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: function(this: IRole) {
      return rolesRequiringOrg.includes(this.role);
    }
  },
  // For project-specific roles
  projects: [{
    type: Schema.Types.ObjectId,
    ref: 'Project'
  }]
});

const userSchema = new Schema<IUserDocument>({
    userName: {
        type: String,
        required: [true, 'Username is required'],
        trim: true,
        minLength: 2,
        maxLength: 50,
    },
    name: {
        type: String,
        required: function(this: IUserDocument) {
            return !this.isTemporaryUser;
        },
        trim: true,
        validate: {
            validator: function(this: IUserDocument, value: string): boolean {
                if (this.isTemporaryUser) return true;
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
        required: function(this: IUserDocument) {
            return !this.isTemporaryUser;
        },
        minLength: [8, 'Password must be at least 8 characters'],
        validate: {
            validator: function(value: string): boolean {
                if (this.isTemporaryUser || !value) return true;
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
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    invitedToOrganization: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        default: null
    },
    invitedToProjects: [{
        type: Schema.Types.ObjectId,
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
}, {timestamps: true});

// Middleware to ensure primaryRole is also in roles array
userSchema.pre('save', function(this: IUserDocument, next) {
    if (!this.roles || this.roles.length === 0) {
        if (connectGoRolesEnum.includes(this.primaryRole as ConnectGoRole)) {
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
userSchema.methods.isPasswordValid = async function(this: IUserDocument, password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password);
};

// Add method to check user permissions based on role
userSchema.methods.hasPermission = function(this: IUserDocument, permission: string): boolean {
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
            'export_org_reports', 'create_organization', 'invite_users', 'review_management'
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

    // Check if the user's primary role has the requested permission
    return permissions[this.primaryRole as keyof typeof permissions]?.includes(permission) || false;
};

// Add method to check if user has project access
userSchema.methods.hasProjectAccess = function(this: IUserDocument, projectId: mongoose.Types.ObjectId | string): boolean {
    // System-wide roles (ConnectGo staff) have access to all projects
    if (this.isConnectGoStaff) {
        return true;
    }

    // Convert projectId to string for comparison if needed
    const projectIdStr = typeof projectId === 'string' ? projectId : projectId.toString();

    // For client roles, check project access in roles array
    for (const roleInfo of this.roles) {
        // Organization managers have access to all organization projects
        if (roleInfo.role === 'manager' && roleInfo.organization) {
            // The controller will need to ensure projectId belongs to this organization
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
userSchema.methods.hasOrganizationAccess = function(this: IUserDocument, organizationId: mongoose.Types.ObjectId | string): boolean {
    // System-wide roles (ConnectGo staff) have access to all organizations
    if (this.isConnectGoStaff) {
        return true;
    }

    // Convert organizationId to string for comparison if needed
    const orgIdStr = typeof organizationId === 'string' ? organizationId : organizationId.toString();

    // For client roles, check organization access in roles array
    return this.roles.some((roleInfo) => 
        roleInfo.organization && roleInfo.organization.toString() === orgIdStr
    );
};

// Create and export the model
const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);

export default User;