import type { Lead } from '../../shared/types';

/**
 * Calculate lead score (0-100) based on available data
 * Higher scores indicate more complete and valuable leads
 */
export function calculateLeadScore(lead: Partial<Lead>): number {
  let score = 0;

  // Base points for having essential info
  if (lead.websiteUrl && lead.websiteUrl.length > 0) {
    score += 15; // Website is valuable
  }

  if (lead.phone && lead.phone.length > 0) {
    score += 15; // Phone is essential for outreach
  }

  if (lead.address && lead.address.length > 0) {
    score += 10; // Address helps with location-based services
  }

  // Email is highly valuable
  if (lead.emails && lead.emails.length > 0) {
    score += 20; // At least one email
    if (lead.emails.length >= 2) {
      score += 5; // Multiple contacts
    }
  }

  // Review count indicates business activity
  if (lead.reviewCount !== undefined && lead.reviewCount !== null) {
    if (lead.reviewCount >= 100) {
      score += 15;
    } else if (lead.reviewCount >= 50) {
      score += 12;
    } else if (lead.reviewCount >= 20) {
      score += 8;
    } else if (lead.reviewCount >= 5) {
      score += 5;
    } else if (lead.reviewCount > 0) {
      score += 2;
    }
  }

  // Rating quality
  if (lead.rating !== undefined && lead.rating !== null) {
    if (lead.rating >= 4.5) {
      score += 10;
    } else if (lead.rating >= 4.0) {
      score += 8;
    } else if (lead.rating >= 3.5) {
      score += 5;
    } else if (lead.rating >= 3.0) {
      score += 2;
    }
    // Low ratings (<3.0) get no bonus
  }

  // Category present
  if (lead.category && lead.category.length > 0) {
    score += 5;
  }

  // Business name quality (not generic)
  if (lead.businessName && lead.businessName.length > 0) {
    score += 5;
  }

  // Cap at 100
  return Math.min(100, Math.max(0, score));
}

/**
 * Determine if a lead is a good opportunity for outreach
 * (has phone but missing website or email)
 */
export function isOpportunityLead(lead: Lead): boolean {
  const hasPhone = Boolean(lead.phone && lead.phone.length > 0);
  const hasWebsite = Boolean(lead.websiteUrl && lead.websiteUrl.length > 0);
  const hasEmail = Boolean(lead.emails && lead.emails.length > 0);

  return hasPhone && (!hasWebsite || !hasEmail);
}

/**
 * Get score breakdown for display
 */
export function getScoreBreakdown(lead: Lead): { factor: string; points: number }[] {
  const breakdown: { factor: string; points: number }[] = [];

  if (lead.websiteUrl && lead.websiteUrl.length > 0) {
    breakdown.push({ factor: 'Has website', points: 15 });
  }

  if (lead.phone && lead.phone.length > 0) {
    breakdown.push({ factor: 'Has phone', points: 15 });
  }

  if (lead.address && lead.address.length > 0) {
    breakdown.push({ factor: 'Has address', points: 10 });
  }

  if (lead.emails && lead.emails.length > 0) {
    breakdown.push({ factor: 'Has email(s)', points: lead.emails.length >= 2 ? 25 : 20 });
  }

  if (lead.reviewCount !== undefined && lead.reviewCount !== null) {
    if (lead.reviewCount >= 100) {
      breakdown.push({ factor: '100+ reviews', points: 15 });
    } else if (lead.reviewCount >= 50) {
      breakdown.push({ factor: '50+ reviews', points: 12 });
    } else if (lead.reviewCount >= 20) {
      breakdown.push({ factor: '20+ reviews', points: 8 });
    } else if (lead.reviewCount >= 5) {
      breakdown.push({ factor: '5+ reviews', points: 5 });
    } else if (lead.reviewCount > 0) {
      breakdown.push({ factor: 'Has reviews', points: 2 });
    }
  }

  if (lead.rating !== undefined && lead.rating !== null) {
    if (lead.rating >= 4.5) {
      breakdown.push({ factor: 'Rating 4.5+', points: 10 });
    } else if (lead.rating >= 4.0) {
      breakdown.push({ factor: 'Rating 4.0+', points: 8 });
    } else if (lead.rating >= 3.5) {
      breakdown.push({ factor: 'Rating 3.5+', points: 5 });
    } else if (lead.rating >= 3.0) {
      breakdown.push({ factor: 'Rating 3.0+', points: 2 });
    }
  }

  if (lead.category && lead.category.length > 0) {
    breakdown.push({ factor: 'Has category', points: 5 });
  }

  if (lead.businessName && lead.businessName.length > 0) {
    breakdown.push({ factor: 'Has business name', points: 5 });
  }

  return breakdown;
}
