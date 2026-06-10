import { z } from 'zod';

// Project creation/update schema
export const ProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  keyword: z.string().min(1, 'Keyword is required').max(200),
  location: z.string().min(1, 'Location is required').max(200),
  radius: z.number().min(1).max(100).optional(),
  maxResults: z.number().min(1).max(500).default(50),
  notes: z.string().max(1000).optional(),
});

export type ProjectInput = z.infer<typeof ProjectSchema>;

// Settings schema
export const SettingsSchema = z.object({
  safeMode: z.boolean(),
  concurrency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  delayBetweenActions: z.number().min(500).max(10000),
  maxResultsDefault: z.number().min(10).max(500),
  websiteCrawlTimeout: z.number().min(5000).max(60000),
  userAgent: z.string().min(10),
  showOnboarding: z.boolean(),
});

// Lead filter schema
export const LeadFiltersSchema = z.object({
  hasEmail: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  minRating: z.number().min(0).max(5).optional(),
  minReviews: z.number().min(0).optional(),
  showDuplicates: z.boolean().optional(),
  opportunityFinder: z.boolean().optional(),
  searchQuery: z.string().optional(),
});

// Export options schema
export const ExportOptionsSchema = z.object({
  projectId: z.string().uuid(),
  filters: LeadFiltersSchema.optional(),
  filePath: z.string().min(1),
});

// Extracted lead data from scraping (before scoring)
export const RawLeadSchema = z.object({
  businessName: z.string(),
  category: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  googleMapsUrl: z.string(),
});

export type RawLead = z.infer<typeof RawLeadSchema>;

// Email extraction result
export const EmailExtractionSchema = z.object({
  emails: z.array(z.string().email()),
  contactPageUrl: z.string().url().optional(),
});

export type EmailExtraction = z.infer<typeof EmailExtractionSchema>;
