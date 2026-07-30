// DNS rebinding guard.
//
// The attack these cover: an attacker points a domain they own at 127.0.0.1 with a short TTL and
// gets the victim to open http://evil.com:7381. The page then calls the API on its own origin, so
// Origin and Host match perfectly and every same-origin check passes — the attacker reads the
// victim's files through the victim's own browser. The defence is that rebinding needs a NAME, so a
// Host that is loopback, a literal IP, or an operator-declared name cannot be forged this way.
import { describe, it, expect } from 'vitest';
import { isAllowedHost, isAllowedOrigin } from '../security-fs';

describe('isAllowedHost', () => {
  it('accepts loopback, with and without a port', () => {
    for (const h of ['localhost', 'localhost:7381', '127.0.0.1', '127.0.0.1:7381', '[::1]', '[::1]:7381']) {
      expect(isAllowedHost(h), h).toBe(true);
    }
  });

  it('accepts literal IPs — LAN access still works, and an IP cannot be rebound', () => {
    expect(isAllowedHost('192.168.1.10:7381')).toBe(true);
    expect(isAllowedHost('10.0.0.5')).toBe(true);
    expect(isAllowedHost('[fe80::1]:7381')).toBe(true);
  });

  it('rejects a stranger domain — this is the rebinding case', () => {
    expect(isAllowedHost('evil.com')).toBe(false);
    expect(isAllowedHost('evil.com:7381')).toBe(false);
    expect(isAllowedHost('joca.attacker.io')).toBe(false);
  });

  it('is not fooled by a hostname that merely contains a loopback name', () => {
    expect(isAllowedHost('localhost.evil.com')).toBe(false);
    expect(isAllowedHost('127.0.0.1.evil.com')).toBe(false);
    expect(isAllowedHost('notlocalhost')).toBe(false);
  });

  it('allows a missing Host (HTTP/1.0, server-side calls)', () => {
    expect(isAllowedHost(undefined)).toBe(true);
  });
});

describe('isAllowedOrigin', () => {
  it('accepts loopback origins on any port', () => {
    expect(isAllowedOrigin('http://localhost:5173', 'localhost:7381')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:7381', '127.0.0.1:7381')).toBe(true);
  });

  it('accepts a call with no Origin (curl, server-side)', () => {
    expect(isAllowedOrigin(undefined, 'localhost:7381')).toBe(true);
  });

  it('rejects a cross-site origin', () => {
    expect(isAllowedOrigin('https://evil.com', 'localhost:7381')).toBe(false);
  });

  it('no longer accepts same-origin when the host itself is a stranger domain', () => {
    // Origin === Host, which used to be enough. That is precisely the rebinding payload.
    expect(isAllowedOrigin('http://evil.com:7381', 'evil.com:7381')).toBe(false);
  });

  it('still accepts same-origin on a host we answer to', () => {
    expect(isAllowedOrigin('http://192.168.1.10:7381', '192.168.1.10:7381')).toBe(true);
  });
});
