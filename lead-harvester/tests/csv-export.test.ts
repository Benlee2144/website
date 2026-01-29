import { describe, it, expect } from 'vitest';

// CSV export utilities (inline for testing)
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

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
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

describe('CSV Export', () => {
  describe('escapeCSVValue', () => {
    it('should return empty string for null/undefined', () => {
      expect(escapeCSVValue(null)).toBe('');
      expect(escapeCSVValue(undefined)).toBe('');
    });

    it('should return plain string for simple values', () => {
      expect(escapeCSVValue('hello')).toBe('hello');
      expect(escapeCSVValue('simple text')).toBe('simple text');
      expect(escapeCSVValue('123')).toBe('123');
    });

    it('should convert numbers to strings', () => {
      expect(escapeCSVValue(123)).toBe('123');
      expect(escapeCSVValue(45.67)).toBe('45.67');
    });

    it('should quote values containing commas', () => {
      expect(escapeCSVValue('hello, world')).toBe('"hello, world"');
      expect(escapeCSVValue('one, two, three')).toBe('"one, two, three"');
    });

    it('should quote and escape values containing quotes', () => {
      expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
      expect(escapeCSVValue('it\'s "great"')).toBe('"it\'s ""great"""');
    });

    it('should quote values containing newlines', () => {
      expect(escapeCSVValue('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCSVValue('line1\r\nline2')).toBe('"line1\r\nline2"');
    });

    it('should quote values with leading/trailing spaces', () => {
      expect(escapeCSVValue(' leading')).toBe('" leading"');
      expect(escapeCSVValue('trailing ')).toBe('"trailing "');
      expect(escapeCSVValue(' both ')).toBe('" both "');
    });
  });

  describe('parseCSVLine', () => {
    it('should parse simple values', () => {
      expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(parseCSVLine('one,two,three')).toEqual(['one', 'two', 'three']);
    });

    it('should handle empty values', () => {
      expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
      expect(parseCSVLine(',,')).toEqual(['', '', '']);
    });

    it('should parse quoted values', () => {
      expect(parseCSVLine('"hello",world')).toEqual(['hello', 'world']);
      expect(parseCSVLine('one,"two",three')).toEqual(['one', 'two', 'three']);
    });

    it('should handle commas in quoted values', () => {
      expect(parseCSVLine('"hello, world",test')).toEqual(['hello, world', 'test']);
    });

    it('should handle escaped quotes', () => {
      expect(parseCSVLine('"say ""hello""",test')).toEqual(['say "hello"', 'test']);
    });

    it('should handle newlines in quoted values', () => {
      expect(parseCSVLine('"line1\nline2",test')).toEqual(['line1\nline2', 'test']);
    });
  });

  describe('parseCSV', () => {
    it('should return empty array for empty content', () => {
      expect(parseCSV('')).toEqual([]);
      expect(parseCSV('\n\n')).toEqual([]);
    });

    it('should parse simple CSV', () => {
      const csv = `name,email,phone
John,john@example.com,555-1234
Jane,jane@example.com,555-5678`;

      const result = parseCSV(csv);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        phone: '555-1234',
      });
      expect(result[1]).toEqual({
        name: 'Jane',
        email: 'jane@example.com',
        phone: '555-5678',
      });
    });

    it('should handle quoted values with commas', () => {
      const csv = `name,address
"Doe, John","123 Main St, Suite 100"`;

      const result = parseCSV(csv);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Doe, John');
      expect(result[0].address).toBe('123 Main St, Suite 100');
    });

    it('should handle empty fields', () => {
      const csv = `name,email,phone
John,,555-1234`;

      const result = parseCSV(csv);
      expect(result[0].email).toBe('');
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through escape and parse', () => {
      const testCases = [
        'simple',
        'with, comma',
        'with "quotes"',
        'with\nnewline',
        ' leading space',
        'trailing space ',
        '"complex, value\nwith "quotes""',
      ];

      testCases.forEach((value) => {
        const escaped = escapeCSVValue(value);
        const csv = `header\n${escaped}`;
        const parsed = parseCSV(csv);
        expect(parsed[0].header).toBe(value);
      });
    });
  });
});
