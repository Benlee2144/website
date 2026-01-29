import type { RawLead } from '../../shared/schemas';

/**
 * Demo data for testing without hitting Google
 */
export const DEMO_LEADS: RawLead[] = [
  {
    businessName: "Joe's Coffee Shop",
    category: 'Coffee shop',
    rating: 4.6,
    reviewCount: 234,
    address: '123 Main St, Springfield, IL 62701',
    phone: '(217) 555-0123',
    websiteUrl: 'https://example.com/joes-coffee',
    googleMapsUrl: 'https://maps.google.com/place/joes-coffee-shop',
  },
  {
    businessName: 'Springfield Auto Repair',
    category: 'Auto repair shop',
    rating: 4.2,
    reviewCount: 89,
    address: '456 Oak Ave, Springfield, IL 62702',
    phone: '(217) 555-0456',
    websiteUrl: 'https://example.com/springfield-auto',
    googleMapsUrl: 'https://maps.google.com/place/springfield-auto-repair',
  },
  {
    businessName: "Maria's Italian Restaurant",
    category: 'Italian restaurant',
    rating: 4.8,
    reviewCount: 567,
    address: '789 Elm St, Springfield, IL 62703',
    phone: '(217) 555-0789',
    websiteUrl: 'https://example.com/marias-italian',
    googleMapsUrl: 'https://maps.google.com/place/marias-italian',
  },
  {
    businessName: 'Quick Print Solutions',
    category: 'Printing service',
    rating: 3.9,
    reviewCount: 45,
    address: '321 Pine Rd, Springfield, IL 62704',
    phone: '(217) 555-0321',
    websiteUrl: undefined, // No website - good for opportunity finder
    googleMapsUrl: 'https://maps.google.com/place/quick-print',
  },
  {
    businessName: 'Sunrise Yoga Studio',
    category: 'Yoga studio',
    rating: 4.9,
    reviewCount: 156,
    address: '654 Maple Dr, Springfield, IL 62705',
    phone: '(217) 555-0654',
    websiteUrl: 'https://example.com/sunrise-yoga',
    googleMapsUrl: 'https://maps.google.com/place/sunrise-yoga',
  },
  {
    businessName: 'City Plumbing Services',
    category: 'Plumber',
    rating: 4.1,
    reviewCount: 78,
    address: '987 Cedar Ln, Springfield, IL 62706',
    phone: '(217) 555-0987',
    websiteUrl: undefined, // No website
    googleMapsUrl: 'https://maps.google.com/place/city-plumbing',
  },
  {
    businessName: 'Green Thumb Landscaping',
    category: 'Landscaping company',
    rating: 4.5,
    reviewCount: 203,
    address: '147 Birch Way, Springfield, IL 62707',
    phone: '(217) 555-0147',
    websiteUrl: 'https://example.com/green-thumb',
    googleMapsUrl: 'https://maps.google.com/place/green-thumb',
  },
  {
    businessName: "Bob's Hardware Store",
    category: 'Hardware store',
    rating: 4.3,
    reviewCount: 312,
    address: '258 Willow St, Springfield, IL 62708',
    phone: '(217) 555-0258',
    websiteUrl: 'https://example.com/bobs-hardware',
    googleMapsUrl: 'https://maps.google.com/place/bobs-hardware',
  },
  {
    businessName: 'Bright Dental Clinic',
    category: 'Dentist',
    rating: 4.7,
    reviewCount: 445,
    address: '369 Spruce Ave, Springfield, IL 62709',
    phone: '(217) 555-0369',
    websiteUrl: 'https://example.com/bright-dental',
    googleMapsUrl: 'https://maps.google.com/place/bright-dental',
  },
  {
    businessName: 'Fitness First Gym',
    category: 'Gym',
    rating: 4.0,
    reviewCount: 189,
    address: '741 Ash Blvd, Springfield, IL 62710',
    phone: '(217) 555-0741',
    websiteUrl: 'https://example.com/fitness-first',
    googleMapsUrl: 'https://maps.google.com/place/fitness-first',
  },
  {
    businessName: 'Pet Paradise Grooming',
    category: 'Pet groomer',
    rating: 4.8,
    reviewCount: 267,
    address: '852 Palm Ct, Springfield, IL 62711',
    phone: '(217) 555-0852',
    websiteUrl: 'https://example.com/pet-paradise',
    googleMapsUrl: 'https://maps.google.com/place/pet-paradise',
  },
  {
    businessName: 'TechFix Computer Repair',
    category: 'Computer repair service',
    rating: 4.4,
    reviewCount: 134,
    address: '963 Oak Park Ave, Springfield, IL 62712',
    phone: '(217) 555-0963',
    websiteUrl: 'https://example.com/techfix',
    googleMapsUrl: 'https://maps.google.com/place/techfix',
  },
];

/**
 * Demo emails to simulate enrichment results
 */
export const DEMO_EMAILS: Record<string, string[]> = {
  "Joe's Coffee Shop": ['contact@joescoffee.com', 'orders@joescoffee.com'],
  'Springfield Auto Repair': ['service@springfieldauto.com'],
  "Maria's Italian Restaurant": ['reservations@marias.com', 'info@marias.com', 'events@marias.com'],
  'Sunrise Yoga Studio': ['hello@sunriseyoga.com', 'classes@sunriseyoga.com'],
  'Green Thumb Landscaping': ['quotes@greenthumb.com'],
  "Bob's Hardware Store": ['sales@bobshardware.com', 'support@bobshardware.com'],
  'Bright Dental Clinic': ['appointments@brightdental.com', 'info@brightdental.com'],
  'Fitness First Gym': ['membership@fitnessfirst.com'],
  'Pet Paradise Grooming': ['bookings@petparadise.com', 'info@petparadise.com'],
  'TechFix Computer Repair': ['support@techfix.com', 'sales@techfix.com'],
};

/**
 * Get demo leads (simulates scraping)
 */
export function getDemoLeads(maxResults: number = 10): RawLead[] {
  return DEMO_LEADS.slice(0, Math.min(maxResults, DEMO_LEADS.length));
}

/**
 * Get demo emails for a business (simulates enrichment)
 */
export function getDemoEmails(businessName: string): string[] {
  return DEMO_EMAILS[businessName] || [];
}

/**
 * Simulate delay for demo mode
 */
export function demoDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
