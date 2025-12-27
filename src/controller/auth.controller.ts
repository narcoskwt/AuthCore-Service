import type { Request, Response } from 'express';
import httpStatus from 'http-status';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import prismaClient from '../config/prisma';
import type {
  TypedRequest,
  UserLoginCredentials,
  UserSignUpCredentials
} from '../types/types';
import {
  createAccessToken,
  createRefreshToken
} from '../utils/generateTokens.util';
import config from '../config/config';

import {
  clearRefreshTokenCookieConfig,
  refreshTokenCookieConfig
} from '../config/cookieConfig';

import { sendVerifyEmail } from '../utils/sendEmail.util';
import logger from '../middleware/logger';
import { logAuthEvent, getClientIp, type AuditEventType } from '../utils/auditLog.util';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const { verify } = jwt;

// Security: Account lockout configuration
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * This function handles the signup process for new users. It expects a request object with the following properties:
 *
 * @param {TypedRequest<UserSignUpCredentials>} req - The request object that includes user's username, email, and password.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the request body is missing any required parameters.
 *   - A 409 CONFLICT status code if the user email already exists in the database.
 *   - A 201 CREATED status code and a success message if the new user is successfully created and a verification email is sent.
 *   - A 500 INTERNAL SERVER ERROR status code if there is an error in the server.
 */
export const handleSignUp = async (
  req: TypedRequest<UserSignUpCredentials>,
  res: Response
) => {
  const { username, email, password } = req.body;

  // check req.body values
  if (!username || !email || !password) {
    return res.status(httpStatus.BAD_REQUEST).json({
      message: 'Username, email and password are required!'
    });
  }

  const checkUserEmail = await prismaClient.user.findUnique({
    where: {
      email
    }
  });

  if (checkUserEmail) return res.sendStatus(httpStatus.CONFLICT); // email is already in db

  try {
    const hashedPassword = await argon2.hash(password);

    const newUser = await prismaClient.user.create({
      data: {
        name: username,
        email,
        password: hashedPassword
      }
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 3600000); // Token expires in 1 hour

    await prismaClient.emailVerificationToken.create({
      data: {
        token,
        expiresAt,
        userId: newUser.id
      }
    });

    // Send an email with the verification link
    sendVerifyEmail(email, token);

    res.status(httpStatus.CREATED).json({ message: 'New user created' });
  } catch (err) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * This function handles the login process for users. It expects a request object with the following properties:
 *
 * @param {TypedRequest<UserLoginCredentials>} req - The request object that includes user's email and password.
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 400 BAD REQUEST status code and an error message if the request body is missing any required parameters.
 *   - A 401 UNAUTHORIZED status code if the user email does not exist in the database or the email is not verified or the password is incorrect.
 *   - A 200 OK status code and an access token if the login is successful and a new refresh token is stored in the database and a new refresh token cookie is set.
 *   - A 500 INTERNAL SERVER ERROR status code if there is an error in the server.
 */
export const handleLogin = async (
  req: TypedRequest<UserLoginCredentials>,
  res: Response
) => {
  const cookies = req.cookies;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: 'Email and password are required!' });
  }

  const user = await prismaClient.user.findUnique({
    where: {
      email
    }
  });

  // Security: Account lockout check
  // Check if account is locked before processing login
  if (user && user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    await logAuthEvent('LOGIN_FAILURE', user.id, ipAddress, userAgent);
    return res.status(httpStatus.FORBIDDEN).json({
      message: `Account is locked. Please try again in ${remainingMinutes} minute(s).`
    });
  }

  // Security: Unlock account if lockout period has expired
  if (user && user.lockedUntil && user.lockedUntil <= new Date()) {
    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });
  }

  // Generating the dummy hash dynamically may introduce a slight performance overhead, as argon2.hash()
  // is a computationally expensive operation.
  // However, this is generally negligible compared to the security benefits it provides
  const dummyPassword = 'dummy_password';
  const dummyHash = await argon2.hash(dummyPassword);

  // Use the user's hash if found, otherwise use the dummy hash
  const userPasswordHash = user ? user.password : dummyHash;

  // check password
  try {
    const isPasswordValid = await argon2.verify(userPasswordHash, password);

    // Check if email is verified
    // Check for verified email after verifying the password to prevent user enumeration attacks
    if (user && !user.emailVerified) {
      await logAuthEvent('LOGIN_FAILURE', user.id, ipAddress, userAgent);
      return res.status(httpStatus.UNAUTHORIZED).json({
        message: 'Your email is not verified! Please confirm your email!'
      });
    }

    // If password is invalid, handle account lockout
    if (!isPasswordValid) {
      if (user) {
        // Security: Increment failed login attempts
        const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
        const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
          failedLoginAttempts: newFailedAttempts
        };

        // Security: Lock account after max failed attempts
        if (newFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
          updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          await logAuthEvent('ACCOUNT_LOCKED', user.id, ipAddress, userAgent);
        }

        await prismaClient.user.update({
          where: { id: user.id },
          data: updateData
        });

        await logAuthEvent('LOGIN_FAILURE', user.id, ipAddress, userAgent);
      } else {
        // Log failed attempt even if user doesn't exist (but don't reveal this)
        await logAuthEvent('LOGIN_FAILURE', null, ipAddress, userAgent);
      }

      return res.status(httpStatus.UNAUTHORIZED).json({
        message: 'Invalid email or password!'
      });
    }

    // Security: User not found (but password check passed - shouldn't happen, but handle gracefully)
    if (!user) {
      await logAuthEvent('LOGIN_FAILURE', null, ipAddress, userAgent);
      return res.status(httpStatus.UNAUTHORIZED).json({
        message: 'Invalid email or password!'
      });
    }

    // Security: Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prismaClient.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
    }

    // Security: Token family management
    // Generate a new token family ID for this login session
    // All refresh tokens from this session will share the same family ID
    const tokenFamilyId = randomUUID();

    // if there is a refresh token in the req.cookie, then we need to check if this
    // refresh token exists in the database and belongs to the current user than we need to delete it
    // if the token does not belong to the current user, then we delete all refresh tokens
    // of the user stored in the db to be on the safe site
    // we also clear the cookie in both cases
    if (cookies?.[config.jwt.refresh_token.cookie_name]) {
      // check if the given refresh token is from the current user
      const checkRefreshToken = await prismaClient.refreshToken.findUnique({
        where: {
          token: cookies[config.jwt.refresh_token.cookie_name]
        }
      });

      // if this token does not exists int the database or belongs to another user,
      // then we clear all refresh tokens from the user in the db
      if (!checkRefreshToken || checkRefreshToken.userId !== user.id) {
        await prismaClient.refreshToken.deleteMany({
          where: {
            userId: user.id
          }
        });
      } else {
        // else everything is fine and we just need to delete the one token
        await prismaClient.refreshToken.delete({
          where: {
            token: cookies[config.jwt.refresh_token.cookie_name]
          }
        });
      }

      // also clear the refresh token in the cookie
      res.clearCookie(
        config.jwt.refresh_token.cookie_name,
        clearRefreshTokenCookieConfig
      );
    }

    const accessToken = createAccessToken(user.id);

    const newRefreshToken = createRefreshToken(user.id);

    // Security: Store new refresh token with token family ID
    // All tokens from the same login session share the same family ID
    await prismaClient.refreshToken.create({
      data: {
        token: newRefreshToken,
        tokenFamilyId,
        userId: user.id,
        revoked: false
      }
    });

    // Security: Log successful login
    await logAuthEvent('LOGIN_SUCCESS', user.id, ipAddress, userAgent);

    // save refresh token in cookie
    res.cookie(
      config.jwt.refresh_token.cookie_name,
      newRefreshToken,
      refreshTokenCookieConfig
    );

    // send access token per json to user so it can be stored in the localStorage
    return res.json({ accessToken });
  } catch (err) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * This function handles the logout process for users. It expects a request object with the following properties:
 *
 * @param {TypedRequest} req - The request object that includes a cookie with a valid refresh token
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 204 NO CONTENT status code if the refresh token cookie is undefined
 *   - A 204 NO CONTENT status code if the refresh token does not exists in the database
 *   - A 204 NO CONTENT status code if the refresh token cookie is successfully cleared
 */
