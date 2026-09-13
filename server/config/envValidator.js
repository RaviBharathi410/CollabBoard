/**
 * Production Environment Validator for CollabBoard
 *
 * Enforces structural security invariants at boot time.
 * Prevents insecure configurations (like auth bypass or wildcard CORS)
 * from ever starting up in production.
 */

export function validateEnvironment(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    // 1. Structurally forbid auth bypass in production
    if (env.ALLOW_UNAUTHENTICATED === 'true' || env.ALLOW_UNAUTHENTICATED === true) {
      throw new Error(
        '[FATAL SECURITY ERROR] ALLOW_UNAUTHENTICATED=true is strictly prohibited in production mode. Server boot aborted.'
      );
    }

    // 2. Structurally forbid wildcard CORS in production
    const origins = env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || [];
    if (origins.length === 0 || origins.includes('*') || origins.some((o) => o === '')) {
      throw new Error(
        '[FATAL SECURITY ERROR] ALLOWED_ORIGINS cannot be empty or contain wildcard (*) in production mode. Server boot aborted.'
      );
    }
  }

  return {
    valid: true,
    isProduction,
    allowUnauthenticated: env.ALLOW_UNAUTHENTICATED === 'true',
  };
}
