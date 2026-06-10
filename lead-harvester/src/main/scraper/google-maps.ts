import type { Browser, Page, BrowserContext } from 'playwright-core';
import { chromium } from 'playwright-core';
import { createScopedLogger } from '../utils/logger';
import { delayWithJitter } from './task-queue';
import type { RawLead } from '../../shared/schemas';
import type { AppSettings } from '../../shared/types';

const logger = createScopedLogger('GoogleMaps');

// Selectors for Google Maps (using multiple strategies for resilience)
const SELECTORS = {
  searchBox: 'input#searchboxinput',
  searchButton: 'button#searchbox-searchbutton',
  resultsContainer: 'div[role="feed"]',
  resultItem: 'div[role="feed"] > div > div[jsaction]',
  resultLink: 'a[href*="/maps/place/"]',
  businessName: 'div.fontHeadlineSmall, div.qBF1Pd',
  rating: 'span.MW4etd',
  reviewCount: 'span.UY7F9',
  category: 'div.W4Efsd:nth-child(1) > div:nth-child(2) > span:first-child',
  address: 'div.W4Efsd:nth-child(2) > div:nth-child(1) > span:nth-child(2)',
  detailsPanel: 'div[role="main"]',
  phone: 'button[data-tooltip="Copy phone number"]',
  website: 'a[data-tooltip="Open website"]',
  endOfList: 'span.HlvSq',
  unusualTraffic: 'form[action*="sorry"]',
};

interface ScrapeOptions {
  maxResults: number;
  settings: AppSettings;
  onProgress?: (scraped: number, total: number, current?: string) => void;
  shouldStop?: () => boolean;
}

interface GoogleMapsScraper {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
}

let scraper: GoogleMapsScraper = {
  browser: null,
  context: null,
  page: null,
};

/**
 * Initialize the browser for scraping
 */