export const handleLogout = async (req: TypedRequest, res: Response) => {
  const cookies = req.cookies;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  if (!cookies[config.jwt.refresh_token.cookie_name]) {
    return res.sendStatus(httpStatus.NO_CONTENT); // No content
  }
  const refreshToken = cookies[config.jwt.refresh_token.cookie_name];

  // Is refreshToken in db?
  const foundRft = await prismaClient.refreshToken.findUnique({
    where: { token: refreshToken }
  });

  if (!foundRft) {
    res.clearCookie(
      config.jwt.refresh_token.cookie_name,
      clearRefreshTokenCookieConfig
    );
    return res.sendStatus(httpStatus.NO_CONTENT);
  }

  // Security: Log logout event
  await logAuthEvent('LOGOUT', foundRft.userId, ipAddress, userAgent);

  // Delete refreshToken in db
  await prismaClient.refreshToken.delete({
    where: { token: refreshToken }
  });

  res.clearCookie(
    config.jwt.refresh_token.cookie_name,
    clearRefreshTokenCookieConfig
  );
  return res.sendStatus(httpStatus.NO_CONTENT);
};

/**
 * This function handles the refresh process for users. It expects a request object with the following properties:
 *
 * @param {Request} req - The request object that includes a cookie with a valid refresh token
 * @param {Response} res - The response object that will be used to send the HTTP response.
 *
 * @returns {Response} Returns an HTTP response that includes one of the following:
 *   - A 401 UNAUTHORIZED status code if the refresh token cookie is undefined
 *   - A 403 FORBIDDEN status code if a refresh token reuse was detected but the token wasn't valid
 *   - A 403 FORBIDDEN status code if a refresh token reuse was detected but the token was valid
 *   - A 403 FORBIDDEN status code if the token wasn't valid
 *   - A 200 OK status code if the token was valid and the user was granted a new refresh and access token
 */
