// Word (.docx) version of the plan summary: navy and amber, A4, tables with
// repeating header rows, page numbers in the footer.
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TabStopType,
  TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx'
import type { ITableCellBorders } from 'docx'
import type { KV, PlanSummary, SummaryBlock, SummaryTable } from '../engine/summary'
import { NOT_SET, paragraphs } from '../engine/summary'

const C = {
  navy: '14213D', amber: 'E0A030', amberSoft: 'FBF1DC', ink: '14213D', body: '3A4762', muted: '6B7590',
  line: 'DCE0E8', paper: 'F5F6F8', white: 'FFFFFF', ready: '1F7A6B', alert: 'B4412F',
}
const FONT = 'Arial'
const PAGE = { width: 11906, height: 16838, margin: 1134 } // A4, 2 cm margins
const CONTENT = PAGE.width - 2 * PAGE.margin // 9638 DXA

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const hair = { style: BorderStyle.SINGLE, size: 4, color: C.line }
const NO_BORDERS: ITableCellBorders = { top: none, bottom: none, left: none, right: none }
const GRID: ITableCellBorders = { top: hair, bottom: hair, left: hair, right: hair }

/** Scale relative widths to whole DXA values that sum exactly to `total`. */
export function scaleWidths(rel: number[], total = CONTENT): number[] {
  const sum = rel.reduce((a, b) => a + b, 0) || 1
  const out = rel.map(w => Math.floor((w / sum) * total))
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
  return out
}

const run = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, bold: o.bold, italics: o.italics, color: o.color ?? C.body, size: o.size ?? 20 })

const para = (children: TextRun[], o: { after?: number; before?: number; keepNext?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({ children, spacing: { after: o.after ?? 80, before: o.before ?? 0 }, keepNext: o.keepNext, alignment: o.align })

function cell(children: Paragraph[], width: number, o: { fill?: string; borders?: ITableCellBorders; vAlign?: typeof VerticalAlign.CENTER; pad?: number } = {}) {
  const pad = o.pad ?? 100
  return new TableCell({
    children, width: { size: width, type: WidthType.DXA }, borders: o.borders ?? GRID, verticalAlign: o.vAlign,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: pad, bottom: pad, left: 140, right: 140 },
  })
}

function dataTable(t: SummaryTable): Table {
  const widths = scaleWidths(t.widths)
  const header = new TableRow({
    tableHeader: true, cantSplit: true,
    children: t.columns.map((c, i) => cell([para([run(c, { bold: true, color: C.white, size: 17 })], { after: 0 })], widths[i], { fill: C.navy, pad: 80 })),
  })
  const body = t.rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((v, i) => cell(
      paragraphs(v).length ? paragraphs(v).map((pText, pi, all) => para([run(pText, { size: 17, color: i === 0 ? C.ink : C.body, bold: i === 0 })], { after: pi === all.length - 1 ? 0 : 40 })) : [para([run('—', { size: 17, color: C.muted })], { after: 0 })],
      widths[i], { fill: ri % 2 === 1 ? C.paper : undefined, pad: 70 },
    )),
  }))
  return new Table({ rows: [header, ...body], width: { size: CONTENT, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED })
}

function factsTable(items: KV[], columns: 1 | 2 = 1): Table {
  const rows: TableRow[] = []
  const per = columns
  const widths = per === 2 ? scaleWidths([2, 3, 2, 3]) : scaleWidths([2.2, 5])
  for (let i = 0; i < items.length; i += per) {
    const slice = items.slice(i, i + per)
    while (slice.length < per) slice.push({ label: '', value: '' })
    rows.push(new TableRow({
      cantSplit: true,
      children: slice.flatMap((kv, j) => [
        cell([para([run(kv.label, { bold: true, size: 17, color: C.ink })], { after: 0 })], widths[j * 2], { fill: C.paper, pad: 70 }),
        cell([para([run(kv.value, { size: 18, color: kv.value === NOT_SET ? C.muted : C.body, italics: kv.value === NOT_SET })], { after: 0 })], widths[j * 2 + 1], { pad: 70 }),
      ]),
    }))
  }
  return new Table({ rows, width: { size: CONTENT, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED })
}

const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } })

function subhead(text: string) {
  return para([run(text, { bold: true, color: C.ink, size: 20 })], { before: 160, after: 80, keepNext: true })
}

function bullets(items: string[]) {
  return items.map(t => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [run(t, { size: 19 })], spacing: { after: 40 } }))
}

