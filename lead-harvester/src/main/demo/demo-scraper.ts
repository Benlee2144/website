import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import { getDemoLeads, getDemoEmails, demoDelay } from './fixtures';
import { calculateLeadScore } from '../utils/scoring';
import { initLogger, clearLogger, createScopedLogger } from '../utils/logger';
import {
  getProject,
  updateProject,
  createLead,
  updateLead,
  getRunState,
  saveRunState,
  deleteRunState,
  getSettings,
  deleteLeadsByProject,
  getPendingEnrichmentLeads,
} from '../database';
import type { ScrapeProgress } from '../../shared/types';

const logger = createScopedLogger('DemoScraper');

let isDemoRunning = false;
let shouldStopDemo = false;

/**
 * Broadcast progress to all windows
 */
function broadcastProgress(progress: ScrapeProgress): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('scraper:progress', progress);
    }
  }
}

/**
 * Run demo mode scraping (no real browser, uses fixtures)
 */
export async function runDemoMode(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  if (isDemoRunning) {
    throw new Error('Demo run already in progress');
  }

  isDemoRunning = true;
  shouldStopDemo = false;

  const settings = getSettings();
  const runId = uuidv4();

  // Initialize logger
  initLogger(projectId, runId);
  logger.info(`Starting DEMO run for project: ${project.name}`);

  // Update project status
  updateProject(projectId, { status: 'running' });

  broadcastProgress({
    phase: 'starting',
    totalFound: 0,
    scraped: 0,
    enriched: 0,
    errors: 0,
    message: '[DEMO MODE] Initializing...',
  });

  try {
    // Clear old data
    deleteLeadsByProject(projectId);
    deleteRunState(projectId);

    // Get demo leads
    const demoLeads = getDemoLeads(project.maxResults);
    const totalLeads = demoLeads.length;

    // Simulate scraping phase
    broadcastProgress({
      phase: 'scraping',
      totalFound: totalLeads,
      scraped: 0,
      enriched: 0,
      errors: 0,
      message: `[DEMO MODE] Found ${totalLeads} demo leads...`,
    });

    // Create run state
    const runState = {
      projectId,
      phase: 'scraping' as const,
      scrollPosition: 0,
      scrapedCount: 0,
      enrichedCount: 0,
      pendingEnrichmentIds: [] as string[],
      startedAt: new Date().toISOString(),
    };
    saveRunState(runState);

    // Simulate adding leads one by one
    for (let i = 0; i < demoLeads.length; i++) {
      if (shouldStopDemo) {
        logger.info('Demo stopped by user');
        break;
      }

      const rawLead = demoLeads[i];

      // Simulate delay
      await demoDelay(300);

      // Calculate initial score
      const score = calculateLeadScore({
        businessName: rawLead.businessName,
        category: rawLead.category,
        rating: rawLead.rating,
        reviewCount: rawLead.reviewCount,
        address: rawLead.address,
        phone: rawLead.phone,
        websiteUrl: rawLead.websiteUrl,
        emails: [],
      });

      // Create lead
      const lead = createLead({
        projectId,
        businessName: rawLead.businessName,
        category: rawLead.category,
        rating: rawLead.rating,
        reviewCount: rawLead.reviewCount,
        address: rawLead.address,
        phone: rawLead.phone,
        websiteUrl: rawLead.websiteUrl,
        googleMapsUrl: rawLead.googleMapsUrl,
      });

      updateLead(lead.id, { leadScore: score });

      broadcastProgress({
        phase: 'scraping',
        totalFound: totalLeads,
        scraped: i + 1,
        enriched: 0,
        errors: 0,
        currentItem: rawLead.businessName,
        message: `[DEMO MODE] Scraped ${i + 1}/${totalLeads}...`,
      });
    }

    if (shouldStopDemo) {
      updateProject(projectId, { status: 'idle' });
      broadcastProgress({
        phase: 'completed',
        totalFound: totalLeads,
        scraped: demoLeads.length,
        enriched: 0,
        errors: 0,
        message: '[DEMO MODE] Run stopped by user',
      });
      return;
    }

    // Update run state for enrichment
    runState.phase = 'enriching';
    runState.scrapedCount = demoLeads.length;
    saveRunState(runState);

    // Enrichment phase
    broadcastProgress({
      phase: 'enriching',
      totalFound: totalLeads,
      scraped: totalLeads,
      enriched: 0,
      errors: 0,
      message: '[DEMO MODE] Starting enrichment...',
    });

    // Get leads that have websites
    const leadsToEnrich = getPendingEnrichmentLeads(projectId, 100);
    let enrichedCount = 0;

    for (const lead of leadsToEnrich) {
      if (shouldStopDemo) {
        logger.info('Demo enrichment stopped by user');
        break;
      }

      // Simulate delay
      await demoDelay(200);

      // Get demo emails
      const emails = getDemoEmails(lead.businessName);

      // Calculate updated score
      const score = calculateLeadScore({
        ...lead,
        emails,
      });

      // Update lead
      updateLead(lead.id, {
        emails,
        contactPageUrl: lead.websiteUrl ? `${lead.websiteUrl}/contact` : undefined,
        leadScore: score,
        enrichmentStatus: 'done',
      });

      enrichedCount++;

      broadcastProgress({
        phase: 'enriching',
        totalFound: totalLeads,
        scraped: totalLeads,
        enriched: enrichedCount,
        errors: 0,
        currentItem: lead.businessName,
        message: `[DEMO MODE] Enriched ${enrichedCount}/${leadsToEnrich.length}...`,
      });
    }

    // Mark completion
    runState.phase = 'completed';
    runState.enrichedCount = enrichedCount;
    saveRunState(runState);

    updateProject(projectId, { status: 'completed' });

    broadcastProgress({
      phase: 'completed',
      totalFound: totalLeads,
      scraped: totalLeads,
      enriched: enrichedCount,
      errors: 0,
      message: '[DEMO MODE] Run completed successfully!',
    });

    logger.info(`Demo run completed. Scraped: ${totalLeads}, Enriched: ${enrichedCount}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Demo run failed', { error: errorMessage });

    updateProject(projectId, { status: 'error' });

    broadcastProgress({
      phase: 'error',
      totalFound: 0,
      scraped: 0,
      enriched: 0,
      errors: 1,
      message: `[DEMO MODE] Error: ${errorMessage}`,
    });

    throw error;
  } finally {
    isDemoRunning = false;
    shouldStopDemo = false;
    clearLogger();
  }
}

/**
 * Stop demo mode
 */
export function stopDemoMode(): void {
  shouldStopDemo = true;
}

/**
 * Check if demo is running
 */
export function isDemoModeRunning(): boolean {
  return isDemoRunning;
}