export async function initBrowser(settings: AppSettings): Promise<void> {
  if (scraper.browser) {
    return;
  }

  logger.info('Launching browser...');

  scraper.browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  scraper.context = await scraper.browser.newContext({
    userAgent: settings.userAgent,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  scraper.page = await scraper.context.newPage();

  // Block unnecessary resources to speed up scraping
  await scraper.page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'media', 'font'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  logger.info('Browser initialized');
}

/**
 * Close the browser
 */
export async function closeBrowser(): Promise<void> {
  if (scraper.page) {
    await scraper.page.close().catch(() => {});
    scraper.page = null;
  }
  if (scraper.context) {
    await scraper.context.close().catch(() => {});
    scraper.context = null;
  }
  if (scraper.browser) {
    await scraper.browser.close().catch(() => {});
    scraper.browser = null;
  }
  logger.info('Browser closed');
}

/**
 * Check if browser is running
 */
export function isBrowserRunning(): boolean {
  return scraper.browser !== null && scraper.page !== null;
}

/**
 * Check for unusual traffic page (captcha)
 */
async function checkForUnusualTraffic(page: Page): Promise<boolean> {
  try {
    const sorryForm = await page.$(SELECTORS.unusualTraffic);
    if (sorryForm) {
      const url = page.url();
      if (url.includes('sorry') || url.includes('captcha')) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract business data from a single listing element
 */
async function extractListingData(page: Page, element: any): Promise<RawLead | null> {
  try {
    // Get the link to the listing
    const linkElement = await element.$(SELECTORS.resultLink);
    if (!linkElement) return null;

    const googleMapsUrl = await linkElement.getAttribute('href');
    if (!googleMapsUrl) return null;

    // Get business name
    const nameElement = await element.$('div.fontHeadlineSmall, div.qBF1Pd');
    const businessName = nameElement ? await nameElement.textContent() : null;
    if (!businessName) return null;

    // Get rating
    let rating: number | undefined;
    const ratingElement = await element.$('span.MW4etd');
    if (ratingElement) {
      const ratingText = await ratingElement.textContent();
      if (ratingText) {
        rating = parseFloat(ratingText.replace(',', '.'));
      }
    }

    // Get review count
    let reviewCount: number | undefined;
    const reviewElement = await element.$('span.UY7F9');
    if (reviewElement) {
      const reviewText = await reviewElement.textContent();
      if (reviewText) {
        const match = reviewText.match(/\(?([\d,]+)\)?/);
        if (match) {
          reviewCount = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }
    }

    // Get category and address from the info spans
    let category: string | undefined;
    let address: string | undefined;

    const infoSpans = await element.$$('div.W4Efsd span');
    for (const span of infoSpans) {
      const text = await span.textContent();
      if (!text) continue;

      // Category is usually short and doesn't contain numbers
      if (!category && text.length < 50 && !/\d/.test(text) && !text.includes('·')) {
        category = text.trim();
      }
      // Address usually contains numbers or is longer
      if (!address && (text.length > 10 || /\d/.test(text)) && !text.includes('reviews')) {
        address = text.trim();
      }
    }

    return {
      businessName: businessName.trim(),
      category: category?.replace('·', '').trim(),
      rating,
      reviewCount,
      address: address?.replace('·', '').trim(),
      googleMapsUrl,
    };
  } catch (error) {
    logger.debug('Failed to extract listing data', { error: String(error) });
    return null;
  }
}

/**
 * Click on a listing to get detailed info (phone, website)
 */
async function getListingDetails(
  page: Page,
  googleMapsUrl: string,
  settings: AppSettings
): Promise<{ phone?: string; websiteUrl?: string }> {
  const details: { phone?: string; websiteUrl?: string } = {};

  try {
    // Navigate to the listing
    await page.goto(googleMapsUrl, {
      timeout: settings.websiteCrawlTimeout,
      waitUntil: 'domcontentloaded',
    });

    await delayWithJitter(settings.safeMode ? 2000 : 1000);

    // Wait for details panel
    await page.waitForSelector(SELECTORS.detailsPanel, { timeout: 5000 }).catch(() => {});

    // Extract phone number
    const phoneButton = await page.$('button[data-item-id*="phone"]');
    if (phoneButton) {
      const phoneAriaLabel = await phoneButton.getAttribute('aria-label');
      if (phoneAriaLabel) {
        const phoneMatch = phoneAriaLabel.match(/[\d\s\-\+\(\)]+/);
        if (phoneMatch) {
          details.phone = phoneMatch[0].trim();
        }
      }
    }

    // Alternative phone extraction
    if (!details.phone) {
      const phoneTexts = await page.$$eval(
        'button[aria-label*="Phone"], div[data-tooltip*="phone"]',
        (elements) =>
          elements.map((el) => el.getAttribute('aria-label') || el.textContent || '')
      );
      for (const text of phoneTexts) {
        const match = text.match(/[\d\s\-\+\(\)]{7,}/);
        if (match) {
          details.phone = match[0].trim();
          break;
        }
      }
    }

    // Extract website
    const websiteLink = await page.$('a[data-item-id="authority"]');
    if (websiteLink) {
      details.websiteUrl = await websiteLink.getAttribute('href') || undefined;
    }

    // Alternative website extraction
    if (!details.websiteUrl) {
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
          details.websiteUrl = href;
          break;
        }
      }
    }
  } catch (error) {
    logger.debug('Failed to get listing details', { error: String(error) });
  }

  return details;
}

/**
 * Scrape Google Maps search results
 */
export async function scrapeGoogleMaps(
  keyword: string,
  location: string,
  options: ScrapeOptions
): Promise<RawLead[]> {
  const { maxResults, settings, onProgress, shouldStop } = options;
  const results: RawLead[] = [];
  const seenUrls = new Set<string>();

  if (!scraper.page) {
    throw new Error('Browser not initialized');
  }

  const page = scraper.page;

  try {
    // Navigate to Google Maps
    logger.info(`Searching for "${keyword}" in "${location}"`);
    const searchQuery = encodeURIComponent(`${keyword} ${location}`);
    await page.goto(`https://www.google.com/maps/search/${searchQuery}`, {
      timeout: 30000,
      waitUntil: 'networkidle',
    });

    await delayWithJitter(settings.safeMode ? 3000 : 1500);

    // Check for unusual traffic
    if (await checkForUnusualTraffic(page)) {
      throw new Error(
        'Google has detected unusual traffic. Please wait and try again later, or enable Safe Mode.'
      );
    }

    // Wait for results container
    await page.waitForSelector(SELECTORS.resultsContainer, { timeout: 10000 }).catch(() => {
      logger.warn('Results container not found, trying alternative selectors');
    });

    let scrollAttempts = 0;
    const maxScrollAttempts = Math.ceil(maxResults / 5) + 10;
    let lastResultCount = 0;
    let noNewResultsCount = 0;

    // Scroll and collect results
    while (results.length < maxResults && scrollAttempts < maxScrollAttempts) {
      if (shouldStop?.()) {
        logger.info('Scraping stopped by user');
        break;
      }

      // Get all current listing elements
      const listingElements = await page.$$(SELECTORS.resultItem);

      for (const element of listingElements) {
        if (results.length >= maxResults) break;
        if (shouldStop?.()) break;

        const leadData = await extractListingData(page, element);
        if (!leadData || seenUrls.has(leadData.googleMapsUrl)) continue;

        seenUrls.add(leadData.googleMapsUrl);

        // Get detailed info for this listing
        const details = await getListingDetails(page, leadData.googleMapsUrl, settings);

        const fullLead: RawLead = {
          ...leadData,
          phone: details.phone,
          websiteUrl: details.websiteUrl,
        };

        results.push(fullLead);
        onProgress?.(results.length, maxResults, leadData.businessName);

        await delayWithJitter(settings.delayBetweenActions);

        // Navigate back to search results
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await delayWithJitter(settings.safeMode ? 1500 : 800);

        // Check for unusual traffic after each listing
        if (await checkForUnusualTraffic(page)) {
          throw new Error(
            'Google has detected unusual traffic. Stopping to prevent blocks.'
          );
        }
      }

      // Check if we got new results
      if (results.length === lastResultCount) {
        noNewResultsCount++;
        if (noNewResultsCount >= 3) {
          logger.info('No new results found, ending search');
          break;
        }
      } else {
        noNewResultsCount = 0;
        lastResultCount = results.length;
      }

      // Scroll to load more results
      const feed = await page.$(SELECTORS.resultsContainer);
      if (feed) {
        await feed.evaluate((el) => {
          el.scrollTo(0, el.scrollHeight);
        });
      }

      await delayWithJitter(settings.safeMode ? 2000 : 1000);
      scrollAttempts++;

      // Check for end of list
      const endMarker = await page.$(SELECTORS.endOfList);
      if (endMarker) {
        const endText = await endMarker.textContent();
        if (endText?.toLowerCase().includes("you've reached the end")) {
          logger.info('Reached end of results');
          break;
        }
      }
    }

    logger.info(`Scraping complete. Found ${results.length} leads.`);
    return results;
  } catch (error) {
    logger.error('Scraping failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get page instance for enrichment
 */
export function getPage(): Page | null {
  return scraper.page;
}

/**
 * Create a new page for enrichment (separate from main scraping)
 */
export async function createEnrichmentPage(settings: AppSettings): Promise<Page | null> {
  if (!scraper.context) {
    return null;
  }

  const page = await scraper.context.newPage();

  // Block images and media for faster loading
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'media', 'font'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return page;
}
