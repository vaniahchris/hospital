import * as XLSX from 'xlsx';
import { normalizeUgandanPhone } from './phone';

export type CsvPatient = {
  name: string;
  phone: string;
};

export type CsvPreview =
  | { error: string }
  | { valid: CsvPatient[]; invalid: number; duplicatePhonesInFile: number };

const DEFAULT_NAME = 'Patient';

const PHONE_HEADERS = new Set([
  'phone',
  'telephone',
  'phone number',
  'phonenumber',
  'mobile',
  'mobile number',
  'cell',
  'cellphone',
  'cell phone',
  'contact',
  'contact number',
  'tel',
  'msisdn',
]);

const NAME_HEADERS = new Set([
  'name',
  'patient',
  'patient name',
  'fullname',
  'full name',
  'client',
  'client name',
]);

function parseCsvRow(line: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function cellText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(Math.trunc(value));
  }
  return String(value).trim();
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePhone(value: string) {
  return normalizeUgandanPhone(value) !== null;
}

function fuzzyPhoneHeader(header: string) {
  // Avoid matching title rows like "DAILY INPATIENT PHONE NUMBERS".
  if (header.split(' ').length > 3) return false;
  return (
    header === 'phone' ||
    header.endsWith(' phone') ||
    header.startsWith('phone ') ||
    header.includes('telephone') ||
    header.includes('mobile') ||
    header.includes('msisdn') ||
    /(^| )tel( |$)/.test(header)
  );
}

function findColumns(rows: string[][]) {
  const scanLimit = Math.min(rows.length, 20);

  // Prefer an exact header match (NAME / PHONE NUMBER) over fuzzy title text.
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeHeader);
    const phoneIndex = headers.findIndex((header) => PHONE_HEADERS.has(header));
    if (phoneIndex < 0) continue;
    const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
    return { headerRowIndex: rowIndex, phoneIndex, nameIndex };
  }

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeHeader);
    const phoneIndex = headers.findIndex(fuzzyPhoneHeader);
    if (phoneIndex < 0) continue;
    const nameIndex = headers.findIndex((header) => NAME_HEADERS.has(header));
    return { headerRowIndex: rowIndex, phoneIndex, nameIndex };
  }

  // No labeled phone column — pick the column with the most valid phones.
  let bestIndex = -1;
  let bestCount = 0;
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  for (let column = 0; column < width; column += 1) {
    let count = 0;
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 40); rowIndex += 1) {
      if (looksLikePhone(rows[rowIndex][column] ?? '')) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      bestIndex = column;
    }
  }

  if (bestIndex >= 0 && bestCount > 0) {
    return { headerRowIndex: -1, phoneIndex: bestIndex, nameIndex: -1 };
  }

  return null;
}

export function parsePatientRows(rawRows: unknown[][]): CsvPreview {
  const rows = rawRows
    .map((row) => (Array.isArray(row) ? row.map(cellText) : []))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (!rows.length) return { error: 'Empty file' };

  const columns = findColumns(rows);
  if (!columns) {
    return {
      error:
        'Could not find a phone column. Use a Telephone / Phone / Phone Number column, or a CSV with phone values.',
    };
  }

  const { headerRowIndex, phoneIndex, nameIndex } = columns;
  const dataRows = headerRowIndex >= 0 ? rows.slice(headerRowIndex + 1) : rows;

  const valid: CsvPatient[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicatePhonesInFile = 0;

  for (const values of dataRows) {
    const rawPhone = values[phoneIndex] ?? '';
    const rawName = nameIndex >= 0 ? (values[nameIndex] ?? '').trim() : '';

    // Skip fully empty data rows (common trailing blanks in Excel).
    if (!rawPhone && !rawName) continue;

    const phone = normalizeUgandanPhone(rawPhone);
    if (!phone) {
      invalid += 1;
      continue;
    }

    if (seen.has(phone)) {
      duplicatePhonesInFile += 1;
      continue;
    }

    seen.add(phone);
    valid.push({
      name: rawName || DEFAULT_NAME,
      phone,
    });
  }

  if (!valid.length && invalid === 0 && duplicatePhonesInFile === 0) {
    return { error: 'No phone numbers found in this file.' };
  }

  return { valid, invalid, duplicatePhonesInFile };
}

export function parsePatientCsv(text: string): CsvPreview {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { error: 'Empty file' };
  return parsePatientRows(lines.map(parseCsvRow));
}

export function parsePatientSpreadsheet(data: ArrayBuffer): CsvPreview {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { error: 'Empty workbook' };
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
  return parsePatientRows(rows);
}

export async function parsePatientImportFile(file: File): Promise<CsvPreview> {
  const lower = file.name.toLowerCase();
  const isSpreadsheet =
    lower.endsWith('.xls') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xlsm') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel');

  if (isSpreadsheet) {
    return parsePatientSpreadsheet(await file.arrayBuffer());
  }

  if (
    lower.endsWith('.csv') ||
    lower.endsWith('.txt') ||
    file.type.includes('csv') ||
    file.type === 'text/plain' ||
    file.type === ''
  ) {
    return parsePatientCsv(await file.text());
  }

  // Last resort: try spreadsheet, then CSV.
  try {
    const spreadsheet = parsePatientSpreadsheet(await file.arrayBuffer());
    if (!('error' in spreadsheet)) return spreadsheet;
  } catch {
    // Fall through to CSV.
  }

  return parsePatientCsv(await file.text());
}
