// Runs the real migration on an in-memory Postgres (PGlite) and checks the
// access rules as different signed-in users. `npm test` runs it.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const dir = join(__dirname, '..', 'migrations')
const db = new PGlite()
const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'
const CAROL = '00000000-0000-0000-0000-00000000000c'
const emails: Record<string, string> = { [ALICE]: 'alice@example.com', [BOB]: 'bob@example.com', [CAROL]: 'carol@example.com' }

async function signUp(id: string) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, emails[id]])
}

/** Run queries as a signed-in user (role authenticated + JWT claims), like PostgREST does. */
async function as<T>(id: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(id ? 'set role authenticated' : 'set role anon')
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [id ?? '', id ? JSON.stringify({ sub: id, email: emails[id] }) : ''])
  try { return await fn() } finally { await db.exec('reset role') }
}
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params).then(r => r.rows)
const affected = (sql: string, params: unknown[] = []) => db.query(sql, params).then(r => r.affectedRows ?? 0)

let aliceWs = '', projectId = ''

beforeAll(async () => {
  await db.exec(readFileSync(join(__dirname, 'supabase-shim.sql'), 'utf8'))
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
})

describe('Supabase schema + RLS', () => {
  it('sign-up creates a profile and a personal workspace with the user as sole owner', async () => {
    await signUp(ALICE)
    const rows = await as(ALICE, () => q('select w.id, w.name, m.role from workspaces w join workspace_members m on m.workspace_id = w.id'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'My workspace', role: 'owner' })
    aliceWs = rows[0].id as string
    expect(await as(ALICE, () => q('select email from profiles'))).toEqual([{ email: 'alice@example.com' }])
  })

  it('owner can create a project; version starts at 1', async () => {
    const rows = await as(ALICE, () => q(
      `insert into projects (workspace_id, name, motion, launch_date, data) values ($1, 'Pimp My Prompt launch', 'PLG', '2026-12-01', '{"schemaVersion":2,"sections":{}}') returning id, version, created_by`, [aliceWs]))
    expect(rows[0]).toMatchObject({ version: 1, created_by: ALICE })
    projectId = rows[0].id as string
  })

  it('anonymous visitors are denied outright', async () => {
    await expect(as(null, () => q('select * from projects'))).rejects.toThrow(/permission denied/)
  })

  it('other users cannot see or write into a workspace they are not in', async () => {
    await signUp(CAROL)
    expect(await as(CAROL, () => q('select id from projects'))).toEqual([])
    expect(await as(CAROL, () => q('select id from workspaces where id = $1', [aliceWs]))).toEqual([])
    await expect(as(CAROL, () => q(`insert into projects (workspace_id, name, data) values ($1, 'x', '{}')`, [aliceWs]))).rejects.toThrow(/row-level security/)
    expect(await as(CAROL, () => affected(`update projects set name = 'hacked' where id = $1`, [projectId]))).toBe(0)
    expect(await as(CAROL, () => q('select id from profiles where id = $1', [ALICE]))).toEqual([])
  })

  it('pending invites are accepted on sign-up with the invited role', async () => {
    await as(ALICE, () => q(`insert into workspace_invites (workspace_id, email, role) values ($1, 'bob@example.com', 'viewer')`, [aliceWs]))
    await signUp(BOB)
    const roles = await as(BOB, () => q('select workspace_id, role from workspace_members where user_id = $1 order by role', [BOB]))
    expect(roles).toEqual(expect.arrayContaining([{ workspace_id: aliceWs, role: 'viewer' }, expect.objectContaining({ role: 'owner' })]))
    expect(await as(BOB, () => q('select accepted_at is not null as accepted from workspace_invites where email = $1', ['bob@example.com']))).toEqual([{ accepted: true }])
  })

  it('viewers can read but not change projects', async () => {
    expect(await as(BOB, () => q('select name from projects where id = $1', [projectId]))).toEqual([{ name: 'Pimp My Prompt launch' }])
    expect(await as(BOB, () => affected(`update projects set name = 'x' where id = $1`, [projectId]))).toBe(0)
    expect(await as(BOB, () => affected('delete from projects where id = $1', [projectId]))).toBe(0)
    // shared workspace makes profiles visible to each other
    expect(await as(BOB, () => q('select email from profiles where id = $1', [ALICE]))).toEqual([{ email: 'alice@example.com' }])
  })

  it('members cannot promote themselves; owners can', async () => {
    expect(await as(BOB, () => affected(`update workspace_members set role = 'owner' where workspace_id = $1 and user_id = $2`, [aliceWs, BOB]))).toBe(0)
    expect(await as(ALICE, () => affected(`update workspace_members set role = 'editor' where workspace_id = $1 and user_id = $2`, [aliceWs, BOB]))).toBe(1)
  })

  it('editors save with optimistic concurrency; stale versions update nothing', async () => {
    const ok = await as(BOB, () => q(`update projects set name = 'Renamed' where id = $1 and version = 1 returning version, updated_by`, [projectId]))
    expect(ok).toEqual([{ version: 2, updated_by: BOB }])
    expect(await as(ALICE, () => affected(`update projects set name = 'Stale' where id = $1 and version = 1`, [projectId]))).toBe(0)
  })

  it('updates cannot move a project to another workspace or rewrite its creator', async () => {
    const carolWs = (await as(CAROL, () => q('select id from workspaces')))[0].id
    await as(BOB, () => q(`update projects set workspace_id = $2, created_by = $3 where id = $1`, [projectId, carolWs, BOB]))
    expect(await as(ALICE, () => q('select workspace_id, created_by from projects where id = $1', [projectId]))).toEqual([{ workspace_id: aliceWs, created_by: ALICE }])
  })

  it('editors cannot delete projects; owners can', async () => {
    const extra = (await as(ALICE, () => q(`insert into projects (workspace_id, name, data) values ($1, 'Temp', '{}') returning id`, [aliceWs])))[0].id
    expect(await as(BOB, () => affected('delete from projects where id = $1', [extra]))).toBe(0)
    expect(await as(ALICE, () => affected('delete from projects where id = $1', [extra]))).toBe(1)
  })

  it('activity log is append-only and attributed to the writer', async () => {
    await as(BOB, () => q(`insert into project_activity (project_id, action, summary) values ($1, 'update', 'Renamed project')`, [projectId]))
    await expect(as(BOB, () => q(`insert into project_activity (project_id, user_id, action) values ($1, $2, 'spoof')`, [projectId, ALICE]))).rejects.toThrow(/row-level security/)
    expect(await as(BOB, () => affected(`update project_activity set summary = 'x'`))).toBe(0)
    expect(await as(ALICE, () => q('select user_id, action from project_activity'))).toEqual([{ user_id: BOB, action: 'update' }])
    expect(await as(CAROL, () => q('select id from project_activity'))).toEqual([])
  })

  it('a workspace always keeps an owner, but members may leave', async () => {
    await expect(as(ALICE, () => q('delete from workspace_members where workspace_id = $1 and user_id = $2', [aliceWs, ALICE]))).rejects.toThrow(/at least one owner/)
    await expect(as(ALICE, () => q(`update workspace_members set role = 'editor' where workspace_id = $1 and user_id = $2`, [aliceWs, ALICE]))).rejects.toThrow(/at least one owner/)
    expect(await as(BOB, () => affected('delete from workspace_members where workspace_id = $1 and user_id = $2', [aliceWs, BOB]))).toBe(1)
    expect(await as(BOB, () => q('select id from projects'))).toEqual([])
  })

  it('owners can delete a workspace, which removes its projects and memberships', async () => {
    expect(await as(ALICE, () => affected('delete from workspaces where id = $1', [aliceWs]))).toBe(1)
    expect(await q('select count(*)::int as n from projects where workspace_id = $1', [aliceWs])).toEqual([{ n: 0 }])
    expect(await q('select count(*)::int as n from workspace_members where workspace_id = $1', [aliceWs])).toEqual([{ n: 0 }])
  })
})
