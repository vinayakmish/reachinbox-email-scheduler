import request from 'supertest';
import { createApp } from '../src/app';

describe('Auth middleware', () => {
  const app = createApp();

  test('GET /api/auth/me returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/campaigns returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(401);
  });

  test('GET /api/emails/scheduled returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/emails/scheduled');
    expect(res.status).toBe(401);
  });

  test('Health check works', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
