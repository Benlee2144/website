import type { Page } from 'playwright-core';

// Email regex pattern - captures most valid email formats
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Junk email patterns to filter out
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
  /\.png$/i,
  /\.jpg$/i,
  /\.gif$/i,
  /\.svg$/i,
  /\.webp$/i,
  /@sentry\./i,
  /@wixpress\./i,
  /@w3\.org/i,
];

// Common contact page paths
const CONTACT_PATHS = [
  '/contact',
  '/contact-us',
  '/contact_us',
  '/contactus',
  '/about',
  '/about-us',
  '/about_us',
  '/aboutus',
  '/team',
  '/our-team',
  '/privacy',
  '/privacy-policy',
  '/support',
  '/help',
  '/get-in-touch',
  '/reach-us',
];

interface EmailExtractionResult {
  emails: string[];
  contactPageUrl?: string;
}

/**
 * Check if an email is likely junk/placeholder
 */
function isJunkEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase();
  return JUNK_EMAIL_PATTERNS.some(pattern => pattern.test(lowerEmail));
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check if email belongs to the business domain
 */
function isBusinessDomainEmail(email: string, websiteUrl: string): boolean {
  const domain = extractDomain(websiteUrl);
  if (!domain) return false;

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain) return false;

  // Check if email domain matches or is subdomain of website domain
  return emailDomain === domain || emailDomain.endsWith(`.${domain}`);
}

/**
 * Extract emails from mailto links
 */
async function extractMailtoEmails(page: Page): Promise<string[]> {
  try {
    const emails = await page.evaluate(() => {
      const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
      const results: string[] = [];
      mailtoLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          const email = href.replace('mailto:', '').split('?')[0].trim();
          if (email) results.push(email);
        }
      });
      return results;
    });
    return emails;
  } catch {
    return [];
  }
}

/**
 * Extract emails from visible text
 */
async function extractVisibleTextEmails(page: Page): Promise<string[]> {
  try {
    const text = await page.evaluate(() => document.body?.innerText || '');
    const matches = text.match(EMAIL_REGEX) || [];
    return matches;
  } catch {
    return [];
  }
}

/**
 * Extract emails from page source
 */
async function extractSourceEmails(page: Page): Promise<string[]> {
  try {
    const html = await page.content();
    const matches = html.match(EMAIL_REGEX) || [];
    return matches;
  } catch {
    return [];
  }
}

/**
 * Extract emails from JSON-LD structured data
 */
async function extractJsonLdEmails(page: Page): Promise<string[]> {
  try {
    const emails = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const results: string[] = [];

      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '{}');
          const findEmails = (obj: any): void => {
            if (typeof obj === 'string' && obj.includes('@')) {
              const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
              const matches = obj.match(emailRegex);
              if (matches) results.push(...matches);
            } else if (Array.isArray(obj)) {
              obj.forEach(findEmails);
            } else if (typeof obj === 'object' && obj !== null) {
              if (obj.email) results.push(obj.email);
              if (obj.contactPoint?.email) results.push(obj.contactPoint.email);
              Object.values(obj).forEach(findEmails);
            }
          };
          findEmails(data);
        } catch {
          // Ignore JSON parse errors
        }
      });

      return results;
    });
    return emails;
  } catch {
    return [];
  }
}

/**
 * Extract emails from footer area
 */
async function extractFooterEmails(page: Page): Promise<string[]> {
  try {
    const emails = await page.evaluate(() => {
      const footerSelectors = ['footer', '[role="contentinfo"]', '.footer', '#footer', '.site-footer'];
      const results: string[] = [];

      for (const selector of footerSelectors) {
        const footer = document.querySelector(selector);
        if (footer) {
          const text = footer.textContent || '';
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const matches = text.match(emailRegex);
          if (matches) results.push(...matches);
        }
      }

      return results;
    });
    return emails;
  } catch {
    return [];
  }
}

/**
 * Find contact page URL
 */
