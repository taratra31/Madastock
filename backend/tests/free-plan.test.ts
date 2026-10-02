import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_DAYS,
  addDays,
  isFreePlan,
  TRIAL_DAYS,
} from '../src/services/subscription.service';

/**
 * Offre gratuite : essai limité de 30 jours (non perpétuel).
 */
describe('Offre gratuite - essai 30 jours', () => {
  it('détecte les offres gratuites', () => {
    expect(isFreePlan({ priceAr: 0 })).toBe(true);
    expect(isFreePlan({ priceAr: '0' })).toBe(true);
    expect(isFreePlan({ priceAr: 25000 })).toBe(false);
    expect(isFreePlan(null)).toBe(false);
    expect(isFreePlan(undefined)).toBe(false);
  });

  it('a une durée de 30 jours', () => {
    expect(FREE_PLAN_DAYS).toBe(30);
  });

  it('expire après 30 jours (période d\'essai)', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = addDays(created, FREE_PLAN_DAYS);
    const diffMs = periodEnd.getTime() - created.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(30);
  });
});