import { useEffect, useState } from 'react'
import { SECTION_BY_ID } from './config/sections'
import type { SectionId } from './config/types'

/** A plan step, or one of the whole-plan views. */
export type PlanView = SectionId | 'summary' | 'tasks'

export type Route =
  | { name: 'projects' }
  | { name: 'team' }
  | { name: 'project'; id: string; section: PlanView }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'team') return { name: 'team' }
  if (parts[0] === 'p' && parts[1]) {
    const section: PlanView = parts[2] === 'summary' || parts[2] === 'tasks' ? parts[2] : SECTION_BY_ID[parts[2] as SectionId] ? (parts[2] as SectionId) : 'brief'
    return { name: 'project', id: decodeURIComponent(parts[1]), section }
  }
  return { name: 'projects' }
}

export function hrefFor(route: Route): string {
  if (route.name === 'team') return '#/team'
  if (route.name === 'project') return `#/p/${encodeURIComponent(route.id)}/${route.section}`
  return '#/'
}

export function navigate(route: Route) {
  const href = hrefFor(route)
  if (window.location.hash !== href) window.location.hash = href
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
