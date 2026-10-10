import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  configurable: true,
});

// Use the real Supabase client with an in-memory HTTP boundary, never a live project.
process.env.VITE_SUPABASE_URL = 'https://profiles.example.invalid';
process.env.VITE_SUPABASE_ANON_KEY = 'test-only-key';
const cloud = new Map<string, Record<string, unknown>>();
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, 'profiles.example.invalid');
  assert.equal(url.pathname, '/rest/v1/profiles');
  const id = url.searchParams.get('id')?.replace(/^eq\./, '');
  const method = init?.method || 'GET';
  if (method === 'GET') {
    return Response.json(id && cloud.has(id) ? [cloud.get(id)] : []);
  }
  const payload = JSON.parse(String(init?.body));
  if (method === 'POST') {
    const row = { ...cloud.get(payload.id), ...payload };
    cloud.set(payload.id, row);
    return Response.json(row);
  }
  if (method === 'PATCH' && id && cloud.has(id)) {
    const row = { ...cloud.get(id), ...payload };
    cloud.set(id, row);
    return Response.json(row);
  }
  return Response.json({ code: 'PGRST116', message: 'No rows returned' }, { status: 406 });
};

const { profileService } = await import('../src/services/profileService.ts');

test('saving a cached profile creates its missing cloud row and survives cache loss', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  storage.set('visiospace_local_profiles', JSON.stringify({
    [id]: { id, username: 'test_owner', full_name: 'Original owner', preferences: { sound: false } },
  }));

  await profileService.updateProfile(id, { full_name: 'Updated owner' });
  assert.equal(cloud.get(id)?.username, 'test_owner');
  storage.clear();
  const reloaded = await profileService.getProfile(id);
  assert.equal(reloaded?.full_name, 'Updated owner');
  assert.deepEqual(reloaded?.preferences, { sound: false });

  await profileService.updateProfile(id, { full_name: 'Updated again' });
  storage.clear();
  assert.equal((await profileService.getProfile(id))?.full_name, 'Updated again');
});
