import type { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import prismaClient from '../config/prisma';
import isAuth from './isAuth';

/**
 * Security: Permission-based authorization middleware
 * 
 * This middleware checks if the authenticated user has the required permission.
 * Permissions are associated with roles, and users can have multiple roles.
 * 
 * Usage:
 *   router.get('/admin', isAuth, requirePermission('ADMIN_PANEL_ACCESS'), handler);
 * 
 * @param permissionName - The name of the required permission (e.g., 'USER_READ', 'ADMIN_PANEL_ACCESS')
 * @returns Express middleware function
 */
export const requirePermission = (permissionName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // First ensure user is authenticated (isAuth middleware should run before this)
    if (!req.payload || !req.payload.userID) {
      return res.sendStatus(httpStatus.UNAUTHORIZED);
    }

    const userId = req.payload.userID as string;

    try {
      // Get all roles for the user
      const userRoles = await prismaClient.userRole.findMany({
        where: {
          userId
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      // Check if user has any role with the required permission
      const hasPermission = userRoles.some((userRole) =>
        userRole.role.rolePermissions.some(
          (rp) => rp.permission.name === permissionName
        )
      );

      if (!hasPermission) {
        return res.status(httpStatus.FORBIDDEN).json({
          message: `Access denied. Required permission: ${permissionName}`
        });
      }

      // User has the required permission
      next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Security: Combined middleware that checks authentication and permission
 * Convenience function to use both isAuth and requirePermission together
 * 
 * Usage:
 *   router.get('/admin', requireAuthAndPermission('ADMIN_PANEL_ACCESS'), handler);
 */
export const requireAuthAndPermission = (permissionName: string) => {
  return [isAuth, requirePermission(permissionName)];
};

export default requirePermission;

