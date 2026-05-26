// middlewares/oauth.middleware.ts
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile, VerifyCallback } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Request } from 'express';
import { env } from '../config/env';
import User, { IUserDocument } from '../models/user.model';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Create a custom interface for Microsoft profile since it's not exported by the package
interface MicrosoftProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  name?: {
    familyName: string;
    givenName: string;
  };
  provider: string;
}

// Helper function to create a new user from OAuth profile
const createUserFromOAuth = async (profile: GoogleProfile | MicrosoftProfile, email: string): Promise<IUserDocument> => {
  // Generate a random password for OAuth users
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), salt);
  
  // Create username from display name
  const userName = profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
  
  // Create new user with manager role by default for OAuth users
  const newUser = new User({
    userName,
    name: profile.displayName,
    email,
    password: hashedPassword,
    // Set manager as default role for OAuth users
    primaryRole: 'manager',
    roles: [{ role: 'manager' }]
  });
  
  await newUser.save();
  return newUser;
};

// Configure Google Strategy with proper TypeScript types
passport.use(new GoogleStrategy({
  clientID: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${env.API_BASE_URL}/auth/google/callback`,
  passReqToCallback: true
}, async (
  req: Request, 
  accessToken: string, 
  refreshToken: string, 
  profile: GoogleProfile, 
  done: VerifyCallback
) => {
  try {
    // Get email from profile
    const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
    
    if (!email) {
      return done(new Error('No email found in Google profile'));
    }

    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      // User exists, return user
      return done(null, user);
    } else {
      // Create new user with manager role
      const newUser = await createUserFromOAuth(profile, email);
      return done(null, newUser);
    }
  } catch (error) {
    return done(error as Error);
  }
}));

// Configure Microsoft Strategy with proper TypeScript types
passport.use(new MicrosoftStrategy({
  clientID: env.MICROSOFT_CLIENT_ID,
  clientSecret: env.MICROSOFT_CLIENT_SECRET,
  callbackURL: `${env.API_BASE_URL}/auth/microsoft/callback`,
  scope: ['user.read'],
  tenant: 'common',
  passReqToCallback: true
}, async (
  req: Request, 
  accessToken: string, 
  refreshToken: string, 
  profile: MicrosoftProfile, // Use our custom interface
  done: (error: Error | null, user?: IUserDocument) => void
) => {
  try {
    // Get email from profile
    const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
    
    if (!email) {
      return done(new Error('No email found in Microsoft profile'));
    }

    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      // User exists, return user
      return done(null, user);
    } else {
      // Create new user with manager role
      const newUser = await createUserFromOAuth(profile, email);
      return done(null, newUser);
    }
  } catch (error) {
    return done(error as Error);
  }
}));

// Extend the Express Request interface to include the user property
declare global {
  namespace Express {
    interface User extends IUserDocument {}
  }
}

// Serialize and Deserialize User with proper TypeScript types
passport.serializeUser((user: Express.User, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      return done(new Error('User not found'));
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;