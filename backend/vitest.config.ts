import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      // Les tests enchaînent beaucoup d'appels /auth : on désactive le plafond
      // du limiteur (le comportement est vérifié par le test dédié au 429).
      AUTH_RATE_LIMIT_MAX: '10000',
      AUTH_SOFT_RATE_LIMIT_MAX: '100000',
      RATE_LIMIT_MAX: '100000',
    },
  },
});