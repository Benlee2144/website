import * as fs from 'fs';
import type { Lead, Project } from '../../shared/types';

const CSV_COLUMNS = [
  'project_name',
  'business_name',
  'category',
  'rating',
  'review_count',
  'address',
  'phone',
  'website_url',
  'emails',
  'contact_page_url',
  'google_maps_url',
  'lead_score',
  'created_at',
  'updated_at',
  'enrichment_status',
  'error_message',
];

/**
 * Escape a value for CSV format
 */
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If contains comma, quote, newline, or starts/ends with whitespace, wrap in quotes
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.startsWith(' ') ||
    stringValue.endsWith(' ')
  ) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert a lead to a CSV row
 */
function leadToCSVRow(lead: Lead, projectName: string): string {
  const values = [
    projectName,
    lead.businessName,
    lead.category || '',
    lead.rating?.toString() || '',
    lead.reviewCount?.toString() || '',
    lead.address || '',
    lead.phone || '',
    lead.websiteUrl || '',
    lead.emails.join('; '), // Join multiple emails with semicolon
    lead.contactPageUrl || '',
    lead.googleMapsUrl,
    lead.leadScore.toString(),
    lead.createdAt,
    lead.updatedAt,
    lead.enrichmentStatus,
    lead.errorMessage || '',
  ];

  return values.map(escapeCSVValue).join(',');
}

/**
 * Export leads to CSV file
 */
export function exportToCSV(
  leads: Lead[],
  project: Project,
  filePath: string
): { success: boolean; count: number; error?: string } {
  try {
    // Create header row
    const headerRow = CSV_COLUMNS.join(',');

    // Create data rows
    const dataRows = leads.map(lead => leadToCSVRow(lead, project.name));

    // Combine all rows
    const csvContent = [headerRow, ...dataRows].join('\n');

    // Write to file
    fs.writeFileSync(filePath, csvContent, 'utf-8');

    return { success: true, count: leads.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Generate a default filename for CSV export
 */
export function generateCSVFilename(project: Project): string {
  const sanitizedName = project.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `${sanitizedName}_leads_${date}.csv`;
}

/**
 * Parse CSV content back to objects (for testing/import)
 */
export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    results.push(row);
  }

  return results;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          // End of quoted section
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  result.push(current);
  return result;
}
