import { sql } from 'drizzle-orm';
import type { Db } from '../../../server/db/client';
import { createSession } from '../../../server/repo/users';

// Stand-in accounts. The writer carries the byline the live posts are published
// under; every address is @example.com, and no password is set because nothing
// verifies one any more (staff sign in with Google through Clerk).

export interface Member {
  key: string;
  email: string;
  displayName: string;
  role: 'owner' | 'writer' | 'developer' | 'supply_chain' | 'support' | 'marketing';
}

export const TEAM: Member[] = [
  { key: 'owner', email: 'kelechi@example.com', displayName: 'Kelechi Nwosu', role: 'owner' },
  { key: 'writer', email: 'sandra@example.com', displayName: 'Sandra Okpara', role: 'writer' },
  { key: 'supply', email: 'amina@example.com', displayName: 'Amina Bello', role: 'supply_chain' },
  { key: 'support', email: 'ifeanyi@example.com', displayName: 'Ifeanyi Okafor', role: 'support' },
  { key: 'marketing', email: 'zainab@example.com', displayName: 'Zainab Musa', role: 'marketing' },
  { key: 'developer', email: 'dev@example.com', displayName: 'Tobi Akande', role: 'developer' },
];

export async function seedTeam(db: Db): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const member of TEAM) {
    const res = await db.execute(sql`
      INSERT INTO users (email, password_hash, display_name, role, created_at)
      VALUES (${member.email}, 'demo-no-password', ${member.displayName}, ${member.role}, ${Date.now()})
      ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id`);
    ids[member.key] = String(res.rows[0].id);
  }
  return ids;
}

export async function sessionFor(db: Db, userId: string): Promise<string> {
  const { token } = await createSession(db, userId, 'plaspool demo');
  return token;
}
