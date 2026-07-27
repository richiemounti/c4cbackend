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
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = __importDefault(require("../models/user.model"));
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const fs = __importStar(require("fs"));
// Load environment variables with better path resolution
const envPaths = [
    (0, path_1.resolve)(__dirname, '../.env.development.local'),
    (0, path_1.resolve)(__dirname, '../.env.development'),
    (0, path_1.resolve)(__dirname, '../.env.local'),
    (0, path_1.resolve)(__dirname, '../.env')
];
// Try to load from the first existing file
let envLoaded = false;
for (const path of envPaths) {
    if (fs.existsSync(path)) {
        console.log(`Loading environment from ${path}`);
        (0, dotenv_1.config)({ path });
        envLoaded = true;
        break;
    }
}
if (!envLoaded) {
    console.log('No .env file found, using process.env variables');
}
const VALID_ROLES = [
    'owner', 'admin', 'accountManager', 'analyst',
    'manager', 'projectCreator', 'leadership', 'hq',
    'communications', 'fieldStaff', 'fieldAgent'
];
const VALID_CONNECTGO_ROLES = ['owner', 'admin', 'accountManager', 'analyst'];
function removeStaleRoles() {
    return __awaiter(this, void 0, void 0, function* () {
        // Debug environment variables
        console.log('Environment check:');
        console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
        const dbUri = process.env.DB_URI;
        if (!dbUri) {
            throw new Error('DB_URI environment variable is not set');
        }
        if (!dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
            throw new Error(`Invalid DB_URI format. Expected to start with "mongodb://" or "mongodb+srv://", but got: ${dbUri.substring(0, 20)}...`);
        }
        console.log('Connecting to MongoDB...');
        yield mongoose_1.default.connect(dbUri);
        console.log('Connected to MongoDB successfully\n');
        const usersWithStaleRoles = yield user_model_1.default.find({
            'roles.role': { $nin: VALID_ROLES }
        });
        if (usersWithStaleRoles.length === 0) {
            console.log('✅ No users with stale roles found. Nothing to do.');
            yield mongoose_1.default.connection.close();
            return;
        }
        console.log(`Found ${usersWithStaleRoles.length} user(s) with stale roles:\n`);
        for (const user of usersWithStaleRoles) {
            const staleRoles = user.roles
                .filter((r) => !VALID_ROLES.includes(r.role))
                .map((r) => r.role);
            console.log(`👤 ${user.email} — stale roles: [${staleRoles.join(', ')}]`);
            const before = user.roles.length;
            user.roles = user.roles.filter((r) => VALID_ROLES.includes(r.role));
            const removed = before - user.roles.length;
            // Fix primaryRole if it was one of the removed stale ones
            if (!VALID_ROLES.includes(user.primaryRole)) {
                user.primaryRole = user.roles.length > 0 ? user.roles[0].role : 'manager';
                console.log(`   ↳ primaryRole reset to: ${user.primaryRole}`);
            }
            // Fix isConnectGoStaff flag
            user.isConnectGoStaff = user.roles.some((r) => VALID_CONNECTGO_ROLES.includes(r.role));
            yield user.save();
            console.log(`   ↳ Removed ${removed} stale role(s). ✅\n`);
        }
        console.log('🎉 Done. All stale roles removed.');
        yield mongoose_1.default.connection.close();
        console.log('Database connection closed');
    });
}
// Run if called directly
if (require.main === module) {
    removeStaleRoles()
        .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=remove-stale-roles.js.map