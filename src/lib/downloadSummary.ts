import type { Project } from '../config/types'
import { buildSummary } from '../engine/summary'
import { fileNameFor } from './importExport'

/** Build the Word summary and download it. The docx library loads only when needed. */
export async function downloadSummaryDoc(project: Project, today = new Date()): Promise<void> {
  const { summaryDocBlob } = await import('./summaryDocx')
  const blob = await summaryDocBlob(buildSummary(project, today))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GTM plan - ${fileNameFor(project.name).replace(/\.json$/, '')}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
