"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateUser = exports.validateAcceptInvitation = exports.validateInviteUser = void 0;
const express_validator_1 = require("express-validator");
// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.data = errors.array();
        throw error;
    }
    next();
};
// Define invitable client roles (matching user.model.ts)
// Note: 'manager' is excluded because it's typically assigned differently
// ConnectGo roles are also excluded as they're internal staff
const INVITABLE_ROLES = [
    'projectCreator',
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
];
const PERMISSION_FLAG_KEYS = [
    'submitData',
    'useDataCollector',
    'viewRiskRegister',
    'generateReports',
    'learnAndTell',
    'inviteUsers',
];
// Invite User validation
exports.validateInviteUser = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    (0, express_validator_1.body)('role')
        .isIn(INVITABLE_ROLES)
        .withMessage(`Invalid role. Must be one of: ${INVITABLE_ROLES.join(', ')}`),
    (0, express_validator_1.body)('organizationId')
        .isMongoId()
        .withMessage('Invalid organization ID format'),
    (0, express_validator_1.body)('projectIds')
        .optional()
        .isArray()
        .withMessage('Project IDs must be an array'),
    (0, express_validator_1.body)('projectIds.*')
        .optional()
        .isMongoId()
        .withMessage('Each project ID must be a valid MongoDB ID'),
    (0, express_validator_1.body)('isOrgAdmin')
        .optional()
        .isBoolean()
        .withMessage('isOrgAdmin must be a boolean'),
    (0, express_validator_1.body)('permissions')
        .optional()
        .isObject()
        .withMessage('permissions must be an object'),
    ...PERMISSION_FLAG_KEYS.map((key) => (0, express_validator_1.body)(`permissions.${key}`)
        .optional()
        .isBoolean()
        .withMessage(`permissions.${key} must be a boolean`)),
    handleValidationErrors
];
// Accept Invitation validation
exports.validateAcceptInvitation = [
    (0, express_validator_1.body)('token')
        .notEmpty()
        .withMessage('Invitation token is required')
        .isLength({ min: 10 })
        .withMessage('Invalid token format'),
    (0, express_validator_1.body)('userName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Username must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
    (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    handleValidationErrors
];
// Update User Profile validation
exports.validateUpdateUser = [
    (0, express_validator_1.body)('userName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Username must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
    (0, express_validator_1.body)('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    (0, express_validator_1.body)('photo')
        .optional()
        .isURL()
        .withMessage('Photo must be a valid URL'),
    handleValidationErrors
];
exports.default = {
    validateInviteUser: exports.validateInviteUser,
    validateAcceptInvitation: exports.validateAcceptInvitation,
    validateUpdateUser: exports.validateUpdateUser
};
//# sourceMappingURL=invitation.validation.middleware.js.map