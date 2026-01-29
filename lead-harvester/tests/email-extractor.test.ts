import { describe, it, expect } from 'vitest';

// Email regex pattern
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Junk email patterns
const JUNK_EMAIL_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^webmaster@/i,
  /^admin@example\./i,
  /^test@/i,
  /^example@/i,
  /^user@/i,
  /^email@example\./i,
  /^your@email/i,
  /^name@domain/i,
  /^info@example\./i,
  /.png$/i,
  /.jpg$/i,
  /.gif$/i,
  /.svg$/i,
  /.webp$/i,
  /@sentry\./i,
  /@wixpress\./i,
  /@w3\.org/i,
];

function isJunkEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase();
  return JUNK_EMAIL_PATTERNS.some((pattern) => pattern.test(lowerEmail));
}

function extractEmailsFromText(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return matches.filter((email) => !isJunkEmail(email));
}

function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isBusinessDomainEmail(email: string, websiteUrl: string): boolean {
  const domain = extractDomain(websiteUrl);
  if (!domain) return false;

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain) return false;

  return emailDomain === domain || emailDomain.endsWith(`.${domain}`);
}

describe('Email Extraction', () => {
  describe('EMAIL_REGEX', () => {
    it('should match valid emails', () => {
      const validEmails = [
        'test@example.com',
        'john.doe@company.org',
        'user+tag@domain.co.uk',
        'name123@test-domain.net',
        'contact@sub.domain.com',
      ];

      validEmails.forEach((email) => {
        expect(email.match(EMAIL_REGEX)).toContain(email);
      });
    });

    it('should extract emails from text', () => {
      const text = `
        Contact us at info@business.com or sales@business.com.
        You can also reach our CEO at john.smith@business.com
      `;
      const matches = text.match(EMAIL_REGEX) || [];
      expect(matches).toHaveLength(3);
      expect(matches).toContain('info@business.com');
      expect(matches).toContain('sales@business.com');
      expect(matches).toContain('john.smith@business.com');
    });
  });

  describe('isJunkEmail', () => {
    it('should identify noreply emails', () => {
      expect(isJunkEmail('noreply@example.com')).toBe(true);
      expect(isJunkEmail('no-reply@example.com')).toBe(true);
      expect(isJunkEmail('donotreply@example.com')).toBe(true);
    });

    it('should identify system emails', () => {
      expect(isJunkEmail('mailer-daemon@example.com')).toBe(true);
      expect(isJunkEmail('postmaster@example.com')).toBe(true);
      expect(isJunkEmail('webmaster@example.com')).toBe(true);
    });

    it('should identify placeholder emails', () => {
      expect(isJunkEmail('test@example.com')).toBe(true);
      expect(isJunkEmail('example@gmail.com')).toBe(true);
      expect(isJunkEmail('user@domain.com')).toBe(true);
      expect(isJunkEmail('your@email.com')).toBe(true);
      expect(isJunkEmail('name@domain.com')).toBe(true);
    });

    it('should identify image extensions', () => {
      expect(isJunkEmail('image.png')).toBe(true);
      expect(isJunkEmail('photo.jpg')).toBe(true);
      expect(isJunkEmail('icon.svg')).toBe(true);
    });

    it('should identify known junk domains', () => {
      expect(isJunkEmail('error@sentry.io')).toBe(true);
      expect(isJunkEmail('noreply@wixpress.com')).toBe(true);
    });

    it('should not flag legitimate emails', () => {
      expect(isJunkEmail('contact@business.com')).toBe(false);
      expect(isJunkEmail('info@company.org')).toBe(false);
      expect(isJunkEmail('sales@startup.io')).toBe(false);
      expect(isJunkEmail('john.doe@enterprise.net')).toBe(false);
    });
  });

  describe('extractEmailsFromText', () => {
    it('should extract and filter emails from text', () => {
      const text = `
        Contact: info@business.com
        No Reply: noreply@business.com
        Sales: sales@business.com
        Test: test@example.com
      `;
      const emails = extractEmailsFromText(text);
      expect(emails).toHaveLength(2);
      expect(emails).toContain('info@business.com');
      expect(emails).toContain('sales@business.com');
      expect(emails).not.toContain('noreply@business.com');
      expect(emails).not.toContain('test@example.com');
    });

    it('should handle HTML content', () => {
      const html = `
        <a href="mailto:contact@company.com">Email us</a>
        <p>Or call us at 555-1234</p>
        <a href="mailto:noreply@company.com">Unsubscribe</a>
      `;
      const emails = extractEmailsFromText(html);
      expect(emails).toContain('contact@company.com');
      expect(emails).not.toContain('noreply@company.com');
    });

    it('should return empty array for no emails', () => {
      const text = 'This text has no email addresses in it.';
      expect(extractEmailsFromText(text)).toHaveLength(0);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://www.example.com/page')).toBe('example.com');
      expect(extractDomain('http://business.org')).toBe('business.org');
      expect(extractDomain('https://sub.domain.com')).toBe('sub.domain.com');
    });

    it('should strip www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBeNull();
      expect(extractDomain('')).toBeNull();
    });
  });

  describe('isBusinessDomainEmail', () => {
    it('should identify matching domain emails', () => {
      expect(
        isBusinessDomainEmail('info@example.com', 'https://example.com')
      ).toBe(true);
      expect(
        isBusinessDomainEmail('contact@business.org', 'https://www.business.org')
      ).toBe(true);
    });

    it('should identify subdomain emails', () => {
      expect(
        isBusinessDomainEmail('support@mail.example.com', 'https://example.com')
      ).toBe(true);
    });

    it('should reject non-matching domains', () => {
      expect(
        isBusinessDomainEmail('info@gmail.com', 'https://example.com')
      ).toBe(false);
      expect(
        isBusinessDomainEmail('contact@hotmail.com', 'https://business.org')
      ).toBe(false);
    });

    it('should handle invalid URLs', () => {
      expect(isBusinessDomainEmail('info@example.com', 'invalid-url')).toBe(
        false
      );
    });
  });
});
