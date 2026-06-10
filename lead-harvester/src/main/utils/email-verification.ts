import * as dns from 'dns';
import { promisify } from 'util';
import type { VerifiedEmail, EmailVerificationStatus } from '../../shared/types';
import { getEmailVerification, saveEmailVerification } from '../database';

const resolveMx = promisify(dns.resolveMx);

// Email syntax validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common disposable/invalid email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'fakeinbox.com',
  'temp-mail.org',
  'yopmail.com',
  'getnada.com',
  'maildrop.cc',
]);

/**
 * Validate email syntax
 */
export function validateEmailSyntax(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Check if email domain has valid MX records
 */
export async function checkMxRecords(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;

    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch (error) {
    // DNS lookup failed - domain might not exist or have MX records
    return false;
  }
}

/**
 * Check if email uses a known disposable domain
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Verify a single email address
 * Returns cached result if available
 */
export async function verifyEmail(email: string, useCache: boolean = true): Promise<VerifiedEmail> {
  // Check cache first
  if (useCache) {
    const cached = getEmailVerification(email);
    if (cached && cached.status !== 'checking') {
      return cached;
    }
  }

  const result: VerifiedEmail = {
    email,
    status: 'checking',
    syntaxValid: validateEmailSyntax(email),
    verifiedAt: new Date().toISOString(),
  };

  // If syntax is invalid, mark as invalid immediately
  if (!result.syntaxValid) {
    result.status = 'invalid';
    saveEmailVerification(result);
    return result;
  }

  // Check for disposable email
  if (isDisposableEmail(email)) {
    result.status = 'invalid';
    result.mxValid = false;
    saveEmailVerification(result);
    return result;
  }

  // Check MX records
  try {
    result.mxValid = await checkMxRecords(email);
    result.status = result.mxValid ? 'valid' : 'invalid';
  } catch (error) {
    result.mxValid = false;
    result.status = 'invalid';
  }

  // Save to cache
  saveEmailVerification(result);
  return result;
}

/**
 * Verify multiple emails in parallel with concurrency limit
 */
export async function verifyEmails(
  emails: string[],
  concurrency: number = 3,
  useCache: boolean = true
): Promise<VerifiedEmail[]> {
  const results: VerifiedEmail[] = [];
  const queue = [...emails];

  async function worker() {
    while (queue.length > 0) {
      const email = queue.shift();
      if (email) {
        const result = await verifyEmail(email, useCache);
        results.push(result);
      }
    }
  }

  // Create workers
  const workers = Array(Math.min(concurrency, emails.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Get verification status color for UI
 */
export function getVerificationColor(status: EmailVerificationStatus): string {
  switch (status) {
    case 'valid':
      return '#10B981'; // green-500
    case 'invalid':
      return '#EF4444'; // red-500
    case 'checking':
      return '#F59E0B'; // amber-500
    default:
      return '#6B7280'; // gray-500
  }
}

/**
 * Get verification status label for UI
 */
export function getVerificationLabel(status: EmailVerificationStatus): string {
  switch (status) {
    case 'valid':
      return 'Verified';
    case 'invalid':
      return 'Invalid';
    case 'checking':
      return 'Checking...';
    default:
      return 'Unverified';
  }
}
