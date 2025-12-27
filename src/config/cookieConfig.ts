import type { CookieOptions } from 'express';
import config from './config';

/**
 * Security: Cookie configuration for refresh tokens
 * 
 * Cookies are configured with:
 * - httpOnly: true - Prevents JavaScript access (XSS protection)
 * - secure: true - Only sent over HTTPS in production
 * - sameSite: 'strict' in production, 'lax' in development - CSRF protection
 * 
 * Note: For cross-origin scenarios, sameSite may need to be 'none' with secure: true
 * This configuration supports both cookie-based and Authorization header authentication
 */
export const refreshTokenCookieConfig: CookieOptions = {
  httpOnly: true, // Security: Prevent JavaScript access (XSS protection)
  sameSite: config.node_env === 'production' ? 'strict' : 'lax', // Security: CSRF protection
  secure: config.node_env === 'production', // Security: HTTPS only in production
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

export const clearRefreshTokenCookieConfig: CookieOptions = {
  httpOnly: true,
  sameSite: config.node_env === 'production' ? 'strict' : 'lax',
  secure: config.node_env === 'production'
};
