import { newMemberId, isValidMemberId } from '@/utils/identity';

describe('identity', () => {
  test('newMemberId produces a well-formed, unique id', () => {
    const a = newMemberId();
    const b = newMemberId();
    expect(a).toMatch(/^m_[a-z0-9]+$/);
    expect(isValidMemberId(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  test('isValidMemberId accepts valid codes (trimmed) and rejects junk', () => {
    expect(isValidMemberId('m_l021x8k3f9qz')).toBe(true);
    expect(isValidMemberId('  m_abc123  ')).toBe(true);
    expect(isValidMemberId('M_ABC123')).toBe(true);
    expect(isValidMemberId('abc123')).toBe(false);
    expect(isValidMemberId('m_')).toBe(false);
    expect(isValidMemberId('')).toBe(false);
    expect(isValidMemberId('m_has spaces')).toBe(false);
  });
});
