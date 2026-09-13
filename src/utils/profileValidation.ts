/**
 * Username and Profile Validation Utilities for VisioSpace
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Normalizes username input by removing leading @ and trimming whitespace.
 */
export function cleanUsername(input: string): string {
  return input.trim().replace(/^@+/, '');
}

/**
 * Validates that a username complies with VisioSpace username rules:
 * - 3–20 characters
 * - Letters, numbers, and underscores only
 * - No spaces or special characters
 */
export function validateUsernameFormat(username: string): ValidationResult {
  const cleaned = cleanUsername(username);

  if (!cleaned) {
    return { valid: false, error: 'Username is required.' };
  }

  if (cleaned.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }

  if (cleaned.length > 20) {
    return { valid: false, error: 'Username cannot exceed 20 characters.' };
  }

  if (!USERNAME_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores.',
    };
  }

  return { valid: true };
}

/**
 * Validates full name input:
 * - At least 1 non-whitespace character
 * - Maximum 60 characters
 */
export function validateFullName(name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: 'Full name is required.' };
  }

  if (trimmed.length > 60) {
    return { valid: false, error: 'Full name cannot exceed 60 characters.' };
  }

  return { valid: true };
}
