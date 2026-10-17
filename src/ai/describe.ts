// Turns the current step and the rest of the plan into what the AI sees.
import { checklistFor } from '../config/sections'
import type { Project, SectionDef } from '../config/types'
import { buildSummary } from '../engine/summary'
import { motionOf } from '../engine/project'
import type { AiAction, AiRequest, SectionDescriptor } from '../../supabase/functions/_shared/aiLogic'
import { LIMITS } from '../../supabase/functions/_shared/aiLogic'

export function describeSection(section: SectionDef, project: Project): SectionDescriptor {
  const d = project.data
  const sd = d.sections[section.id]
  const motion = motionOf(d)
  return {
    id: section.id, title: section.title, intro: section.intro, motion,
    currency: String(d.sections.brief.fields.currency ?? ''),
    fields: (section.fields ?? []).map(f => ({ key: f.key, label: f.label, type: f.type, options: f.options, help: f.help, value: sd.fields[f.key] ?? '' })),
    tables: (section.tables ?? []).map(t => ({
      key: t.key, title: t.title,
      columns: t.columns.map(c => ({ key: c.key, label: c.label, type: c.type, options: c.options })),
      rows: (sd.tables[t.key] ?? []).slice(0, LIMITS.existingRowsSent).map(({ id: _id, ...rest }) => rest),
    })),
    checklist: checklistFor(section, motion).map(i => ({ label: i.label, done: !!sd.checks[i.id] })),
  }
}

/** The rest of the plan as compact text, built from the same summary as the Word export. */
export function planContext(project: Project, excludeSection: string, today = new Date()): string {
  const s = buildSummary(project, today)
  const lines = [`Plan: ${s.title} (${s.subtitle})`, ...s.keyFacts.map(k => `${k.label}: ${k.value}`)]
  for (const sec of s.sections) {
    if (sec.editSection === excludeSection) continue
    lines.push('', `## ${sec.title}`)
    for (const b of sec.blocks) {
      if (b.kind === 'facts') b.items.forEach(i => lines.push(`${i.label}: ${i.value}`))
      else if (b.kind === 'text') lines.push(`${b.label}: ${b.text.replace(/\s+/g, ' ')}`)
      else if (b.kind === 'table') { if (b.title) lines.push(b.title); lines.push(b.table.columns.join(' | ')); b.table.rows.slice(0, 15).forEach(r => lines.push(r.join(' | '))) }
      else if (b.kind === 'bullets') { if (b.title) lines.push(b.title); b.items.forEach(i => lines.push(`- ${i}`)) }
    }
  }
  return lines.join('\n').slice(0, LIMITS.contextChars)
}

export function buildAiRequest(action: AiAction, section: SectionDef, project: Project, today = new Date()): AiRequest {
  return { projectId: project.id, action, section: describeSection(section, project), context: planContext(project, section.id, today) }
}
