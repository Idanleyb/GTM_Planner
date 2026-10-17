import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import fixture from '../../test/fixtures/prototype-pimp-my-prompt.json'
import { buildSummary, createProject, migratePrototype } from '../../engine'
import { scaleWidths, summaryDocBuffer } from '../summaryDocx'
import { writeFileSync, mkdirSync } from 'node:fs'

const today = new Date('2026-10-17T12:00:00')
const docXml = async (buf: Buffer) => strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml'])

describe('Word summary', () => {
  it('scales column widths to exactly the content width', () => {
    const w = scaleWidths([1, 2, 3.3])
    expect(w.reduce((a, b) => a + b)).toBe(9638)
    expect(w.every(Number.isInteger)).toBe(true)
  })

  it('builds a valid .docx with every section of the example plan', async () => {
    const s = buildSummary(migratePrototype(fixture).project, today)
    const buf = await summaryDocBuffer(s)
    if (process.env.SUMMARY_DOCX_OUT) { mkdirSync(process.env.SUMMARY_DOCX_OUT, { recursive: true }); writeFileSync(`${process.env.SUMMARY_DOCX_OUT}/example.docx`, buf) }
    const xml = await docXml(buf)
    for (const text of ['Go-to-market plan', 'T−45', 'Where the plan stands', 'Customer and positioning', 'Pricing and packaging', 'USD 9,144', 'Open risks', 'Launch readiness', 'What it takes to reach 120 customers']) {
      expect(xml, text).toContain(text)
    }
    expect(xml).toContain('w:tblHeader') // header rows repeat across pages
  })

  it('works for an empty plan', async () => {
    const buf = await summaryDocBuffer(buildSummary(createProject('Blank plan', 'Sales-led'), today))
    const xml = await docXml(buf)
    expect(xml).toContain('Blank plan')
    expect(xml).toContain('No channels selected yet.')
    expect(xml).toContain('Launch date not set')
  })
})
