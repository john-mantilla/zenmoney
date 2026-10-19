import { describe, it, expect } from 'vitest';
import { getLocalDateString } from '../../utils/dateUtils';

describe('getLocalDateString', () => {
  it('should return YYYY-MM-DD formatted date in local time', () => {
    const testDate = new Date(2026, 9, 18, 20, 38, 0); // Oct 18, 2026 at 20:38 local
    expect(getLocalDateString(testDate)).toBe('2026-10-18');
  });

  it('should pad single-digit months and days with leading zeros', () => {
    const testDate = new Date(2026, 0, 5, 8, 5, 0); // Jan 5, 2026
    expect(getLocalDateString(testDate)).toBe('2026-01-05');
  });

  it('should default to current local date if no date provided', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(getLocalDateString()).toBe(expected);
  });
});
