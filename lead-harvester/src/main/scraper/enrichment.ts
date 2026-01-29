import type { Page } from 'playwright-core';
import { createEnrichmentPage } from './google-maps';
import { extractEmailsFromWebsite } from './email-extractor';
import { TaskQueue, delayWithJitter } from './task-queue';
import { createScopedLogger } from '../utils/logger';
import { calculateLeadScore } from '../utils/scoring';
import { updateLead, getPendingEnrichmentLeads, saveRunState, getRunState, getDatabase } from '../database';
import type { Lead, AppSettings, RunState, SocialMediaLinks } from '../../shared/types';

const logger = createScopedLogger('Enrichment');

interface EnrichmentOptions {
  settings: AppSettings;
  onProgress?: (enriched: number, total: number, current?: string) => void;
  shouldStop?: () => boolean;
}

let enrichmentPage: Page | null = null;
let enrichmentQueue: TaskQueue | null = null;
let isEnriching = false;

/**
 * Initialize enrichment system
 */
export async function initEnrichment(settings: AppSettings): Promise<void> {
  if (enrichmentPage) {
    await enrichmentPage.close().catch(() => {});
  }

  enrichmentPage = await createEnrichmentPage(settings);

  enrichmentQueue = new TaskQueue({
    concurrency: settings.concurrency,
    retryDelay: 2000,
    maxRetries: 2,
  });

  isEnriching = false;
}

/**
 * Close enrichment resources
 */
export async function closeEnrichment(): Promise<void> {
  if (enrichmentQueue) {
    enrichmentQueue.stop();
    enrichmentQueue = null;
  }

  if (enrichmentPage) {
    await enrichmentPage.close().catch(() => {});
    enrichmentPage = null;
  }

  isEnriching = false;
}

/**
 * Extract website URL from Google Maps page
 */
async function extractWebsiteFromGoogleMaps(
  page: Page,
  googleMapsUrl: string,
  settings: AppSettings
): Promise<string | null> {
  try {
    await page.goto(googleMapsUrl, {
      timeout: settings.websiteCrawlTimeout,
      waitUntil: 'domcontentloaded',
    });

    await delayWithJitter(settings.safeMode ? 2000 : 1000);

    // Try primary selector
    const websiteLink = await page.$('a[data-item-id="authority"]');
    if (websiteLink) {
      const href = await websiteLink.getAttribute('href');
      if (href) return href;
    }

    // Try alternative selectors
    const websiteLinks = await page.$$('a[href*="http"]');
    for (const link of websiteLinks) {
      const href = await link.getAttribute('href');
      const ariaLabel = await link.getAttribute('aria-label');
      if (
        href &&
        !href.includes('google.com') &&
        !href.includes('maps.google') &&
        (ariaLabel?.toLowerCase().includes('website') ||
          ariaLabel?.toLowerCase().includes('site'))
      ) {
        return href;
      }
    }

    return null;
  } catch (error) {
    logger.debug('Failed to extract website from Google Maps', { error: String(error) });
    return null;
  }
}

/**
 * Extract business hours from Google Maps page
 */
async function extractBusinessHours(
  page: Page,
  googleMapsUrl: string,
  settings: AppSettings
): Promise<string | null> {
  try {
    // Check if we're already on the page
    const currentUrl = page.url();
    if (!currentUrl.includes(googleMapsUrl.substring(0, 50))) {
      await page.goto(googleMapsUrl, {
        timeout: settings.websiteCrawlTimeout,
        waitUntil: 'domcontentloaded',
      });
      await delayWithJitter(settings.safeMode ? 2000 : 1000);
    }

    // Look for hours button and click it
    const hoursButton = await page.$('[data-item-id="oh"]');
    if (hoursButton) {
      await hoursButton.click();
      await delayWithJitter(500);
    }

    // Try to extract hours text
    const hoursSelectors = [
      '[aria-label*="hours"]',
      '.section-open-hours-container',
      '[data-item-id="oh"] + div',
    ];

    for (const selector of hoursSelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.length > 5) {
          return text.trim();
        }
      }
    }

    // Fallback: get from aria-label
    const ariaElement = await page.$('[aria-label*="Monday"], [aria-label*="Sunday"]');
    if (ariaElement) {
      const label = await ariaElement.getAttribute('aria-label');
      if (label) return label;
    }

    return null;
  } catch (error) {
    logger.debug('Failed to extract business hours', { error: String(error) });
    return null;
  }
}

/**
 * Extract latitude and longitude from Google Maps URL
 */
