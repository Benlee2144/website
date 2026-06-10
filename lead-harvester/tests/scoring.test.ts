import { describe, it, expect } from 'vitest';

// Inline the scoring logic for testing (since we can't easily import from main process)
function calculateLeadScore(lead: {
  businessName?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  websiteUrl?: string;
  emails?: string[];
}): number {
  let score = 0;

  if (lead.websiteUrl && lead.websiteUrl.length > 0) {
    score += 15;
  }

  if (lead.phone && lead.phone.length > 0) {
    score += 15;
  }

  if (lead.address && lead.address.length > 0) {
    score += 10;
  }

  if (lead.emails && lead.emails.length > 0) {
    score += 20;
    if (lead.emails.length >= 2) {
      score += 5;
    }
  }

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
  }

  if (lead.category && lead.category.length > 0) {
    score += 5;
  }

  if (lead.businessName && lead.businessName.length > 0) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

describe('Lead Scoring', () => {
  it('should return 0 for empty lead', () => {
    const score = calculateLeadScore({});
    expect(score).toBe(0);
  });

  it('should add 5 points for business name', () => {
    const score = calculateLeadScore({ businessName: 'Test Business' });
    expect(score).toBe(5);
  });

  it('should add 15 points for website', () => {
    const score = calculateLeadScore({
      businessName: 'Test',
      websiteUrl: 'https://example.com',
    });
    expect(score).toBe(20); // 5 (name) + 15 (website)
  });

  it('should add 15 points for phone', () => {
    const score = calculateLeadScore({
      businessName: 'Test',
      phone: '555-1234',
    });
    expect(score).toBe(20); // 5 (name) + 15 (phone)
  });

  it('should add 10 points for address', () => {
    const score = calculateLeadScore({
      businessName: 'Test',
      address: '123 Main St',
    });
    expect(score).toBe(15); // 5 (name) + 10 (address)
  });

  it('should add 20 points for one email', () => {
    const score = calculateLeadScore({
      businessName: 'Test',
      emails: ['test@example.com'],
    });
    expect(score).toBe(25); // 5 (name) + 20 (email)
  });

  it('should add 25 points for multiple emails', () => {
    const score = calculateLeadScore({
      businessName: 'Test',
      emails: ['test@example.com', 'info@example.com'],
    });
    expect(score).toBe(30); // 5 (name) + 25 (emails)
  });

  it('should add points for review count tiers', () => {
    expect(calculateLeadScore({ businessName: 'Test', reviewCount: 1 })).toBe(7); // 5 + 2
    expect(calculateLeadScore({ businessName: 'Test', reviewCount: 5 })).toBe(10); // 5 + 5
    expect(calculateLeadScore({ businessName: 'Test', reviewCount: 20 })).toBe(13); // 5 + 8
    expect(calculateLeadScore({ businessName: 'Test', reviewCount: 50 })).toBe(17); // 5 + 12
    expect(calculateLeadScore({ businessName: 'Test', reviewCount: 100 })).toBe(20); // 5 + 15
  });

  it('should add points for rating tiers', () => {
    expect(calculateLeadScore({ businessName: 'Test', rating: 2.9 })).toBe(5); // 5 + 0
    expect(calculateLeadScore({ businessName: 'Test', rating: 3.0 })).toBe(7); // 5 + 2
    expect(calculateLeadScore({ businessName: 'Test', rating: 3.5 })).toBe(10); // 5 + 5
    expect(calculateLeadScore({ businessName: 'Test', rating: 4.0 })).toBe(13); // 5 + 8
    expect(calculateLeadScore({ businessName: 'Test', rating: 4.5 })).toBe(15); // 5 + 10
  });

  it('should add 5 points for category', () => {
    const score = calculateLeadScore({
      businessName: 'Test',
      category: 'Restaurant',
    });
    expect(score).toBe(10); // 5 (name) + 5 (category)
  });

  it('should calculate high score for complete lead', () => {
    const score = calculateLeadScore({
      businessName: 'Great Restaurant',
      category: 'Restaurant',
      rating: 4.8,
      reviewCount: 250,
      address: '123 Main St, Chicago, IL',
      phone: '(312) 555-1234',
      websiteUrl: 'https://greatrestaurant.com',
      emails: ['contact@greatrestaurant.com', 'reservations@greatrestaurant.com'],
    });
    // 5 (name) + 5 (category) + 10 (rating 4.5+) + 15 (reviews 100+)
    // + 10 (address) + 15 (phone) + 15 (website) + 25 (2 emails) = 100
    expect(score).toBe(100);
  });

  it('should cap score at 100', () => {
    const score = calculateLeadScore({
      businessName: 'Great Restaurant',
      category: 'Restaurant',
      rating: 5.0,
      reviewCount: 1000,
      address: '123 Main St',
      phone: '555-1234',
      websiteUrl: 'https://example.com',
      emails: ['a@example.com', 'b@example.com', 'c@example.com'],
    });
    expect(score).toBe(100);
  });
});
