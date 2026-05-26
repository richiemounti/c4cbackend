// utils/streamChatSync.ts
/**
 * Stream Chat User Synchronization Utilities
 * 
 * These functions help keep Stream Chat users in sync with your database users.
 * Call these functions whenever users are created or updated in your system.
 */

import { upsertStreamChatUser } from '../services/streamChat.service';
import { IUserDocument } from '../models/user.model';
import mongoose from 'mongoose';

/**
 * Sync a user to Stream Chat after registration or profile update
 * 
 * Usage: Call this in your user registration/update controllers
 * 
 * @param user - The user document from MongoDB
 */
export async function syncUserToStreamChat(user: IUserDocument): Promise<void> {
  try {
    await upsertStreamChatUser(
      (user._id as mongoose.Types.ObjectId).toString(),
      {
        name: user.name,
        email: user.email,
        image: user.photo, // ✅ FIXED: Use 'photo' instead of 'profilePicture'
        role: user.primaryRole || 'user',
      }
    );
    
    console.log(`✅ User synced to Stream Chat: ${user.name} (${user._id})`);
  } catch (error) {
    // Log error but don't fail the request
    console.error(`Failed to sync user to Stream Chat: ${user.name}`, error);
  }
}

/**
 * Bulk sync users to Stream Chat
 * Useful for initial setup or migration
 * 
 * Usage: Run this once to sync all existing users
 * 
 * @param users - Array of user documents
 */
export async function bulkSyncUsersToStreamChat(users: IUserDocument[]): Promise<{
  success: number;
  failed: number;
  errors: any[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as any[],
  };

  console.log(`🔄 Starting bulk sync of ${users.length} users to Stream Chat...`);

  for (const user of users) {
    try {
      await syncUserToStreamChat(user);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: (user._id as mongoose.Types.ObjectId).toString(),
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
}

/**
 * Check if a user exists in Stream Chat
 * 
 * @param userId - The user's MongoDB ObjectId as string
 */
export async function checkUserExistsInStreamChat(userId: string): Promise<boolean> {
  // This would require importing StreamChat client
  // Implementation depends on your needs
  // For now, we'll assume users should be synced proactively
  return false;
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

export default {
  syncUserToStreamChat,
  bulkSyncUsersToStreamChat,
  checkUserExistsInStreamChat,
};