function extractCoordinates(googleMapsUrl: string): { latitude: number; longitude: number } | null {
  try {
    // Try @lat,lng format
    const coordMatch = googleMapsUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      return {
        latitude: parseFloat(coordMatch[1]),
        longitude: parseFloat(coordMatch[2]),
      };
    }

    // Try !3d and !4d format
    const latMatch = googleMapsUrl.match(/!3d(-?\d+\.?\d*)/);
    const lngMatch = googleMapsUrl.match(/!4d(-?\d+\.?\d*)/);
    if (latMatch && lngMatch) {
      return {
        latitude: parseFloat(latMatch[1]),
        longitude: parseFloat(lngMatch[1]),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract social media links from website
 */
async function extractSocialMedia(page: Page): Promise<SocialMediaLinks> {
  const socialMedia: SocialMediaLinks = {};

  try {
    const links = await page.$$('a[href]');

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (!href) continue;

      const lowerHref = href.toLowerCase();

      if (lowerHref.includes('facebook.com') && !socialMedia.facebook) {
        socialMedia.facebook = href;
      } else if ((lowerHref.includes('instagram.com') || lowerHref.includes('instagr.am')) && !socialMedia.instagram) {
        socialMedia.instagram = href;
      } else if (lowerHref.includes('linkedin.com') && !socialMedia.linkedin) {
        socialMedia.linkedin = href;
      } else if ((lowerHref.includes('twitter.com') || lowerHref.includes('x.com')) && !socialMedia.twitter) {
        socialMedia.twitter = href;
      } else if (lowerHref.includes('youtube.com') && !socialMedia.youtube) {
        socialMedia.youtube = href;
      }
    }
  } catch (error) {
    logger.debug('Failed to extract social media', { error: String(error) });
  }

  return socialMedia;
}

/**
 * Detect if website has a contact form
 */
async function detectContactForm(page: Page): Promise<boolean> {
  try {
    // Look for form elements with contact-related attributes
    const formSelectors = [
      'form[action*="contact"]',
      'form[action*="message"]',
      'form[action*="inquiry"]',
      'form[id*="contact"]',
      'form[class*="contact"]',
      'form[name*="contact"]',
      '#contact-form',
      '.contact-form',
      '[data-form-type="contact"]',
    ];

    for (const selector of formSelectors) {
      const form = await page.$(selector);
      if (form) return true;
    }

    // Look for form with email input and textarea
    const forms = await page.$$('form');
    for (const form of forms) {
      const emailInput = await form.$('input[type="email"], input[name*="email"]');
      const textarea = await form.$('textarea');
      if (emailInput && textarea) return true;
    }

    // Look for contact page indicators
    const pageContent = await page.content();
    const contactIndicators = [
      'contact us',
      'get in touch',
      'send us a message',
      'inquiry form',
      'contact form',
    ];

    const lowerContent = pageContent.toLowerCase();
    for (const indicator of contactIndicators) {
      if (lowerContent.includes(indicator)) {
        const form = await page.$('form');
        if (form) return true;
      }
    }

    return false;
  } catch (error) {
    logger.debug('Failed to detect contact form', { error: String(error) });
    return false;
  }
}

/**
 * Simple review sentiment analysis
 */
function analyzeReviewSentiment(rating?: number, reviewCount?: number): 'positive' | 'neutral' | 'negative' | null {
  if (!rating) return null;

  if (rating >= 4.5 && (reviewCount || 0) >= 10) {
    return 'positive';
  } else if (rating >= 3.5) {
    return 'neutral';
  } else if (rating < 3.0) {
    return 'negative';
  }

  return 'neutral';
}

interface EnrichmentResult {
  emails: string[];
  contactPageUrl?: string;
  websiteUrl?: string;
  socialMedia?: SocialMediaLinks;
  hasContactForm?: boolean;
  businessHours?: string;
  latitude?: number;
  longitude?: number;
  reviewSentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Enrich a single lead with email and contact info
 */
async function enrichLead(
  lead: Lead,
  page: Page,
  settings: AppSettings
): Promise<EnrichmentResult> {
  let websiteUrl = lead.websiteUrl;
  const result: EnrichmentResult = { emails: [] };

  // Extract coordinates from Google Maps URL
  const coords = extractCoordinates(lead.googleMapsUrl);
  if (coords) {
    result.latitude = coords.latitude;
    result.longitude = coords.longitude;
  }

  // Analyze review sentiment
  result.reviewSentiment = analyzeReviewSentiment(lead.rating, lead.reviewCount) || undefined;

  // If no website URL, try to get it from Google Maps
  if (!websiteUrl && lead.googleMapsUrl) {
    logger.info(`Getting website for: ${lead.businessName}`);
    websiteUrl = await extractWebsiteFromGoogleMaps(page, lead.googleMapsUrl, settings) || undefined;
  }

  // Extract business hours if enabled
  if (settings.extractBusinessHours && lead.googleMapsUrl) {
    result.businessHours = await extractBusinessHours(page, lead.googleMapsUrl, settings) || undefined;
  }

  if (!websiteUrl) {
    logger.info(`No website found for: ${lead.businessName}`);
    result.websiteUrl = undefined;
    return result;
  }

  logger.info(`Enriching: ${lead.businessName}`);
  result.websiteUrl = websiteUrl;

  // Mark as in progress
  updateLead(lead.id, { enrichmentStatus: 'in_progress' });

  try {
    const emailResult = await extractEmailsFromWebsite(page, websiteUrl, {
      maxPages: 6,
      timeout: settings.websiteCrawlTimeout,
    });

    result.emails = emailResult.emails;
    result.contactPageUrl = emailResult.contactPageUrl;

    // Extract social media if enabled
    if (settings.extractSocialMedia) {
      result.socialMedia = await extractSocialMedia(page);
    }

    // Detect contact form if enabled
    if (settings.detectContactForms) {
      result.hasContactForm = await detectContactForm(page);
    }

    return result;
  } catch (error) {
    logger.error(`Failed to enrich ${lead.businessName}`, { error: String(error) });
    throw error;
  }
}

/**
 * Run enrichment for a project
 */
export async function runEnrichment(
  projectId: string,
  options: EnrichmentOptions
): Promise<{ enriched: number; errors: number }> {
  const { settings, onProgress, shouldStop } = options;

  if (!enrichmentPage || !enrichmentQueue) {
    throw new Error('Enrichment not initialized');
  }

  isEnriching = true;
  let enrichedCount = 0;
  let errorCount = 0;

  // Get run state to resume from where we left off
  let runState = getRunState(projectId);

  try {
    // Process leads in batches
    while (isEnriching) {
      if (shouldStop?.()) {
        logger.info('Enrichment stopped by user');
        break;
      }

      // Get next batch of pending leads
      const pendingLeads = getPendingEnrichmentLeads(projectId, settings.concurrency * 2);

      if (pendingLeads.length === 0) {
        logger.info('No more leads to enrich');
        break;
      }

      // Get total count for progress
      const allPending = getPendingEnrichmentLeads(projectId, 1000);
      const totalPending = allPending.length;

      // Process each lead
      for (const lead of pendingLeads) {
        if (shouldStop?.() || !isEnriching) break;

        try {
          const result = await enrichLead(lead, enrichmentPage, settings);

          // Calculate score with new data
          const score = calculateLeadScore({
            ...lead,
            websiteUrl: result.websiteUrl,
            emails: result.emails,
          });

          // Update lead with results (including website URL if newly found)
          updateLead(lead.id, {
            emails: result.emails,
            contactPageUrl: result.contactPageUrl || null,
            websiteUrl: result.websiteUrl || lead.websiteUrl || null,
            leadScore: score,
            enrichmentStatus: 'done',
            errorMessage: null,
            socialMedia: result.socialMedia || null,
            hasContactForm: result.hasContactForm ?? null,
            businessHours: result.businessHours || null,
            latitude: result.latitude || null,
            longitude: result.longitude || null,
            reviewSentiment: result.reviewSentiment || null,
          });

          enrichedCount++;
          onProgress?.(enrichedCount, totalPending + enrichedCount, lead.businessName);

          // Update run state
          if (runState) {
            runState.enrichedCount = enrichedCount;
            saveRunState(runState);
          }

          // Delay between enrichments
          await delayWithJitter(settings.delayBetweenActions);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          updateLead(lead.id, {
            enrichmentStatus: 'error',
            errorMessage,
          });

          errorCount++;
          logger.error(`Enrichment error for ${lead.businessName}`, { error: errorMessage });

          // Continue with next lead
          await delayWithJitter(settings.delayBetweenActions);
        }
      }
    }

    logger.info(`Enrichment complete. Enriched: ${enrichedCount}, Errors: ${errorCount}`);
    return { enriched: enrichedCount, errors: errorCount };
  } finally {
    isEnriching = false;
  }
}

/**
 * Pause enrichment
 */
export function pauseEnrichment(): void {
  isEnriching = false;
  if (enrichmentQueue) {
    enrichmentQueue.pause();
  }
  logger.info('Enrichment paused');
}

/**
 * Resume enrichment
 */
export function resumeEnrichment(): void {
  if (enrichmentQueue) {
    enrichmentQueue.resume();
  }
}

/**
 * Check if enrichment is running
 */
export function isEnrichmentRunning(): boolean {
  return isEnriching;
}

/**
 * Mark leads without website as skipped
 */
export function skipLeadsWithoutWebsite(projectId: string): number {
  const { getDatabase } = require('../database');
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE leads
    SET enrichment_status = 'skipped',
        updated_at = ?
    WHERE project_id = ?
    AND (website_url IS NULL OR website_url = '')
    AND enrichment_status = 'pending'
  `);

  const result = stmt.run(new Date().toISOString(), projectId);
  return result.changes;
}
