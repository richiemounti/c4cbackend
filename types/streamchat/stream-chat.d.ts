// types/stream-chat.d.ts
/**
 * Stream Chat TypeScript Type Augmentation
 * 
 * This file extends Stream Chat's base types to include custom fields
 * that we use in the Youth Impact platform for users, channels, and messages.
 * 
 * Place this file in your `types/` directory or at the root of your `src/` folder.
 * TypeScript will automatically pick it up during compilation.
 * 
 * Documentation: https://getstream.io/chat/docs/sdk/react-native/customization/typescript/
 */

import 'stream-chat';

declare module 'stream-chat' {
  /**
   * Custom User Data
   * 
   * Extends the default Stream Chat user with additional fields
   * used in the Youth Impact platform.
   */
  interface CustomUserData {
    // Standard user fields
    name?: string;       // User's display name
    email?: string;      // User's email address
    image?: string;      // Profile picture URL
    role?: string;       // User role (e.g., 'admin', 'user', 'staff')
    
    // You can add more custom fields here as needed:
    // profilePicture?: string;
    // organization?: string;
    // department?: string;
  }

  /**
   * Custom Channel Data
   * 
   * Extends the default Stream Chat channel with additional fields
   * used for review channels.
   */
  interface CustomChannelData {
    // Standard channel fields
    name?: string;           // Channel display name
    image?: string;          // Channel image/icon URL
    
    // Review-specific fields
    review_id?: string;      // Associated review MongoDB ObjectId
    created_at?: string;     // ISO timestamp of channel creation
    
    // You can add more custom fields here as needed:
    // project_id?: string;
    // organization_id?: string;
    // channel_type?: string;
  }

  /**
   * Custom Message Data
   * 
   * If you want to add custom fields to messages, define them here.
   */
  interface CustomMessageData {
    // Example custom message fields:
    // issue_id?: string;
    // priority?: 'low' | 'medium' | 'high';
    // mentioned_issue?: string;
  }

  /**
   * Custom Attachment Data
   * 
   * If you want to add custom fields to file attachments, define them here.
   */
  interface CustomAttachmentData {
    // Example custom attachment fields:
    // file_category?: 'evidence' | 'report' | 'screenshot';
    // uploaded_by?: string;
  }

  /**
   * Custom Reaction Data
   * 
   * If you want to add custom fields to reactions, define them here.
   */
  interface CustomReactionData {
    // Allow any custom properties on reactions
    [key: string]: unknown;
  }

  /**
   * Custom Command Data
   * 
   * If you want to add custom slash commands, define them here.
   */
  interface CustomCommandData {
    // Example: 'giphy' | 'flag' | 'unflag' | 'mute' | 'unmute'
  }

  /**
   * Custom Event Data
   * 
   * If you want to add custom fields to events, define them here.
   */
  interface CustomEventData {
    // Example custom event fields:
    // review_escalated?: boolean;
    // staff_added?: boolean;
  }
}

/**
 * USAGE NOTES:
 * 
 * After creating this file, TypeScript will automatically recognize these custom fields
 * throughout your application. You no longer need to use 'as any' casts.
 * 
 * Example - Creating a user:
 * ```typescript
 * await client.upsertUser({
 *   id: 'user-123',
 *   name: 'John Doe',        // ✅ Now recognized by TypeScript
 *   email: 'john@example.com', // ✅ Now recognized by TypeScript
 *   image: 'https://...',      // ✅ Now recognized by TypeScript
 * });
 * ```
 * 
 * Example - Creating a channel:
 * ```typescript
 * const channel = client.channel('messaging', 'review-123', {
 *   name: 'Review Discussion',     // ✅ Now recognized by TypeScript
 *   review_id: 'review-mongo-id',  // ✅ Now recognized by TypeScript
 *   members: ['user-1', 'user-2'],
 * });
 * ```
 * 
 * Example - Accessing custom data:
 * ```typescript
 * const channel = client.channel('messaging', 'review-123');
 * await channel.watch();
 * 
 * // Access custom channel data
 * console.log(channel.data?.name);       // ✅ TypeScript knows this exists
 * console.log(channel.data?.review_id);  // ✅ TypeScript knows this exists
 * ```
 */

/**
 * IMPORTANT NOTES:
 * 
 * 1. Module augmentation merges with existing types - it doesn't replace them
 * 2. All custom interfaces should be optional (use `?:` instead of `:`)
 * 3. This file should have NO imports except the 'stream-chat' module declaration
 * 4. Place this file where TypeScript can find it (usually `types/` or `src/`)
 * 5. Make sure this file is included in your `tsconfig.json` if needed
 * 
 * If TypeScript still doesn't recognize the file:
 * - Check your tsconfig.json includes this directory
 * - Try restarting your TypeScript server (VS Code: Cmd+Shift+P -> "Restart TS Server")
 * - Ensure the file has the `.d.ts` extension
 */