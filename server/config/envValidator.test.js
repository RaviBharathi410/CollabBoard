import { describe, it, expect } from 'vitest';
import { validateEnvironment } from './envValidator.js';

describe('server/config/envValidator.js', () => {
  it('should throw fatal error when ALLOW_UNAUTHENTICATED is true in production', () => {
    const env = {
      NODE_ENV: 'production',
      ALLOW_UNAUTHENTICATED: 'true',
      ALLOWED_ORIGINS: 'https://collabboard.example.com',
    };

    expect(() => validateEnvironment(env)).toThrow(
      /ALLOW_UNAUTHENTICATED=true is strictly prohibited in production mode/
    );
  });

  it('should throw fatal error when ALLOWED_ORIGINS has wildcard in production', () => {
    const env = {
      NODE_ENV: 'production',
      ALLOW_UNAUTHENTICATED: 'false',
      ALLOWED_ORIGINS: '*',
    };

    expect(() => validateEnvironment(env)).toThrow(
      /ALLOWED_ORIGINS cannot be empty or contain wildcard \(\*\)/
    );
  });

  it('should throw fatal error when ALLOWED_ORIGINS is empty in production', () => {
    const env = {
      NODE_ENV: 'production',
      ALLOW_UNAUTHENTICATED: 'false',
      ALLOWED_ORIGINS: '',
    };

    expect(() => validateEnvironment(env)).toThrow(
      /ALLOWED_ORIGINS cannot be empty or contain wildcard \(\*\)/
    );
  });

  it('should pass in production with valid origins and auth enabled', () => {
    const env = {
      NODE_ENV: 'production',
      ALLOW_UNAUTHENTICATED: 'false',
      ALLOWED_ORIGINS: 'https://app.collabboard.com,https://collabboard.com',
    };

    const result = validateEnvironment(env);
    expect(result.valid).toBe(true);
    expect(result.isProduction).toBe(true);
    expect(result.allowUnauthenticated).toBe(false);
  });

  it('should allow ALLOW_UNAUTHENTICATED=true in development mode', () => {
    const env = {
      NODE_ENV: 'development',
      ALLOW_UNAUTHENTICATED: 'true',
    };

    const result = validateEnvironment(env);
    expect(result.valid).toBe(true);
    expect(result.isProduction).toBe(false);
    expect(result.allowUnauthenticated).toBe(true);
  });
});
