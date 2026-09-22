import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('Health check', () => {
  it('retourne 200 sur /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('retourne 404 sur une route inconnue', async () => {
    const res = await request(app).get('/api/v1/inconnu');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });
});