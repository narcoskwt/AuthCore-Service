import prismaClient from '../config/prisma';

/**
 * Security: Audit logging utility
 * Logs authentication events for security monitoring and compliance
 */

export type AuditEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'REFRESH_TOKEN_USED'
  | 'LOGOUT'
  | 'TOKEN_REUSE_DETECTED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED';

/**
 * Logs an authentication event to the audit trail
 * @param eventType - Type of authentication event
 * @param userId - User ID (optional, null for failed login attempts with invalid email)
 * @param ipAddress - IP address of the request
 * @param userAgent - User agent string
 */
export const logAuthEvent = async (
  eventType: AuditEventType,
  userId: string | null,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  try {
    await prismaClient.authAuditLog.create({
      data: {
        userId: userId ?? null,
        eventType,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null
      }
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to write audit log:', error);
  }
};

/**
 * Helper function to extract IP address from request
 * Handles proxy headers (X-Forwarded-For) for accurate IP tracking
 */
export const getClientIp = (req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string => {
  // Check X-Forwarded-For header (first IP in chain)
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }
  
  // Check X-Real-IP header
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  // Fallback to Express req.ip
  return req.ip ?? 'unknown';
};

