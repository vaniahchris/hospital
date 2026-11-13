import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parsePatientCsv,
  parsePatientRows,
  parsePatientSpreadsheet,
} from './patient-csv';

describe('parsePatientCsv', () => {
  it('normalizes valid rows and reports invalid and duplicate phone rows', () => {
    const result = parsePatientCsv(
      '\uFEFFName,Phone\nAlice,0775699700\nBad,123\nAlice Again,+256 775 699 700'
    );

    expect(result).toEqual({
      valid: [{ name: 'Alice', phone: '+256775699700' }],
      invalid: 1,
      duplicatePhonesInFile: 1,
    });
  });

  it('accepts telephone-only files and defaults missing names to Patient', () => {
    const result = parsePatientCsv(
      'Queue Date,Telephone\n2026-11-12,256757666701\n2026-11-12,256742120047\n2026-11-12,256757666701'
    );

    expect(result).toEqual({
      valid: [
        { name: 'Patient', phone: '+256757666701' },
        { name: 'Patient', phone: '+256742120047' },
      ],
      invalid: 0,
      duplicatePhonesInFile: 1,
    });
  });

  it('accepts Phone Number headers and blank names', () => {
    const result = parsePatientCsv(
      'NAME,ROOM,PHONE NUMBER\nAURI,,0782772717\n,VIP 10,0774717003'
    );

    expect(result).toEqual({
      valid: [
        { name: 'AURI', phone: '+256782772717' },
        { name: 'Patient', phone: '+256774717003' },
      ],
      invalid: 0,
      duplicatePhonesInFile: 0,
    });
  });

  it('skips title rows before the real header', () => {
    const result = parsePatientCsv(
      'DAILY INPATIENT PHONE NUMBERS,,\nNAME,ROOM,PHONE NUMBER\nNAJJEMBA,PRIVATE 10,774717003'
    );

    expect(result).toEqual({
      valid: [{ name: 'NAJJEMBA', phone: '+256774717003' }],
      invalid: 0,
      duplicatePhonesInFile: 0,
    });
  });
});

describe('parsePatientRows', () => {
  it('reads numeric excel phone cells without a name column', () => {
    const result = parsePatientRows([
      ['Telephone'],
      [256757666701],
      [782772717],
      [''],
    ]);

    expect(result).toEqual({
      valid: [
        { name: 'Patient', phone: '+256757666701' },
        { name: 'Patient', phone: '+256782772717' },
      ],
      invalid: 0,
      duplicatePhonesInFile: 0,
    });
  });
});

describe('parsePatientSpreadsheet', () => {
  it('imports the outpatient telephone export', () => {
    const data = readFileSync(resolve('phone numbers 12th-11-26.xls'));
    const result = parsePatientSpreadsheet(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.valid.length).toBeGreaterThan(50);
    expect(result.valid.every((row) => row.name === 'Patient')).toBe(true);
    expect(result.valid.every((row) => row.phone.startsWith('+2567'))).toBe(true);
  });

  it('imports the inpatient workbook with names', () => {
    const data = readFileSync(resolve('INPATIENT PHONE NUMBERS.xlsx'));
    const result = parsePatientSpreadsheet(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

    expect(result).toMatchObject({
      invalid: 0,
      duplicatePhonesInFile: 0,
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.valid).toEqual(
      expect.arrayContaining([
        { name: 'AURI SEWAALI EZEKIEL', phone: '+256782772717' },
        { name: 'NAJJEMBA GLADYS', phone: '+256774717003' },
      ])
    );
    expect(result.valid).toHaveLength(8);
  });
});
