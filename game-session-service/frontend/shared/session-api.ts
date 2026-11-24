export interface SessionUser {
  id: number;
  username: string;
  role: 'user' | 'admin';
}

type Panel = 'user' | 'admin';

export async function getSession(panel: Panel): Promise<SessionUser | null> {
  const response = await fetch(panel === 'admin' ? '/api/admin/session' : '/api/session');
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error('Could not check your session.');
  const { user } = (await response.json()) as { user: SessionUser };
  return user;
}

export async function signIn(panel: Panel, username: string, password: string) {
  const response = await fetch(panel === 'admin' ? '/api/admin/sign-in' : '/api/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (response.ok) return;
  const body = await response.json().catch(() => null);
  throw new Error(typeof body?.error === 'string' ? body.error : 'Could not sign in.');
}

export async function signOut() {
  const response = await fetch('/api/sign-out', { method: 'POST' });
  if (!response.ok) throw new Error('Could not sign out.');
}
