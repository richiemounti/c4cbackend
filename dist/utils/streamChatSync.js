"use strict";
// utils/streamChatSync.ts
/**
 * Stream Chat User Synchronization Utilities
 *
 * These functions help keep Stream Chat users in sync with your database users.
 * Call these functions whenever users are created or updated in your system.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncUserToStreamChat = syncUserToStreamChat;
exports.bulkSyncUsersToStreamChat = bulkSyncUsersToStreamChat;
exports.checkUserExistsInStreamChat = checkUserExistsInStreamChat;
const streamChat_service_1 = require("../services/streamChat.service");
/**
 * Sync a user to Stream Chat after registration or profile update
 *
 * Usage: Call this in your user registration/update controllers
 *
 * @param user - The user document from MongoDB
 */
function syncUserToStreamChat(user) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, streamChat_service_1.upsertStreamChatUser)(user._id.toString(), {
                name: user.name,
                email: user.email,
                image: user.photo, // ✅ FIXED: Use 'photo' instead of 'profilePicture'
                role: user.primaryRole || 'user',
            });
            console.log(`✅ User synced to Stream Chat: ${user.name} (${user._id})`);
        }
        catch (error) {
            // Log error but don't fail the request
            console.error(`Failed to sync user to Stream Chat: ${user.name}`, error);
        }
    });
}
/**
 * Bulk sync users to Stream Chat
 * Useful for initial setup or migration
 *
 * Usage: Run this once to sync all existing users
 *
 * @param users - Array of user documents
 */
function bulkSyncUsersToStreamChat(users) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = {
            success: 0,
            failed: 0,
            errors: [],
        };
        console.log(`🔄 Starting bulk sync of ${users.length} users to Stream Chat...`);
        for (const user of users) {
            try {
                yield syncUserToStreamChat(user);
                results.success++;
            }
            catch (error) {
                results.failed++;
                results.errors.push({
                    userId: user._id.toString(),
                    userName: user.name,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        console.log(`✅ Bulk sync complete: ${results.success} successful, ${results.failed} failed`);
        if (results.failed > 0) {
            console.error('Failed users:', results.errors);
        }
        return results;
    });
}
/**
 * Check if a user exists in Stream Chat
 *
 * @param userId - The user's MongoDB ObjectId as string
 */
function checkUserExistsInStreamChat(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // This would require importing StreamChat client
        // Implementation depends on your needs
        // For now, we'll assume users should be synced proactively
        return false;
    });
}
/**
 * Example: How to use in your user registration controller
 *
 * ```typescript
 * import { syncUserToStreamChat } from '../utils/streamChatSync';
 *
 * export const registerUser = async (req: Request, res: Response) => {
 *   // ... create user in database
 *   const user = await User.create({ ... });
 *
 *   // ✅ Sync to Stream Chat (non-blocking)
 *   syncUserToStreamChat(user).catch(err =>
 *     console.error('Stream Chat sync failed:', err)
 *   );
 *
 *   res.status(201).json({ success: true, data: user });
 * };
 * ```
 */
/**
 * Example: How to use in your user update controller
 *
 * ```typescript
 * import { syncUserToStreamChat } from '../utils/streamChatSync';
 *
 * export const updateUserProfile = async (req: Request, res: Response) => {
 *   // ... update user in database
 *   const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
 *
 *   // ✅ Sync changes to Stream Chat (non-blocking)
 *   syncUserToStreamChat(user).catch(err =>
 *     console.error('Stream Chat sync failed:', err)
 *   );
 *
 *   res.status(200).json({ success: true, data: user });
 * };
 * ```
 */
/**
 * Example: Bulk sync script (run once for existing users)
 *
 * Create a file: scripts/syncUsersToStreamChat.ts
 *
 * ```typescript
 * import mongoose from 'mongoose';
 * import User from '../models/user.model';
 * import { bulkSyncUsersToStreamChat } from '../utils/streamChatSync';
 *
 * async function syncAllUsers() {
 *   try {
 *     await mongoose.connect(process.env.MONGODB_URI!);
 *
 *     const users = await User.find({});
 *     console.log(`Found ${users.length} users to sync`);
 *
 *     const results = await bulkSyncUsersToStreamChat(users);
 *
 *     console.log('Sync Results:', results);
 *
 *     process.exit(0);
 *   } catch (error) {
 *     console.error('Sync failed:', error);
 *     process.exit(1);
 *   }
 * }
 *
 * syncAllUsers();
 * ```
 *
 * Run with: `npx ts-node scripts/syncUsersToStreamChat.ts`
 */
exports.default = {
    syncUserToStreamChat,
    bulkSyncUsersToStreamChat,
    checkUserExistsInStreamChat,
};
//# sourceMappingURL=streamChatSync.js.map