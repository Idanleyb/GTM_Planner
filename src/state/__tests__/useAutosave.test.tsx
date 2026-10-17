// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from '../../engine'
import { memoryServices } from '../../services/memoryServices'
import type { Project } from '../../config/types'
import { projectReducer } from '../projectReducer'
import { useAutosave } from '../useAutosave'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

async function setup() {
  const svc = memoryServices({ projects: [createProject('Launch', 'PLG')] })
  const stored = (await svc.store.listProjects('ws-demo', false)).projects[0]
  const save = vi.fn(svc.store.saveProject)
  const onReplace = vi.fn()
  const hook = renderHook(({ project }: { project: Project }) =>
    useAutosave({ project, initialVersion: stored.version, save, onReplace }), { initialProps: { project: stored as Project } })
  const edit = (p: Project, value: string) => projectReducer(p, { type: 'setField', section: 'brief', key: 'product', value })
  const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
  return { svc, stored, save, onReplace, hook, edit, tick }
}

describe('useAutosave', () => {
  it('waits for a pause in typing, then saves once', async () => {
    const { hook, stored, save, edit, tick, svc } = await setup()
    let p: Project = stored
    for (const v of ['P', 'Pi', 'Pim']) { p = edit(p, v); hook.rerender({ project: p }); await tick(300) }
    expect(hook.result.current.state).toBe('unsaved')
    expect(save).not.toHaveBeenCalled()
    await tick(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(hook.result.current.state).toBe('saved')
    expect((await svc.store.getProject(stored.id))?.data.sections.brief.fields.product).toBe('Pim')
  })

  it('uses the new version for the next save', async () => {
    const { hook, stored, save, edit, tick } = await setup()
    let p = edit(stored, 'A'); hook.rerender({ project: p }); await tick(900)
    p = edit(p, 'B'); hook.rerender({ project: p }); await tick(900)
    expect(save.mock.calls.map(c => c[1])).toEqual([1, 2])
    expect(hook.result.current.state).toBe('saved')
  })

  it('stops on a conflict and can reload the other version', async () => {
    const { hook, stored, edit, tick, svc, onReplace } = await setup()
    svc.simulateRemoteEdit(stored.id, p => { p.data.sections.brief.fields.product = 'Theirs' })
    hook.rerender({ project: edit(stored, 'Mine') }); await tick(900)
    expect(hook.result.current.state).toBe('conflict')
    expect(hook.result.current.conflict?.data.sections.brief.fields.product).toBe('Theirs')
    act(() => hook.result.current.reloadTheirs())
    expect(onReplace).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }))
    expect(hook.result.current.state).toBe('saved')
  })

  it('can keep local changes over the other version', async () => {
    const { hook, stored, edit, tick, svc } = await setup()
    svc.simulateRemoteEdit(stored.id, p => { p.data.sections.brief.fields.product = 'Theirs' })
    hook.rerender({ project: edit(stored, 'Mine') }); await tick(900)
    act(() => hook.result.current.keepMine())
    await tick(10)
    expect(hook.result.current.state).toBe('saved')
    expect((await svc.store.getProject(stored.id))?.data.sections.brief.fields.product).toBe('Mine')
  })

  it('reports network errors and retries on request', async () => {
    const { hook, stored, edit, tick, svc } = await setup()
    svc.failNextSaves(1)
    hook.rerender({ project: edit(stored, 'X') }); await tick(900)
    expect(hook.result.current.state).toBe('error')
    expect(hook.result.current.error).toMatch(/fetch/)
    act(() => hook.result.current.saveNow())
    await tick(10)
    expect(hook.result.current.state).toBe('saved')
  })

  it('never saves in read-only mode', async () => {
    const svc = memoryServices({ projects: [createProject('Launch')] })
    const stored = (await svc.store.listProjects('ws-demo', false)).projects[0]
    const save = vi.fn(svc.store.saveProject)
    const hook = renderHook(({ project }: { project: Project }) =>
      useAutosave({ project, initialVersion: 1, save, onReplace: vi.fn(), readOnly: true }), { initialProps: { project: stored as Project } })
    hook.rerender({ project: projectReducer(stored, { type: 'rename', name: 'x' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(save).not.toHaveBeenCalled()
    expect(hook.result.current.state).toBe('readonly')
  })
})
