import { describe, it, expect } from 'vitest';
import {
  getPackagingType,
  getPackagingLabel,
  getNoPackagingLabel,
  getDraftOnlyMessage,
  getPackagingAtLocationsMessage,
} from '@/lib/utils/packaging-utils';

describe('getPackagingType', () => {
  it('returns "cans" when beer has fourPack but no bottlePrice', () => {
    expect(getPackagingType({ fourPack: 15, bottlePrice: null })).toBe('cans');
  });

  it('returns "bottles" when beer has bottlePrice but no fourPack', () => {
    expect(getPackagingType({ fourPack: null, bottlePrice: 12 })).toBe('bottles');
  });

  it('returns "cans_and_bottles" when beer has both', () => {
    expect(getPackagingType({ fourPack: 15, bottlePrice: 12 })).toBe('cans_and_bottles');
  });

  it('returns "cans" as fallback when neither is set', () => {
    expect(getPackagingType({ fourPack: null, bottlePrice: null })).toBe('cans');
  });

  it('returns "cans" when fourPack is set and bottlePrice is undefined', () => {
    expect(getPackagingType({ fourPack: 15 } as any)).toBe('cans');
  });

  it('returns "bottles" when bottlePrice is set and fourPack is undefined', () => {
    expect(getPackagingType({ bottlePrice: 12 } as any)).toBe('bottles');
  });

  it('ignores zero values (treats as not set)', () => {
    expect(getPackagingType({ fourPack: 0, bottlePrice: 12 })).toBe('bottles');
    expect(getPackagingType({ fourPack: 15, bottlePrice: 0 })).toBe('cans');
  });
});

describe('getPackagingLabel', () => {
  it('returns correct labels', () => {
    expect(getPackagingLabel('cans')).toBe('Cans Available');
    expect(getPackagingLabel('bottles')).toBe('Bottles Available');
    expect(getPackagingLabel('cans_and_bottles')).toBe('Cans & Bottles Available');
  });
});

describe('getNoPackagingLabel', () => {
  it('returns correct labels', () => {
    expect(getNoPackagingLabel('cans')).toBe('No Cans');
    expect(getNoPackagingLabel('bottles')).toBe('No Bottles');
    expect(getNoPackagingLabel('cans_and_bottles')).toBe('No Cans or Bottles');
  });
});

describe('getDraftOnlyMessage', () => {
  it('returns correct messages', () => {
    expect(getDraftOnlyMessage('cans')).toContain('No cans available');
    expect(getDraftOnlyMessage('bottles')).toContain('No bottles available');
    expect(getDraftOnlyMessage('cans_and_bottles')).toContain('No cans or bottles available');
  });
});

describe('getPackagingAtLocationsMessage', () => {
  it('returns correct messages with locations', () => {
    expect(getPackagingAtLocationsMessage('cans', ['Lawrenceville'])).toBe(
      'Cans available at Lawrenceville'
    );
    expect(getPackagingAtLocationsMessage('bottles', ['Lawrenceville', 'Zelienople'])).toBe(
      'Bottles available at Lawrenceville and Zelienople'
    );
  });
});
