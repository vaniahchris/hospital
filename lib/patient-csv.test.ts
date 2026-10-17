import { describe, expect, it } from 'vitest';
import { parsePatientCsv } from './patient-csv';

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

  it('requires name and phone headers', () => {
    expect(parsePatientCsv('Patient,Mobile\nAlice,0775699700')).toEqual({
      error: 'CSV must have name and phone columns',
    });
  });
});
