import { normalizeUgandanPhone } from './phone';

export type CsvPatient = {
  name: string;
  phone: string;
};

export type CsvPreview =
  | { error: string }
  | { valid: CsvPatient[]; invalid: number; duplicatePhonesInFile: number };

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

export function parsePatientCsv(text: string): CsvPreview {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { error: 'Empty file' };

  const headers = parseCsvRow(lines[0]).map((header) => header.toLowerCase());
  const nameIndex = headers.indexOf('name');
  const phoneIndex = headers.indexOf('phone');
  if (nameIndex < 0 || phoneIndex < 0) {
    return { error: 'CSV must have name and phone columns' };
  }

  const valid: CsvPatient[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicatePhonesInFile = 0;

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const name = values[nameIndex]?.trim() ?? '';
    const phone = normalizeUgandanPhone(values[phoneIndex] ?? '');
    if (!name || !phone) {
      invalid += 1;
    } else if (seen.has(phone)) {
      duplicatePhonesInFile += 1;
    } else {
      seen.add(phone);
      valid.push({ name, phone });
    }
  }

  return { valid, invalid, duplicatePhonesInFile };
}
