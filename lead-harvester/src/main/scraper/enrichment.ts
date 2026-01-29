import type { Page } from 'playwright-core';
import { createEnrichmentPage } from './google-maps';
import { extractEmailsFromWebsite } from './email-extractor';
import { TaskQueue, delayWithJitter } from './task-queue';
import { createScopedLogger } from '../utils/logger';
import { calculateLeadScore } from '../utils/scoring';
import { updateLead, getPendingEnrichmentLeads, saveRunState, getRunState, getDatabase } from '../database';
import type { Lead, AppSettings, RunState } from '../../shared/types';

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
 * Enrich a single lead with email and contact info
 */
async function enrichLead(
  lead: Lead,
  page: Page,
  settings: AppSettings
): Promise<{ emails: string[]; contactPageUrl?: string; websiteUrl?: string }> {
  let websiteUrl = lead.websiteUrl;

  // If no website URL, try to get it from Google Maps
  if (!websiteUrl && lead.googleMapsUrl) {
    logger.info(`Getting website for: ${lead.businessName}`);
    websiteUrl = await extractWebsiteFromGoogleMaps(page, lead.googleMapsUrl, settings) || undefined;
  }

  if (!websiteUrl) {
    logger.info(`No website found for: ${lead.businessName}`);
    return { emails: [], websiteUrl: undefined };
  }

  logger.info(`Enriching: ${lead.businessName}`);

  // Mark as in progress
  updateLead(lead.id, { enrichmentStatus: 'in_progress' });

  try {
    const result = await extractEmailsFromWebsite(page, websiteUrl, {
      maxPages: 6,
      timeout: settings.websiteCrawlTimeout,
    });

    return { ...result, websiteUrl };
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