export const handleRefresh = async (req: Request, res: Response) => {
  const refreshToken: string | undefined =
    req.cookies[config.jwt.refresh_token.cookie_name] ||
    req.headers.authorization?.replace('Bearer ', ''); // Security: Support Authorization header

  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  if (!refreshToken) return res.sendStatus(httpStatus.UNAUTHORIZED);

  // clear refresh cookie
  res.clearCookie(
    config.jwt.refresh_token.cookie_name,
    clearRefreshTokenCookieConfig
  );

  // Security: Check if refresh token is in db and not revoked
  const foundRefreshToken = await prismaClient.refreshToken.findUnique({
    where: {
      token: refreshToken
    }
  });

  // Security: Refresh token reuse detection
  // If token not found in DB but is valid JWT, it's a reused token
  if (!foundRefreshToken) {
    verify(
      refreshToken,
      config.jwt.refresh_token.secret,
      async (err: unknown, payload: JwtPayload) => {
        if (err) {
          await logAuthEvent('TOKEN_REUSE_DETECTED', null, ipAddress, userAgent);
          return res.sendStatus(httpStatus.FORBIDDEN);
        }

        logger.warn('Attempted refresh token reuse detected!');
        await logAuthEvent('TOKEN_REUSE_DETECTED', payload.userId as string, ipAddress, userAgent);

        // Security: Revoke ALL tokens in the same family (token reuse detected)
        // Find all tokens with the same family ID and revoke them
        const reusedTokenFamily = await prismaClient.refreshToken.findFirst({
          where: {
            userId: payload.userId as string,
            token: refreshToken
          }
        });

        if (reusedTokenFamily) {
          // Revoke all tokens in the same family
          await prismaClient.refreshToken.updateMany({
            where: {
              tokenFamilyId: reusedTokenFamily.tokenFamilyId,
              userId: payload.userId as string
            },
            data: {
              revoked: true
            }
          });
        }

        // Security: Delete all active tokens for this user (force re-login)
        await prismaClient.refreshToken.deleteMany({
          where: {
            userId: payload.userId as string
          }
        });

        return res.status(httpStatus.FORBIDDEN).json({
          message: 'Token reuse detected. Please log in again.'
        });
      }
    );
    return res.status(httpStatus.FORBIDDEN);
  }

  // Security: Check if token is revoked
  if (foundRefreshToken.revoked) {
    await logAuthEvent('TOKEN_REUSE_DETECTED', foundRefreshToken.userId, ipAddress, userAgent);
    logger.warn('Attempted use of revoked refresh token!');
    
    // Delete all tokens for this user (security measure)
    await prismaClient.refreshToken.deleteMany({
      where: {
        userId: foundRefreshToken.userId
      }
    });

    return res.status(httpStatus.FORBIDDEN).json({
      message: 'Token has been revoked. Please log in again.'
    });
  }

  // delete from db (token rotation)
  await prismaClient.refreshToken.delete({
    where: {
      token: refreshToken
    }
  });

  // evaluate jwt
  verify(
    refreshToken,
    config.jwt.refresh_token.secret,
    async (err: unknown, payload: JwtPayload) => {
      if (err || foundRefreshToken.userId !== payload.userId) {
        return res.sendStatus(httpStatus.FORBIDDEN);
      }

      // Security: Check if any token in the same family was revoked
      // If so, revoke all tokens in the family (reuse detected)
      const familyTokens = await prismaClient.refreshToken.findMany({
        where: {
          tokenFamilyId: foundRefreshToken.tokenFamilyId,
          userId: foundRefreshToken.userId
        }
      });

      const hasRevokedFamilyToken = familyTokens.some(token => token.revoked);
      if (hasRevokedFamilyToken) {
        // Token family compromised - revoke all and force re-login
        await prismaClient.refreshToken.deleteMany({
          where: {
            userId: foundRefreshToken.userId
          }
        });
        await logAuthEvent('TOKEN_REUSE_DETECTED', foundRefreshToken.userId, ipAddress, userAgent);
        return res.status(httpStatus.FORBIDDEN).json({
          message: 'Token family compromised. Please log in again.'
        });
      }

      // Refresh token was still valid
      const accessToken = createAccessToken(payload.userId);

      const newRefreshToken = createRefreshToken(payload.userId);

      // Security: Create new refresh token with same family ID
      // This maintains the token family relationship
      await prismaClient.refreshToken
        .create({
          data: {
            token: newRefreshToken,
            tokenFamilyId: foundRefreshToken.tokenFamilyId, // Same family
            userId: payload.userId,
            revoked: false
          }
        })
        .catch((err: Error) => {
          logger.error(err);
        });

      // Security: Log refresh token usage
      await logAuthEvent('REFRESH_TOKEN_USED', payload.userId as string, ipAddress, userAgent);

      // Creates Secure Cookie with refresh token
      res.cookie(
        config.jwt.refresh_token.cookie_name,
        newRefreshToken,
        refreshTokenCookieConfig
      );

      return res.json({ accessToken });
    }
  );
};
