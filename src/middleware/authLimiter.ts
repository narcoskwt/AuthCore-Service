import { rateLimit } from 'express-rate-limit';

/**
 * Security: Rate limiting for authentication endpoints
 * Limits: 5 requests per 15 minutes per IP
 * Applied to: POST /auth/login and POST /auth/refresh
 * 
 * This prevents brute force attacks and token abuse
 * Uses in-memory store by default, can be configured with Redis for distributed systems
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use Redis store if REDIS_URL is available, otherwise use in-memory
  // store: redisClient ? new RedisStore({ client: redisClient }) : undefined
});

export default authLimiter;
