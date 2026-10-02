import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_DAYS,
  addDays,
  isFreePlan,
  TRIAL_DAYS,
} from '../src/services/subscription.service';

/**
 * Régression : l'offre gratuite est annoncée « 0 Ar, pour toujours ».
 * Une boutique partait pourtant en essai de 14 jours, puis le cron la
 * passait EXPIRED et toute écriture renvoyait 402 — sans jamais avoir
 * facturé quoi que ce soit.
 */
describe('Offre gratuite perpétuelle', () => {
  it('détecte les offres gratuites', () => {
    expect(isFreePlan({ priceAr: 0 })).toBe(true);
    expect(isFreePlan({ priceAr: '0' })).toBe(true);
    expect(isFreePlan({ priceAr: 25000 })).toBe(false);
    expect(isFreePlan(null)).toBe(false);
    expect(isFreePlan(undefined)).toBe(false);
  });

  it('donne une période bien plus longue que l\'essai', () => {
    expect(FREE_PLAN_DAYS).toBeGreaterThan(TRIAL_DAYS * 100);
  });

  it('n\'expire pas une boutique gratuite même après 100 ans', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = addDays(created, FREE_PLAN_DAYS);
    // Bien après n'importe quel essai : la boutique est toujours « vivante ».
    expect(periodEnd.getTime()).toBeGreaterThan(Date.now());
  });
});