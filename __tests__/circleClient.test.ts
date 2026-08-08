import {
  createCircle,
  joinCircle,
  syncCircle,
  getCircle,
  setCovenant,
  leaveCircle,
  type MemberSnapshotInput,
} from '@/data/circleClient';
import { postServer } from '@/data/serverClient';

jest.mock('@/data/serverClient', () => ({
  __esModule: true,
  postServer: jest.fn(),
}));

const mockPost = postServer as jest.Mock;

const member: MemberSnapshotInput = {
  memberId: 'm_1',
  displayName: 'Sarah',
  memorizedCount: 3,
  streak: 2,
  versesDone: [],
  planDone: [],
  lastActiveDay: '2026-08-08',
};

const snapshot = { meta: { code: 'ABC123' }, members: [] };

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ snapshot });
});

function lastBody() {
  return mockPost.mock.calls[0][2];
}

describe('circleClient action payloads', () => {
  test('create posts action=create with member/name/goal and returns snapshot', async () => {
    const out = await createCircle('url', member, { name: 'Me & Sarah' });
    expect(mockPost).toHaveBeenCalledWith('url', '/circle', expect.anything());
    expect(lastBody()).toMatchObject({ action: 'create', name: 'Me & Sarah', member: { memberId: 'm_1' } });
    expect(out).toBe(snapshot);
  });

  test('join posts action=join with code + member', async () => {
    await joinCircle('url', 'ABC123', member);
    expect(lastBody()).toMatchObject({ action: 'join', code: 'ABC123', member: { memberId: 'm_1' } });
  });

  test('sync posts action=sync', async () => {
    await syncCircle('url', 'ABC123', member);
    expect(lastBody()).toMatchObject({ action: 'sync', code: 'ABC123' });
  });

  test('get posts action=get', async () => {
    await getCircle('url', 'ABC123');
    expect(lastBody()).toMatchObject({ action: 'get', code: 'ABC123' });
  });

  test('setCovenant posts action=setCovenant with fields', async () => {
    await setCovenant('url', 'ABC123', 'm_1', 'Sundays', '2 verses/week');
    expect(lastBody()).toMatchObject({
      action: 'setCovenant',
      code: 'ABC123',
      memberId: 'm_1',
      cadenceLabel: 'Sundays',
      goalText: '2 verses/week',
    });
  });

  test('leave posts action=leave', async () => {
    mockPost.mockResolvedValue({ ok: true });
    await leaveCircle('url', 'ABC123', 'm_1');
    expect(lastBody()).toMatchObject({ action: 'leave', code: 'ABC123', memberId: 'm_1' });
  });
});
