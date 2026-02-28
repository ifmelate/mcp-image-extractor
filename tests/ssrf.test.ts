import { jest } from '@jest/globals';
import { isPrivateIP, checkSSRFRisk } from '../src/image-utils';
import * as dns from 'dns';
import * as net from 'net';

jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isPrivateIP', () => {
  // IPv4 private ranges
  it.each([
    ['127.0.0.1', true],
    ['127.255.255.255', true],
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.0.1', true],
    ['192.168.255.255', true],
    ['169.254.1.1', true],
    ['0.0.0.0', true],
    ['100.64.0.1', true],
    ['100.127.255.255', true],
  ])('detects %s as private (true)', (ip, expected) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  // IPv4 public addresses
  it.each([
    ['8.8.8.8', false],
    ['93.184.216.34', false],
    ['172.32.0.1', false],
    ['100.128.0.1', false],
    ['11.0.0.1', false],
  ])('detects %s as public (false)', (ip, expected) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  // IPv6 ranges
  it.each([
    ['::1', true],
    ['::', true],
    ['0:0:0:0:0:0:0:0', true],
    ['fc00::1', true],
    ['fd12:3456::1', true],
    ['fe80::1', true],
  ])('detects IPv6 %s as private (true)', (ip, expected) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  it.each([
    ['2001:db8::1', false],
    ['2607:f8b0:4004:800::200e', false],
  ])('detects IPv6 %s as public (false)', (ip, expected) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  // IPv4-mapped IPv6
  it.each([
    ['::ffff:127.0.0.1', true],
    ['::ffff:192.168.1.1', true],
    ['::ffff:10.0.0.1', true],
    ['::ffff:8.8.8.8', false],
  ])('detects IPv4-mapped IPv6 %s correctly', (ip, expected) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  // IPv4-mapped IPv6 hex form
  it.each([
    ['::ffff:7f00:1', true],     // 127.0.0.1
    ['::ffff:c0a8:101', true],   // 192.168.1.1
    ['::ffff:a00:1', true],      // 10.0.0.1
    ['::ffff:808:808', false],   // 8.8.8.8
  ])('detects IPv4-mapped IPv6 hex %s correctly', (ip, expected) => {
    expect(isPrivateIP(ip)).toBe(expected);
  });

  // Non-IP string
  it('returns false for non-IP strings', () => {
    expect(isPrivateIP('not-an-ip')).toBe(false);
  });
});

describe('checkSSRFRisk', () => {
  it('blocks localhost', async () => {
    const result = await checkSSRFRisk('http://localhost/image.png');
    expect(result).toContain('not allowed');
  });

  it('blocks private IPs', async () => {
    const result = await checkSSRFRisk('http://192.168.1.1/image.png');
    expect(result).toContain('private/internal range');
  });

  it('allows public IPs', async () => {
    const result = await checkSSRFRisk('http://93.184.216.34/image.png');
    expect(result).toBeNull();
  });

  it('blocks hostnames that resolve to private IPs', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: '10.0.0.1', family: 4 },
    ] as never);

    const result = await checkSSRFRisk('https://evil.example.com/image.png');
    expect(result).toContain('resolves to a private/internal IP');
  });

  it('allows hostnames that resolve to public IPs', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as never);

    const result = await checkSSRFRisk('https://example.com/image.png');
    expect(result).toBeNull();
  });

  it('allows through on DNS failure (let axios handle)', async () => {
    (dns.promises.lookup as jest.Mock).mockRejectedValue(new Error('DNS failed') as never);

    const result = await checkSSRFRisk('https://example.com/image.png');
    expect(result).toBeNull();
  });

  it('blocks IPv6 loopback', async () => {
    const result = await checkSSRFRisk('http://[::1]/image.png');
    expect(result).toContain('private/internal range');
  });
});
