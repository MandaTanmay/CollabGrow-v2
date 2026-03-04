/**
 * Authentication Controller
 * Handles JWT-based authentication operations
 */

const { query } = require('../services/db');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpirations,
} = require('../utils/tokenUtils');
const { success, error, unauthorized } = require('../utils/responseFormatter');
const { sanitizeString, isValidEmail } = require('../utils/validation');
const { enrichUserWithAvatar } = require('../utils/avatarGenerator');
const logger = require('../utils/logger');

/**
 * Handle user login
 * Generates access & refresh tokens, stores refresh token in DB
 */
async function login(req, res) {
  try {
    const { firebaseUid, email, fullName, username, profileImage } = req.body;

    // Validate required fields
    if (!firebaseUid || !email) {
      return error(res, 'Firebase UID and email are required', 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return error(res, 'Invalid email format', 400);
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeString(email, 255).toLowerCase();
    const sanitizedFullName = sanitizeString(fullName || email.split('@')[0], 255);
    const sanitizedUsername = sanitizeString(username || email.split('@')[0], 30);

    logger.info('Login attempt', { email: sanitizedEmail });

    // Check if user exists in database by Firebase UID
    let user = await query(
      `SELECT id, email, full_name, username, profile_image_url, firebase_uid,
              bio, university, major, location, github_username, linkedin_url, 
              portfolio_url, skills, created_at, is_active
       FROM users 
       WHERE firebase_uid = $1`,
      [firebaseUid]
    );

    // Check if account is active
    if (user.rows.length > 0 && !user.rows[0].is_active) {
      logger.security('Login attempt on inactive account', { firebaseUid, email: sanitizedEmail });
      return error(res, 'Your account has been deactivated. Please contact support.', 403);
    }

    if (!user.rows.length) {
      // Check if user exists by email (might have been created through Supabase first)
      const userByEmail = await query(
        `SELECT id, email, full_name, username, profile_image_url, firebase_uid,
                bio, university, major, location, github_username, linkedin_url, 
                portfolio_url, skills, created_at, is_active
         FROM users 
         WHERE email = $1`,
        [sanitizedEmail]
      );

      if (userByEmail.rows.length > 0) {
        // User exists but with no firebase_uid - update it
        logger.info('Updating existing user with Firebase UID', { email: sanitizedEmail });
        user = await query(
          `UPDATE users 
           SET firebase_uid = $1, 
               full_name = COALESCE($2, full_name),
               username = COALESCE($3, username),
               profile_image_url = COALESCE($4, profile_image_url),
               updated_at = NOW()
           WHERE email = $5
           RETURNING id, email, full_name, username, profile_image_url, firebase_uid,
                     bio, university, major, location, github_username, linkedin_url, 
                     portfolio_url, skills, created_at`,
          [firebaseUid, sanitizedFullName, sanitizedUsername, profileImage, sanitizedEmail]
        );
      } else {
        // Create new user if doesn't exist
        logger.info('Creating new user', { email: sanitizedEmail });
        user = await query(
          `INSERT INTO users (firebase_uid, email, full_name, username, profile_image_url, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
           RETURNING id, email, full_name, username, profile_image_url, firebase_uid,
                     bio, university, major, location, github_username, linkedin_url, 
                     portfolio_url, skills, created_at`,
          [
            firebaseUid,
            sanitizedEmail,
            sanitizedFullName,
            sanitizedUsername,
            profileImage || null,
          ]
        );
      }
    }

    const userData = user.rows[0];

    // Generate JWT tokens
    const accessToken = generateAccessToken({
      userId: userData.id,
      email: userData.email,
    });

    const { token: refreshToken, tokenId } = generateRefreshToken({
      userId: userData.id,
    });

    // Store refresh token in database
    const expirations = getTokenExpirations();
    await query(
      `INSERT INTO public.refresh_tokens (user_id, token, token_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userData.id, refreshToken, tokenId, expirations.refreshToken]
    );

    // Set secure HTTP-only cookies
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logger.info('Login successful', {
      userId: userData.id,
      email: sanitizedEmail,
    });

    // Enrich user with avatar data
    const enrichedUser = enrichUserWithAvatar(userData);

    return success(
      res,
      {
        message: 'Login successful',
        user: {
          id: enrichedUser.id,
          email: enrichedUser.email,
          firebaseUid: enrichedUser.firebase_uid,
          fullName: enrichedUser.full_name,
          username: enrichedUser.username,
          profileImage: enrichedUser.profile_image_url,
          bio: enrichedUser.bio,
          university: enrichedUser.university,
          major: enrichedUser.major,
          location: enrichedUser.location,
          github_username: enrichedUser.github_username,
          linkedin_url: enrichedUser.linkedin_url,
          portfolio_url: enrichedUser.portfolio_url,
          skills: enrichedUser.skills,
          created_at: enrichedUser.created_at,
          avatar: enrichedUser.avatar,
        },
      },
      'Login successful',
      200
    );
  } catch (err) {
    logger.error('Login error', { error: err.message, stack: err.stack });
    return error(res, 'An error occurred during login', 500);
  }
}

/**
 * Get current authenticated user
 */
async function getCurrentUser(req, res) {
  try {
    const userId = req.user.userId;

    // Fetch full user data from database
    const result = await query(
      `SELECT id, email, firebase_uid, full_name, username, profile_image_url, 
              bio, university, major, location, github_username, linkedin_url, 
              portfolio_url, skills, created_at
       FROM users 
       WHERE id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (!result.rows.length) {
      return unauthorized(res, 'User not found');
    }

    const user = result.rows[0];
    const enrichedUser = enrichUserWithAvatar(user);

    return success(
      res,
      {
        id: enrichedUser.id,
        email: enrichedUser.email,
        firebaseUid: enrichedUser.firebase_uid,
        fullName: enrichedUser.full_name,
        username: enrichedUser.username,
        profileImage: enrichedUser.profile_image_url,
        bio: enrichedUser.bio,
        university: enrichedUser.university,
        major: enrichedUser.major,
        location: enrichedUser.location,
        github_username: enrichedUser.github_username,
        linkedin_url: enrichedUser.linkedin_url,
        portfolio_url: enrichedUser.portfolio_url,
        skills: enrichedUser.skills,
        created_at: enrichedUser.created_at,
        avatar: enrichedUser.avatar,
      },
      'User data retrieved',
      200
    );
  } catch (err) {
    logger.error('Get current user error', { error: err.message });
    return error(res, 'Failed to retrieve user data', 500);
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return unauthorized(res, 'Refresh token required');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      logger.security('Invalid refresh token', { error: err.message });
      return unauthorized(res, 'Invalid or expired refresh token');
    }

    // Check if refresh token exists in database
    const tokenResult = await query(
      `SELECT user_id, expires_at, is_revoked 
       FROM public.refresh_tokens 
       WHERE token_id = $1 AND user_id = $2`,
      [decoded.tokenId, decoded.userId]
    );

    if (!tokenResult.rows.length) {
      logger.security('Refresh token not found in database', {
        userId: decoded.userId,
        tokenId: decoded.tokenId,
      });
      return unauthorized(res, 'Invalid refresh token');
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is revoked
    if (tokenData.is_revoked) {
      logger.security('Revoked refresh token used', { userId: decoded.userId });
      return unauthorized(res, 'Refresh token has been revoked');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      logger.debug('Expired refresh token', { userId: decoded.userId });
      return unauthorized(res, 'Refresh token expired');
    }

    // Get user data
    const userResult = await query(
      'SELECT id, email, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!userResult.rows.length || !userResult.rows[0].is_active) {
      return unauthorized(res, 'User not found or inactive');
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    // Set new access token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    logger.info('Access token refreshed', { userId: user.id });

    return success(res, { message: 'Token refreshed successfully' }, 'Token refreshed', 200);
  } catch (err) {
    logger.error('Refresh token error', { error: err.message });
    return error(res, 'Failed to refresh token', 500);
  }
}

/**
 * Logout user - revoke refresh token and clear cookies
 */
async function logout(req, res) {
  try {
    const userId = req.user.userId;
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        
        // Revoke refresh token in database
        await query(
          `UPDATE public.refresh_tokens 
           SET is_revoked = TRUE, revoked_at = NOW() 
           WHERE token_id = $1 AND user_id = $2`,
          [decoded.tokenId, userId]
        );
      } catch (err) {
        // If token is invalid/expired, still clear cookies
        logger.debug('Could not decode refresh token during logout', { error: err.message });
      }
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    logger.info('Logout successful', { userId });

    return success(res, null, 'Logout successful', 200);
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    
    // Even if there's an error, clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return success(res, null, 'Logout successful', 200);
  }
}

/**
 * Logout from all devices - revoke all refresh tokens
 */
async function logoutAllDevices(req, res) {
  try {
    const userId = req.user.userId;

    // Revoke all refresh tokens for this user
    await query(
      `UPDATE public.refresh_tokens 
       SET is_revoked = TRUE, revoked_at = NOW() 
       WHERE user_id = $1 AND is_revoked = FALSE`,
      [userId]
    );

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    logger.info('Logout all devices successful', { userId });

    return success(res, null, 'Logged out from all devices', 200);
  } catch (err) {
    logger.error('Logout all devices error', { error: err.message });
    return error(res, 'Failed to logout from all devices', 500);
  }
}

module.exports = {
  login,
  getCurrentUser,
  refreshAccessToken,
  logout,
  logoutAllDevices,
};