function block(b: SummaryBlock): (Paragraph | Table)[] {
  switch (b.kind) {
    case 'facts': return [factsTable(b.items), spacer()]
    case 'text': return [
      para([run(b.label, { bold: true, color: C.ink, size: 18 })], { after: 30, keepNext: true }),
      ...paragraphs(b.text).map(t => para([run(t)], { after: 60 })),
      spacer(60),
    ]
    case 'table': return [...(b.title ? [subhead(b.title)] : []), dataTable(b.table), spacer()]
    case 'bullets': return [...(b.title ? [subhead(b.title)] : []), ...bullets(b.items), spacer(80)]
    case 'empty': return [para([run(b.text, { italics: true, color: C.muted })], { after: 160 })]
  }
}

function sectionHeading(n: number, title: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: `${n}  `, color: C.amber, bold: true, font: FONT, size: 28 }), new TextRun({ text: title, font: FONT, bold: true, color: C.navy, size: 28 })],
    spacing: { before: 360, after: 160 }, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.amber, space: 4 } },
  })
}

function cover(s: PlanSummary): Table {
  const [left, right] = scaleWidths([6.4, 3.6])
  const cd = s.countdown ? s.countdown.split(' (') : null
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [left, right], layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [
      cell([
        para([run('Go-to-market plan', { color: C.amber, size: 18, bold: true })], { after: 100 }),
        para([run(s.title, { color: C.white, size: 40, bold: true })], { after: 100 }),
        para([run(s.subtitle, { color: 'C9CFDC', size: 19 })], { after: 0 }),
      ], left, { fill: C.navy, borders: NO_BORDERS, pad: 320, vAlign: VerticalAlign.CENTER }),
      cell(cd ? [
        para([run(cd[0], { color: C.amber, size: 56, bold: true })], { after: 40, align: AlignmentType.RIGHT }),
        para([run(cd[1]?.replace(/\)$/, '') ?? '', { color: 'C9CFDC', size: 18 })], { after: 0, align: AlignmentType.RIGHT }),
      ] : [para([run('Launch date not set', { color: 'C9CFDC', size: 18 })], { align: AlignmentType.RIGHT, after: 0 })],
      right, { fill: C.navy, borders: NO_BORDERS, pad: 320, vAlign: VerticalAlign.CENTER }),
    ] })],
  })
}

export function buildSummaryDocument(s: PlanSummary): Document {
  const children: (Paragraph | Table)[] = [cover(s), spacer(240)]

  children.push(factsTable(s.keyFacts, 2), spacer(240))

  // Readiness
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 120, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.amber, space: 4 } },
    children: [new TextRun({ text: 'Where the plan stands', font: FONT, bold: true, color: C.navy, size: 28 })],
  }))
  children.push(para([
    run(`${s.readiness.pct}% complete`, { bold: true, color: C.ink, size: 22 }),
    run(`, ${s.readiness.ready} of ${s.readiness.total} steps ready.`, { size: 22 }),
  ], { after: 140 }))
  children.push(dataTable(s.readiness.phases), spacer())
  if (s.gaps.length) {
    children.push(subhead('Still needed before each step is ready'))
    children.push(...s.gaps.map(g => new Paragraph({
      numbering: { reference: 'bullets', level: 0 }, spacing: { after: 50 },
      children: [run(`${g.step}: `, { bold: true, color: C.ink, size: 19 }), run(g.missing.join('; '), { size: 19 })],
    })))
    children.push(spacer(80))
  }
  if (s.dueSoon.rows.length) children.push(subhead('Due in the next two weeks'), dataTable(s.dueSoon), spacer())

  s.sections.forEach((sec, i) => {
    children.push(sectionHeading(i + 1, sec.title))
    sec.blocks.forEach(b => children.push(...block(b)))
  })

  return new Document({
    creator: 'GTM Planner',
    title: `GTM plan: ${s.title}`,
    description: `Go-to-market plan summary generated on ${s.generatedOn}`,
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: C.body } } },
      paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: C.navy }, paragraph: { outlineLevel: 0 } }],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: C.amber } } }] }] },
    sections: [{
      properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } } },
      footers: { default: new Footer({ children: [new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 6 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT }],
        children: [
          run(`${s.title}. Generated by GTM Planner on ${s.generatedOn}.`, { size: 15, color: C.muted }),
          new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: C.muted }),
        ],
      })] }) },
      children,
    }],
  })
}

export const summaryDocBlob = (s: PlanSummary) => Packer.toBlob(buildSummaryDocument(s))
export const summaryDocBuffer = (s: PlanSummary) => Packer.toBuffer(buildSummaryDocument(s))