async function findContactPage(page: Page, baseUrl: string): Promise<string | null> {
  try {
    // First, try to find contact link in navigation
    const contactLink = await page.evaluate((paths) => {
      const links = document.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.toLowerCase() || '';
        const hrefLower = href.toLowerCase();

        // Check text content
        if (
          text.includes('contact') ||
          text.includes('get in touch') ||
          text.includes('reach us')
        ) {
          return href;
        }

        // Check href path
        for (const path of paths) {
          if (hrefLower.includes(path)) {
            return href;
          }
        }
      }
      return null;
    }, CONTACT_PATHS);

    if (contactLink) {
      try {
        return new URL(contactLink, baseUrl).href;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract emails from a single page
 */
async function extractEmailsFromPage(page: Page): Promise<string[]> {
  const allEmails: string[] = [];

  // Run all extraction methods in parallel
  const [mailtoEmails, visibleEmails, sourceEmails, jsonLdEmails, footerEmails] = await Promise.all([
    extractMailtoEmails(page),
    extractVisibleTextEmails(page),
    extractSourceEmails(page),
    extractJsonLdEmails(page),
    extractFooterEmails(page),
  ]);

  allEmails.push(...mailtoEmails, ...visibleEmails, ...sourceEmails, ...jsonLdEmails, ...footerEmails);

  // Deduplicate and normalize
  const unique = [...new Set(allEmails.map(e => e.toLowerCase().trim()))];

  return unique;
}

/**
 * Main email extraction function - crawls website to find emails
 */
export async function extractEmailsFromWebsite(
  page: Page,
  websiteUrl: string,
  options: {
    maxPages?: number;
    timeout?: number;
  } = {}
): Promise<EmailExtractionResult> {
  const maxPages = options.maxPages || 6;
  const timeout = options.timeout || 15000;

  const allEmails: Set<string> = new Set();
  let contactPageUrl: string | undefined;
  const visitedUrls: Set<string> = new Set();

  // Normalize base URL
  let baseUrl: string;
  try {
    const urlObj = new URL(websiteUrl);
    baseUrl = urlObj.origin;
  } catch {
    return { emails: [], contactPageUrl: undefined };
  }

  // Pages to visit (homepage + contact paths)
  const pagesToVisit: string[] = [websiteUrl];

  // Add common contact paths
  for (const path of CONTACT_PATHS.slice(0, maxPages - 1)) {
    try {
      const fullUrl = new URL(path, baseUrl).href;
      if (!pagesToVisit.includes(fullUrl)) {
        pagesToVisit.push(fullUrl);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Visit pages and extract emails
  let pagesVisited = 0;

  for (const url of pagesToVisit) {
    if (pagesVisited >= maxPages) break;
    if (visitedUrls.has(url)) continue;

    visitedUrls.add(url);

    try {
      await page.goto(url, {
        timeout,
        waitUntil: 'domcontentloaded',
      });

      // Wait a moment for dynamic content
      await page.waitForTimeout(500);

      // Extract emails from this page
      const pageEmails = await extractEmailsFromPage(page);
      pageEmails.forEach(email => allEmails.add(email));

      // Try to find contact page on first visit
      if (pagesVisited === 0 && !contactPageUrl) {
        const foundContactPage = await findContactPage(page, baseUrl);
        if (foundContactPage) {
          contactPageUrl = foundContactPage;
          // Add to visit queue if not already there
          if (!pagesToVisit.includes(foundContactPage) && !visitedUrls.has(foundContactPage)) {
            pagesToVisit.splice(1, 0, foundContactPage); // Insert as second priority
          }
        }
      }

      // Check if current page is a contact page
      if (!contactPageUrl) {
        const currentPath = new URL(url).pathname.toLowerCase();
        if (CONTACT_PATHS.some(p => currentPath.includes(p.replace('/', '')))) {
          contactPageUrl = url;
        }
      }

      pagesVisited++;
    } catch (error) {
      // Page failed to load, continue with others
      console.debug(`Failed to load ${url}:`, error);
    }
  }

  // Filter and sort emails
  const filteredEmails = Array.from(allEmails)
    .filter(email => !isJunkEmail(email))
    .filter(email => email.length < 100) // Sanity check
    .sort((a, b) => {
      // Prioritize business domain emails
      const aIsBusiness = isBusinessDomainEmail(a, websiteUrl);
      const bIsBusiness = isBusinessDomainEmail(b, websiteUrl);
      if (aIsBusiness && !bIsBusiness) return -1;
      if (!aIsBusiness && bIsBusiness) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 3); // Keep top 3

  return {
    emails: filteredEmails,
    contactPageUrl,
  };
}
