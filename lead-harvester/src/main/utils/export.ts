import * as fs from 'fs';
import type { Lead, Project, Tag } from '../../shared/types';
import { getTagsForLead } from '../database';

type ExportFormat = 'csv' | 'json' | 'xlsx';

const EXPORT_COLUMNS = [
  'project_name',
  'business_name',
  'category',
  'rating',
  'review_count',
  'address',
  'phone',
  'website_url',
  'emails',
  'tags',
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

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.startsWith(' ') ||
    stringValue.endsWith(' ')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert a lead to a CSV row
 */
function leadToCSVRow(lead: Lead, projectName: string, tags: Tag[]): string {
  const values = [
    projectName,
    lead.businessName,
    lead.category || '',
    lead.rating?.toString() || '',
    lead.reviewCount?.toString() || '',
    lead.address || '',
    lead.phone || '',
    lead.websiteUrl || '',
    lead.emails.join('; '),
    tags.map(t => t.name).join('; '),
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
 * Convert a lead to JSON object for export
 */
function leadToJSON(lead: Lead, projectName: string, tags: Tag[]): Record<string, any> {
  return {
    projectName,
    businessName: lead.businessName,
    category: lead.category || null,
    rating: lead.rating || null,
    reviewCount: lead.reviewCount || null,
    address: lead.address || null,
    phone: lead.phone || null,
    websiteUrl: lead.websiteUrl || null,
    emails: lead.emails,
    tags: tags.map(t => ({ name: t.name, color: t.color })),
    contactPageUrl: lead.contactPageUrl || null,
    googleMapsUrl: lead.googleMapsUrl,
    leadScore: lead.leadScore,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    enrichmentStatus: lead.enrichmentStatus,
    errorMessage: lead.errorMessage || null,
  };
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
    const headerRow = EXPORT_COLUMNS.join(',');
    const dataRows = leads.map(lead => {
      const tags = getTagsForLead(lead.id);
      return leadToCSVRow(lead, project.name, tags);
    });
    const csvContent = [headerRow, ...dataRows].join('\n');
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    return { success: true, count: leads.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Export leads to JSON file
 */
export function exportToJSON(
  leads: Lead[],
  project: Project,
  filePath: string
): { success: boolean; count: number; error?: string } {
  try {
    const data = {
      exportDate: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        keyword: project.keyword,
        location: project.location,
      },
      totalLeads: leads.length,
      leads: leads.map(lead => {
        const tags = getTagsForLead(lead.id);
        return leadToJSON(lead, project.name, tags);
      }),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, count: leads.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Export leads to Excel file (XLSX)
 * Uses a simple XML-based format that Excel can read
 */
export function exportToExcel(
  leads: Lead[],
  project: Project,
  filePath: string
): { success: boolean; count: number; error?: string } {
  try {
    // Create simple XML spreadsheet format
    const rows: string[][] = [EXPORT_COLUMNS];

    for (const lead of leads) {
      const tags = getTagsForLead(lead.id);
      rows.push([
        project.name,
        lead.businessName,
        lead.category || '',
        lead.rating?.toString() || '',
        lead.reviewCount?.toString() || '',
        lead.address || '',
        lead.phone || '',
        lead.websiteUrl || '',
        lead.emails.join('; '),
        tags.map(t => t.name).join('; '),
        lead.contactPageUrl || '',
        lead.googleMapsUrl,
        lead.leadScore.toString(),
        lead.createdAt,
        lead.updatedAt,
        lead.enrichmentStatus,
        lead.errorMessage || '',
      ]);
    }

    // Build XML spreadsheet
    const xmlRows = rows.map(row => {
      const cells = row.map(cell => {
        const escaped = escapeXML(cell);
        const isNumber = /^-?\d+\.?\d*$/.test(cell);
        return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escaped}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Leads">
    <Table>
      <Row ss:StyleID="Header">
        ${rows[0].map(h => `<Cell><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`).join('')}
      </Row>
      ${rows.slice(1).map(row => {
        const cells = row.map(cell => {
          const escaped = escapeXML(cell);
          const isNumber = /^-?\d+\.?\d*$/.test(cell);
          return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escaped}</Data></Cell>`;
        }).join('');
        return `<Row>${cells}</Row>`;
      }).join('\n')}
    </Table>
  </Worksheet>
</Workbook>`;

    fs.writeFileSync(filePath, xml, 'utf-8');
    return { success: true, count: leads.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Escape special characters for XML
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export leads in specified format
 */
export function exportLeads(
  leads: Lead[],
  project: Project,
  filePath: string,
  format: ExportFormat = 'csv'
): { success: boolean; count: number; error?: string } {
  switch (format) {
    case 'json':
      return exportToJSON(leads, project, filePath);
    case 'xlsx':
      return exportToExcel(leads, project, filePath);
    case 'csv':
    default:
      return exportToCSV(leads, project, filePath);
  }
}

/**
 * Generate a default filename for export
 */
export function generateExportFilename(project: Project, format: ExportFormat = 'csv'): string {
  const sanitizedName = project.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  const extension = format === 'xlsx' ? 'xls' : format;
  return `${sanitizedName}_leads_${date}.${extension}`;
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
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
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
