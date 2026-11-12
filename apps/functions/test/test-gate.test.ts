import { describe, expect, it } from 'vitest';
import { markPrivate, testGate } from '../src/test-gate';

const env = { TEST_GATE_USER: 'maginhawa', TEST_GATE_PASSWORD: 'correct-horse-battery-staple' };
const req = (auth?: string) => new Request('https://dev.maginhawa-app.pages.dev/', { headers: auth ? { Authorization: auth } : {} });
const basic = (u: string, p: string) => `Basic ${btoa(`${u}:${p}`)}`;

describe('test site password', () => {
  it('asks for the password before anything loads', () => {
    const res = testGate(req(), env)!;
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('Basic realm="Maginhawa test site"');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
  });

  it('lets in the right username and password only', () => {
    expect(testGate(req(basic('maginhawa', 'correct-horse-battery-staple')), env)).toBeNull();
    expect(testGate(req(basic('maginhawa', 'wrong')), env)?.status).toBe(401);
    expect(testGate(req(basic('someone', 'correct-horse-battery-staple')), env)?.status).toBe(401);
    expect(testGate(req('Basic !!!not-base64'), env)?.status).toBe(401);
    expect(testGate(req('Bearer abc'), env)?.status).toBe(401);
  });

  it('stays locked when no password, or a short one, is set', () => {
    expect(testGate(req(basic('a', 'b')), {})?.status).toBe(503);
    expect(testGate(req(basic('maginhawa', 'short')), { TEST_GATE_USER: 'maginhawa', TEST_GATE_PASSWORD: 'short' })?.status).toBe(503);
  });

  it('can be switched off on purpose, for the real site later', () => {
    expect(testGate(req(), { TEST_GATE: 'off' })).toBeNull();
  });

  it('marks pages it lets through as private too', async () => {
    const res = markPrivate(new Response('ok', { headers: { 'Content-Type': 'text/html' } }));
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await res.text()).toBe('ok');
  });
});
