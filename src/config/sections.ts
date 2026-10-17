import type { ChecklistItem, ColumnDef, Motion, SectionDef, TableDef, TaskMapping } from './types'

// Motion groups used to tag checklist items.
const B2B: readonly Motion[] = ['Sales-led', 'Marketing-led', 'Partner-led', 'Hybrid']
const SELF_SERVE: readonly Motion[] = ['PLG', 'Hybrid']

const STATUS = ['Not started', 'In progress', 'Blocked', 'Ready', 'Complete'] as const
const CHANNEL_STATUS = ['Not started', 'In progress', 'Blocked', 'Ready', 'Live', 'Complete'] as const
const ASSET_STATUS = ['Not started', 'In progress', 'Blocked', 'Ready for review', 'Approved', 'Live', 'Complete'] as const
const CAL_STATUS = ['Planned', 'In progress', 'Scheduled', 'Live', 'Complete'] as const
const LEVEL = ['Low', 'Medium', 'High'] as const

const t = (titleKey: string, dueKey = 'due'): TaskMapping => ({ titleKey, ownerKey: 'owner', dueKey, statusKey: 'status' })
const col = (key: string, label: string, type: ColumnDef['type'] = 'text', options?: readonly string[]): ColumnDef =>
  options ? { key, label, type, options } : { key, label, type }

// ---------------------------------------------------------------- Strategy

const brief: SectionDef = {
  id: 'brief', number: '01', phase: 'strategy', title: 'GTM brief',
  intro: 'Define the launch in one page. Fields here are the single source of truth reused across the plan.',
  fields: [
    { key: 'product', label: 'Product / offer', type: 'text' },
    { key: 'type', label: 'GTM type', type: 'select', options: ['New product', 'New market', 'New segment', 'Relaunch', 'New pricing / packaging', 'New channel'], default: 'New product' },
    { key: 'objective', label: 'Business objective', type: 'textarea', full: true, help: 'Measurable outcome and timeframe, e.g. 120 paying customers in 60 days.' },
    { key: 'launchDate', label: 'Target launch date', type: 'date' },
    { key: 'motion', label: 'Primary GTM motion', type: 'select', options: ['Sales-led', 'Marketing-led', 'PLG', 'Partner-led', 'Hybrid'], default: 'Hybrid', help: 'Changes the funnel model and which checklist items apply.' },
    { key: 'market', label: 'Target market', type: 'text' },
    { key: 'icp', label: 'Primary ICP', type: 'textarea', help: 'Who you serve first. Shown read-only in ICP & positioning.' },
    { key: 'valueProp', label: 'Core value proposition', type: 'textarea', help: 'Shown read-only in ICP & positioning.' },
    { key: 'budget', label: 'Total launch budget', type: 'money' },
    { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'ILS', 'CAD', 'AUD', 'Other'], default: 'USD' },
    { key: 'target', label: 'Revenue / adoption target', type: 'text' },
    { key: 'owner', label: 'GTM owner', type: 'text' },
    { key: 'sponsor', label: 'Executive sponsor', type: 'text' },
  ],
  notices: ['Replace example targets with numbers grounded in your own economics and baseline data.'],
  gate: { fields: ['brief.product', 'brief.objective', 'brief.launchDate', 'brief.icp', 'brief.owner'] },
}

const research: SectionDef = {
  id: 'research', number: '02', phase: 'strategy', title: 'Research & validation',
  intro: 'Validate the problem, market, competition and demand before committing budget.',
  checklist: [
    { id: 'res-market-size', label: 'Define market size and opportunity', evidence: 'TAM, SAM, SOM; market trends', owner: 'Marketing / Strategy' },
    { id: 'res-icp', label: 'Define ICP (Ideal Customer Profile)', evidence: 'Firmographics, needs, buying triggers', owner: 'Marketing / Sales' },
    { id: 'res-personas', label: 'Map buyer personas and decision-makers', evidence: 'Pain points, motivations, objections', owner: 'Marketing / Sales' },
    { id: 'res-interviews', label: 'Interview customers and prospects', evidence: 'Interview notes and recurring themes', owner: 'Product Marketing' },
    { id: 'res-competitors', label: 'Analyze competitors and alternatives', evidence: 'Positioning and competitive matrix', owner: 'Marketing' },
    { id: 'res-baseline', label: 'Audit existing performance and customer data', evidence: 'Baseline funnel, CAC, conversion, retention', owner: 'Growth / Analytics' },
    { id: 'res-demand', label: 'Validate demand and willingness to pay', evidence: 'Evidence of demand and pricing assumptions', owner: 'Product / Sales' },
  ],
  fields: [
    { key: 'notes', label: 'Evidence, insights, assumptions, open questions', type: 'textarea', full: true },
    { key: 'recommendation', label: 'Recommendation', type: 'select', options: ['', 'Proceed', 'Test further', 'Stop'], default: '', full: true },
  ],
  gate: { fields: ['research.recommendation'], checklistMin: 0.7 },
}

const positioning: SectionDef = {
  id: 'positioning', number: '03', phase: 'strategy', title: 'ICP & positioning',
  intro: 'Agree on who you serve, the problem you solve, and why the audience should choose you.',
  readOnlyRefs: ['brief.icp', 'brief.valueProp'],
  fields: [
    { key: 'secondary', label: 'Secondary ICP', type: 'textarea' },
    { key: 'buyer', label: 'Buyer vs. user', type: 'text' },
    { key: 'pain', label: 'Core pain point', type: 'textarea' },
    { key: 'alternative', label: 'Current alternative / competitor', type: 'textarea' },
    { key: 'differentiation', label: 'Differentiation', type: 'textarea' },
    { key: 'proof', label: 'Proof points', type: 'textarea' },
    { key: 'message', label: 'Primary message', type: 'textarea' },
    { key: 'cta', label: 'Primary CTA', type: 'text' },
    { key: 'objections', label: 'Likely objections & responses', type: 'textarea', full: true },
  ],
  notices: ['Messaging framework: Problem → Promise → Mechanism → Proof → Action.'],
  gate: { fields: ['positioning.pain', 'positioning.differentiation', 'positioning.message', 'positioning.cta'] },
}

const pricing: SectionDef = {
  id: 'pricing', number: '04', phase: 'strategy', title: 'Pricing & packaging',
  intro: 'Decide how you charge, what each package includes, and how you will discount — backed by willingness-to-pay evidence.',
  fields: [
    { key: 'model', label: 'Pricing model', type: 'select', options: ['', 'Subscription', 'Seat-based', 'Usage-based', 'Freemium + subscription', 'One-time', 'Custom / enterprise'], default: '' },
    { key: 'entryOffer', label: 'Entry offer', type: 'select', options: ['', 'None', 'Free trial', 'Freemium', 'Pilot / POC', 'Money-back guarantee'], default: '' },
    { key: 'launchOffer', label: 'Launch offer / early-bird', type: 'text' },
    { key: 'discountRules', label: 'Discount rules & approvals', type: 'textarea' },
    { key: 'wtpEvidence', label: 'Willingness-to-pay evidence', type: 'textarea' },
    { key: 'competitorPricing', label: 'Competitor / alternative pricing', type: 'textarea' },
  ],
  tables: [{
    key: 'tiers', title: 'Packages / tiers',
    columns: [col('tier', 'Tier'), col('price', 'Price', 'money'), col('billing', 'Billing', 'select', ['Monthly', 'Annual', 'Monthly + annual', 'One-time', 'Usage']), col('target', 'Target customer'), col('limits', 'Limits'), col('features', 'Key features', 'textarea')],
    defaultRows: [],
    blankRow: { tier: '', price: '', billing: 'Monthly', target: '', limits: '', features: '' },
  }],
  checklist: [
    { id: 'pri-competitors', label: 'Benchmark competitor and alternative pricing', evidence: 'Pricing comparison table', owner: 'Product Marketing' },
    { id: 'pri-wtp', label: 'Validate willingness to pay with target customers', evidence: 'Interview or survey results', owner: 'Product / Marketing' },
    { id: 'pri-packaging', label: 'Define packages, limits and upgrade triggers', evidence: 'Package matrix', owner: 'Product' },
    { id: 'pri-unit-economics', label: 'Check margin and unit economics per tier', evidence: 'Cost-to-serve per customer', owner: 'Finance' },
    { id: 'pri-discounts', label: 'Set discount rules and approval levels', evidence: 'Discount policy', owner: 'Sales / Finance', motions: B2B },
    { id: 'pri-checkout', label: 'Set up billing, checkout and plan limits', evidence: 'Tested purchase flow', owner: 'Product / Engineering', motions: SELF_SERVE },
  ],
  gate: { fields: ['pricing.model', 'pricing.entryOffer'], tableRows: { table: 'tiers', min: 1, requireCols: ['tier', 'price'] } },
}

// ---------------------------------------------------------------- Plan

const channels: SectionDef = {
  id: 'channels', number: '05', phase: 'plan', title: 'Channel strategy',
  intro: 'Choose channels based on how your audience discovers, evaluates and buys. Every channel needs a KPI and an owner.',
  tables: [{
    key: 'rows', title: 'Channel execution matrix',
    columns: [col('channel', 'Channel'), col('role', 'Funnel role'), col('audience', 'Audience'), col('offer', 'Offer / message'), col('asset', 'Asset'), col('budget', 'Budget', 'money'), col('kpi', 'KPI'), col('owner', 'Owner'), col('date', 'Launch date', 'date'), col('test', 'Test hypothesis', 'textarea'), col('status', 'Status', 'select', CHANNEL_STATUS)],
    defaultRows: [],
    blankRow: { channel: '', role: '', audience: '', offer: '', asset: '', budget: '', kpi: '', owner: '', date: '', test: '', status: 'Not started' },
    task: t('channel', 'date'),
  }],
  notices: ['Ticking a channel adds its row. Unticking removes it; rows with work in them are archived and come back when you tick the channel again.'],
  gate: { tableRows: { table: 'rows', min: 1, requireCols: ['channel', 'kpi', 'owner'] } },
}

/** Channel catalog for the selection checkboxes and default roles. */
export const CHANNEL_CATALOG: readonly { channel: string; role: string; owner: string }[] = [
  { channel: 'Paid search', role: 'Conversion', owner: 'Marketing' },
  { channel: 'Paid social', role: 'Awareness / acquisition', owner: 'Marketing' },
  { channel: 'SEO / AEO', role: 'Discovery', owner: 'Content / SEO' },
  { channel: 'Content marketing', role: 'Education / consideration', owner: 'Content' },
  { channel: 'Email / lifecycle', role: 'Nurture / retention', owner: 'Lifecycle' },
  { channel: 'Organic social', role: 'Awareness / trust', owner: 'Social' },
  { channel: 'Influencers / KOLs', role: 'Trust / reach', owner: 'Partnerships' },
  { channel: 'PR / media', role: 'Awareness / credibility', owner: 'PR' },
  { channel: 'Outbound sales', role: 'Pipeline', owner: 'Sales' },
  { channel: 'Partnerships / affiliates', role: 'Distribution', owner: 'Partnerships' },
  { channel: 'Events / webinars', role: 'Education / pipeline', owner: 'Marketing' },
  { channel: 'Product-led / referrals', role: 'Activation / growth', owner: 'Product / Growth' },
]

const funnel: SectionDef = {
  id: 'funnel', number: '06', phase: 'plan', title: 'Funnel & KPIs',
  intro: 'Work backward from the business outcome. Keep assumptions visible and review them against actual results.',
  calculator: 'funnel',
  fields: [
    { key: 'model', label: 'Funnel model', type: 'select', options: ['B2B pipeline', 'PLG / self-serve'], default: 'B2B pipeline', help: 'Defaults from the GTM motion.' },
    { key: 'customers', label: 'Target new customers', type: 'number', default: 10 },
    { key: 'cost', label: 'Cost per first-stage unit (e.g. per lead or sign-up)', type: 'money', default: 100 },
    { key: 'revenue', label: 'First-year revenue per customer', type: 'money', default: 12000 },
    { key: 'margin', label: 'Gross margin (%)', type: 'percent', default: 70 },
    { key: 'notes', label: 'Assumptions / source of rates', type: 'textarea', full: true },
  ],
  tables: [
    {
      key: 'stages', title: 'Funnel stages (conversion % from the previous stage)',
      columns: [col('stage', 'Stage'), col('rate', 'Conversion from previous (%)', 'percent')],
      defaultRows: [], // filled from FUNNEL_TEMPLATES by motion
      blankRow: { stage: '', rate: 50 },
    },
    {
      key: 'kpis', title: 'KPI scorecard',
      columns: [col('stage', 'Funnel stage'), col('kpi', 'Primary KPI'), col('target', 'Target'), col('baseline', 'Baseline'), col('source', 'Reporting source'), col('owner', 'Owner')],
      defaultRows: [
        { stage: 'Awareness', kpi: 'Reach / share of voice' },
        { stage: 'Acquisition', kpi: 'Qualified traffic / cost per lead' },
        { stage: 'Conversion', kpi: 'Stage conversion / win rate' },
        { stage: 'Revenue', kpi: 'Pipeline / bookings / ARR' },
        { stage: 'Activation', kpi: 'Activation / time to value' },
        { stage: 'Retention', kpi: 'Retention / churn / expansion' },
        { stage: 'Efficiency', kpi: 'CAC / ROAS / LTV:CAC' },
      ].map(r => ({ ...r, target: '', baseline: '', source: '', owner: '' })),
      blankRow: { stage: '', kpi: '', target: '', baseline: '', source: '', owner: '' },
    },
  ],
  notices: ['Spend covers the first funnel stage only. The model excludes revenue timing, churn and multi-touch attribution.'],
  gate: { fields: ['funnel.customers', 'funnel.cost', 'funnel.revenue'], tableRows: { table: 'kpis', min: 3, requireCols: ['kpi', 'target', 'owner'] } },
}

/** First stage has no rate; each later rate converts from the stage before it. */
export const FUNNEL_TEMPLATES = {
  'B2B pipeline': [
    { stage: 'Lead', rate: 100 },
    { stage: 'MQL', rate: 40 },
    { stage: 'SQL', rate: 50 },
    { stage: 'Opportunity', rate: 50 },
    { stage: 'Customer', rate: 20 },
  ],
  'PLG / self-serve': [
    { stage: 'Sign-up', rate: 100 },
    { stage: 'Activated', rate: 35 },
    { stage: 'Paid', rate: 15 },
  ],
} as const
export type FunnelModel = keyof typeof FUNNEL_TEMPLATES
export const funnelModelFor = (motion: Motion): FunnelModel => (motion === 'PLG' ? 'PLG / self-serve' : 'B2B pipeline')

const budget: SectionDef = {
  id: 'budget', number: '07', phase: 'plan', title: 'Budget & resources',
  intro: 'Track the full cost of execution: media, production, tooling, agencies and contingency.',
  calculator: 'budget',
  tables: [{
    key: 'rows', title: 'Budget tracker',
    columns: [col('category', 'Cost category'), col('planned', 'Planned', 'money'), col('actual', 'Actual', 'money'), col('owner', 'Owner')],
    defaultRows: ['Paid media', 'Content and creative', 'Website / landing pages', 'Events / webinars', 'PR / influencers / partnerships', 'Marketing tools / data', 'Agency / contractor costs', 'Contingency']
      .map(category => ({ category, planned: '', actual: '', owner: '' })),
    blankRow: { category: '', planned: '', actual: '', owner: '' },
  }],
  notices: ['Include internal capacity. A funded launch can still slip if Product, Design or Sales cannot deliver on time.'],
  gate: { fields: ['brief.budget'], tableRows: { table: 'rows', min: 2, requireCols: ['category', 'planned'] } },
}

const assets: SectionDef = {
  id: 'assets', number: '08', phase: 'plan', title: 'Assets & content',
  intro: 'Turn strategy into deliverables with owners, due dates, reviewers and a clear status.',
  tables: [
    {
      key: 'rows', title: 'Asset production tracker',
      columns: [col('asset', 'Asset / deliverable'), col('purpose', 'Purpose'), col('owner', 'Owner'), col('due', 'Due date', 'date'), col('status', 'Status', 'select', ASSET_STATUS), col('reviewer', 'Reviewer'), col('quantity', 'Quantity / format')],
      defaultRows: [
        ['Messaging & positioning document', 'Align communication', 'Marketing'],
        ['Landing page / website updates', 'Convert target audience', 'Web / Marketing'],
        ['Paid media creatives', 'Generate demand', 'Performance Marketing'],
        ['Organic social content', 'Build awareness and trust', 'Content / Social'],
        ['Email sequences', 'Nurture and activate', 'Lifecycle Marketing'],
        ['Sales deck & one-pager', 'Support sales conversations', 'Product Marketing'],
        ['Demo / product walkthrough', 'Explain product value', 'Product / Sales'],
        ['Case study / testimonials', 'Establish credibility', 'Marketing / CS'],
        ['PR / launch announcement', 'Build awareness and authority', 'PR / Marketing'],
      ].map(([asset, purpose, owner]) => ({ asset, purpose, owner, due: '', status: 'Not started', reviewer: '', quantity: '' })),
      blankRow: { asset: '', purpose: '', owner: '', due: '', status: 'Not started', reviewer: '', quantity: '' },
      task: t('asset'),
    },
    {
      key: 'calendar', title: 'Campaign & content calendar',
      columns: [col('date', 'Date', 'date'), col('channel', 'Channel'), col('activity', 'Activity'), col('audience', 'Audience'), col('cta', 'CTA'), col('kpi', 'KPI'), col('owner', 'Owner'), col('status', 'Status', 'select', CAL_STATUS)],
      defaultRows: [],
      blankRow: { date: '', channel: '', activity: '', audience: '', cta: '', kpi: '', owner: '', status: 'Planned' },
      task: t('activity', 'date'),
    },
  ],
  gate: { tableRows: { table: 'rows', min: 3, requireCols: ['asset', 'owner', 'due'] } },
}

// ---------------------------------------------------------------- Readiness

const tracking: SectionDef = {
  id: 'tracking', number: '09', phase: 'readiness', title: 'Analytics & tracking',
  intro: 'Make sure you can measure the journey from first touch to conversion, revenue and retention.',
  checklist: [
    { id: 'trk-stages', label: 'Define funnel stages and shared qualification criteria', evidence: 'Stage definitions (e.g. MQL / SQL, or activation)', owner: 'Marketing / Sales' },
    { id: 'trk-events', label: 'Implement analytics and conversion events', evidence: 'Event map and tested conversions', owner: 'Analytics' },
    { id: 'trk-activation', label: 'Define the activation event and instrument it', evidence: 'Activation definition + event firing', owner: 'Product / Analytics', motions: SELF_SERVE },
    { id: 'trk-utm', label: 'Configure campaign naming and UTM parameters', evidence: 'Naming convention and UTM guide', owner: 'Growth' },
    { id: 'trk-connect', label: 'Connect ad platforms, CRM, website, and product analytics', evidence: 'Verified data flow', owner: 'RevOps' },
    { id: 'trk-lead-qa', label: 'Test lead capture, validation, routing, and attribution', evidence: 'End-to-end QA', owner: 'RevOps', motions: B2B },
    { id: 'trk-dashboard', label: 'Build dashboard for spend, funnel, pipeline, and revenue', evidence: 'Dashboard and access', owner: 'Analytics' },
    { id: 'trk-scoring', label: 'Configure lead scoring and nurture flows where relevant', evidence: 'Scoring and automation rules', owner: 'Lifecycle Marketing', motions: B2B },
    { id: 'trk-privacy', label: 'Confirm consent, privacy, and data-retention requirements', evidence: 'Required approvals', owner: 'Legal / Compliance' },
    { id: 'trk-journey-qa', label: 'Test the full customer journey on mobile and desktop', evidence: 'QA results and fixes', owner: 'Product / Marketing' },
    { id: 'trk-owner', label: 'Assign dashboard owner and reporting frequency', evidence: 'Named owner and cadence', owner: 'GTM Lead' },
  ],
  fields: [{ key: 'notes', label: 'Tracking plan, event names, attribution rules, dashboard links', type: 'textarea', full: true }],
  gate: { checklistMin: 0.8 },
}

const teams: SectionDef = {
  id: 'teams', number: '10', phase: 'readiness', title: 'Team alignment & enablement',
  intro: 'Make cross-functional handoffs explicit. Every responsibility needs an owner, a deliverable and a deadline.',
  tables: [{
    key: 'rows', title: 'Responsibilities',
    columns: [col('team', 'Team'), col('responsibility', 'Responsibility'), col('deliverable', 'Required deliverable'), col('owner', 'Owner'), col('due', 'Due date', 'date'), col('status', 'Status', 'select', STATUS)],
    defaultRows: [
      ['Marketing', 'Positioning, campaigns, demand, measurement', 'Campaign plan and KPI dashboard'],
      ['Product', 'Product readiness and roadmap', 'Launch scope and release sign-off'],
      ['Sales', 'Qualification, follow-up, closing', 'Sales playbook and follow-up SLA'],
      ['Customer Success', 'Onboarding, adoption, retention', 'Onboarding and escalation plan'],
      ['RevOps / Analytics', 'CRM, routing, attribution', 'Tested data flow and reporting'],
      ['Finance', 'Budget, pricing, unit economics', 'Budget and commercial approval'],
      ['Legal / Compliance', 'Claims, privacy, regulatory requirements', 'Required approvals'],
      ['Executive sponsor', 'Direction, resources, decisions', 'Final go/no-go approval'],
    ].map(([team, responsibility, deliverable]) => ({ team, responsibility, deliverable, owner: '', due: '', status: 'Not started' })),
    blankRow: { team: '', responsibility: '', deliverable: '', owner: '', due: '', status: 'Not started' },
    task: t('deliverable'),
  }],
  notices: ['B2B: define qualification, response SLA, sales sequence and feedback loop. PLG: define onboarding, activation, support and upgrade paths.'],
  gate: { tableRows: { table: 'rows', min: 4, requireCols: ['team', 'owner', 'due'] } },
}

const roadmap: SectionDef = {
  id: 'roadmap', number: '11', phase: 'readiness', title: 'Execution roadmap',
  intro: 'Master milestone tracker. Due dates are calculated from the launch date; dependencies warn when a prerequisite is not done.',
  tables: [{
    key: 'rows', title: 'Milestones',
    columns: [col('timing', 'Timing'), col('offsetWeeks', 'Weeks from launch', 'number'), col('workstream', 'Workstream'), col('deliverables', 'Deliverables', 'textarea'), col('exit', 'Exit criteria', 'textarea'), col('dependsOn', 'Depends on (workstream)'), col('owner', 'Owner'), col('due', 'Due date', 'date'), col('status', 'Status', 'select', STATUS)],
    defaultRows: [
      [-8, 'Discovery', 'Market research, customer insights, baseline', 'Opportunity validated', ''],
      [-7, 'ICP & positioning', 'ICP, personas, value proposition', 'Stakeholder approval', 'Discovery'],
      [-6, 'Strategy', 'GTM motion, channels, funnel, pricing, budget', 'Plan approved', 'ICP & positioning'],
      [-5, 'Creative & content', 'Messaging, creative briefs, content plan', 'Production underway', 'Strategy'],
      [-4, 'Infrastructure', 'Landing pages, CRM, tracking, automation', 'Initial QA passed', 'Strategy'],
      [-3, 'Production', 'Campaign assets, enablement', 'Core assets complete', 'Creative & content'],
      [-2, 'Testing', 'QA, pilot campaigns, training', 'Critical issues resolved', 'Infrastructure'],
      [-1, 'Launch readiness', 'Final checks, approvals, contingency plan', 'Go/no-go decision', 'Testing'],
      [0, 'Activation', 'Campaigns live, launch communications', 'Tracking and routing verified', 'Launch readiness'],
      [1, 'Early optimization', 'Initial performance review, fixes', 'Priority improvements assigned', 'Activation'],
      [2, 'Optimization', 'Creative, channel, and funnel tests', 'Test decisions documented', 'Early optimization'],
      [3, 'Commercial review', 'Pipeline, conversion, feedback', 'Bottlenecks addressed', 'Optimization'],
      [4, 'Scale decision', 'Performance review and next-month plan', 'Scale, iterate, or stop', 'Commercial review'],
    ].map(([offsetWeeks, workstream, deliverables, exit, dependsOn]) => ({
      timing: timingLabel(offsetWeeks as number), offsetWeeks, workstream, deliverables, exit, dependsOn, owner: '', due: '', status: 'Not started',
    })),
    blankRow: { timing: '', offsetWeeks: '', workstream: '', deliverables: '', exit: '', dependsOn: '', owner: '', due: '', status: 'Not started' },
    task: t('workstream'),
  }],
  gate: { fields: ['brief.launchDate'], tableRows: { table: 'rows', min: 5, requireCols: ['workstream', 'owner'] } },
}

export function timingLabel(weeks: number): string {
  if (weeks === 0) return 'Launch week'
  const n = Math.abs(weeks)
  return `T${weeks < 0 ? '−' : '+'}${n} week${n === 1 ? '' : 's'}`
}

const risks: SectionDef = {
  id: 'risks', number: '12', phase: 'readiness', title: 'Risk register',
  intro: 'Identify what could derail the launch, assess probability and impact, and assign mitigation owners.',
  tables: [{
    key: 'rows', title: 'Risks',
    columns: [col('risk', 'Risk'), col('probability', 'Probability', 'select', LEVEL), col('impact', 'Impact', 'select', LEVEL), col('mitigation', 'Mitigation / contingency', 'textarea'), col('owner', 'Owner'), col('status', 'Status', 'select', ['Open', 'Mitigating', 'Accepted', 'Resolved'])],
    defaultRows: [
      ['Launch delay', 'Medium', 'High', 'Prioritize must-have scope; define fallback'],
      ['Poor campaign conversion', 'Medium', 'High', 'Pre-launch tests; alternative messaging'],
      ['Acquisition costs too high', 'Medium', 'High', 'Spending thresholds and stop-loss rules'],
      ['Slow follow-up or onboarding', 'Medium', 'Medium', 'SLA, alerts, ownership'],
      ['Tracking failure', 'Low', 'High', 'QA, monitoring, backup reporting'],
      ['Product or compliance issue', 'Low', 'High', 'Approval gates and escalation plan'],
    ].map(([risk, probability, impact, mitigation]) => ({ risk, probability, impact, mitigation, owner: '', status: 'Open' })),
    blankRow: { risk: '', probability: 'Medium', impact: 'Medium', mitigation: '', owner: '', status: 'Open' },
    task: { titleKey: 'risk', ownerKey: 'owner', dueKey: '', statusKey: 'status' },
  }],
  gate: { tableRows: { table: 'rows', min: 3, requireCols: ['risk', 'mitigation', 'owner'] } },
}

const launch: SectionDef = {
  id: 'launch', number: '13', phase: 'readiness', title: 'Go / no-go',
  intro: 'Use in the go/no-go meeting. A completed checklist does not replace a formal decision.',
  checklist: [
    { id: 'lch-product', label: 'Product / offer is ready and accessible', evidence: 'Product and customer experience', owner: 'Product' },
    { id: 'lch-pricing', label: 'Pricing, terms, and availability are correct', evidence: 'Commercial details verified', owner: 'Product / Finance' },
    { id: 'lch-checkout', label: 'Paywall, checkout and plan limits are tested', evidence: 'Test purchases completed', owner: 'Product', motions: SELF_SERVE },
    { id: 'lch-support', label: 'Support and escalation processes are staffed', evidence: 'Support workflow confirmed', owner: 'Customer Success' },
    { id: 'lch-assets', label: 'Landing pages and core assets are live', evidence: 'Pages and assets QA approved', owner: 'Marketing' },
    { id: 'lch-campaigns', label: 'Campaigns, budgets, targeting, and links are verified', evidence: 'Campaign QA complete', owner: 'Growth' },
    { id: 'lch-distribution', label: 'Email, social, PR, and partner schedules are confirmed', evidence: 'Distribution schedule locked', owner: 'Marketing' },
    { id: 'lch-tracking', label: 'Conversion tracking and dashboards work', evidence: 'Test conversions visible', owner: 'Analytics' },
    { id: 'lch-routing', label: 'Lead routing and sales follow-up are tested', evidence: 'SLA and CRM routing confirmed', owner: 'Sales / RevOps', motions: B2B },
    { id: 'lch-owners', label: 'Owners, escalation contacts, and reporting cadence are confirmed', evidence: 'Launch room and contacts ready', owner: 'GTM Lead' },
    { id: 'lch-legal', label: 'Required legal and compliance approvals are complete', evidence: 'Formal approvals received', owner: 'Legal / Compliance' },
    { id: 'lch-risks', label: 'Known risks have owners and mitigations', evidence: 'Risk register reviewed', owner: 'GTM Lead' },
    { id: 'lch-approval', label: 'Decision-maker has approved launch', evidence: 'Formal go/no-go decision', owner: 'Executive sponsor' },
  ],
  fields: [
    { key: 'decision', label: 'Go / no-go decision', type: 'select', options: ['Pending', 'Go', 'Conditional go', 'No-go'], default: 'Pending' },
    { key: 'decisionOwner', label: 'Decision owner', type: 'text' },
    { key: 'decisionDate', label: 'Decision date', type: 'date' },
    { key: 'notes', label: 'Open blockers, conditions, or decision notes', type: 'textarea', full: true },
  ],
  notices: ['Do not waive a critical security, compliance, or product-readiness blocker to meet a date.'],
  gate: { fields: ['launch.decisionOwner', 'launch.decisionDate'], checklistMin: 1 },
}

// ---------------------------------------------------------------- Run & Learn

const optimize: SectionDef = {
  id: 'optimize', number: '14', phase: 'run', title: 'Optimization & experiments',
  intro: 'Scheduled reviews that turn data into decisions. Record outcomes and next actions.',
  tables: [{
    key: 'rows', title: 'Review schedule',
    columns: [col('review', 'Review timing'), col('questions', 'Questions to answer', 'textarea'), col('actions', 'Possible actions', 'textarea'), col('owner', 'Owner'), col('date', 'Review date', 'date'), col('result', 'Outcome / decision', 'textarea')],
    defaultRows: [
      ['First 48–72 hours', 'Is tracking working? Are campaigns delivering?', 'Fix technical issues; correct spend or routing'],
      ['End of week 1', 'Are we reaching the right audience?', 'Refine targeting and messaging'],
      ['End of week 2', 'Where is funnel conversion breaking?', 'Test landing page, offer, nurture, or follow-up'],
      ['End of week 3', 'Are leads becoming pipeline or users active?', 'Improve qualification and activation'],
      ['Day 30', 'Are economics and outcomes on target?', 'Scale winners, revise assumptions, or stop weak channels'],
      ['Day 60–90', 'Are customers retained and generating value?', 'Optimize onboarding, retention, expansion, and LTV'],
    ].map(([review, questions, actions]) => ({ review, questions, actions, owner: '', date: '', result: '' })),
    blankRow: { review: '', questions: '', actions: '', owner: '', date: '', result: '' },
  }],
  fields: [{ key: 'notes', label: 'Experiment log / learnings', type: 'textarea', full: true, help: 'Observation → Hypothesis → Change → Success metric → Decision date → Outcome.' }],
  gate: { tableRows: { table: 'rows', min: 3, requireCols: ['owner', 'date'] } },
}

const cadence: SectionDef = {
  id: 'cadence', number: '15', phase: 'run', title: 'Operating cadence',
  intro: 'A short recurring meeting that makes decisions and removes blockers, not a status read-out.',
  fields: [
    { key: 'cadence', label: 'Review cadence', type: 'select', options: ['Twice weekly', 'Weekly', 'Biweekly'], default: 'Weekly' },
    { key: 'attendees', label: 'Required attendees', type: 'textarea' },
    { key: 'agenda', label: 'Agenda', type: 'textarea', full: true, default: 'Scorecard; channel performance; execution blockers; experiments; decisions' },
    { key: 'notes', label: 'Decisions, action items, owner, due date', type: 'textarea', full: true },
  ],
  gate: { fields: ['cadence.attendees'] },
}

const retro: SectionDef = {
  id: 'retro', number: '16', phase: 'run', title: 'Retro & handover',
  intro: 'Capture what you learned and make sure someone else could run the plan without you.',
  fields: [
    { key: 'worked', label: 'What worked', type: 'textarea' },
    { key: 'didnt', label: "What didn't work", type: 'textarea' },
    { key: 'reuse', label: 'What to reuse next launch', type: 'textarea' },
    { key: 'notes', label: 'Handover notes, links to working docs, key decisions', type: 'textarea', full: true },
  ],
  checklist: [
    { id: 'ho-brief', label: 'Approved GTM brief and business objectives', evidence: 'Signed-off launch brief', owner: 'GTM Lead' },
    { id: 'ho-research', label: 'Market research, ICP, personas, and positioning', evidence: 'Research and messaging pack', owner: 'Marketing' },
    { id: 'ho-channels', label: 'Channel strategy and campaign hypotheses', evidence: 'Channel plan', owner: 'Growth' },
    { id: 'ho-funnel', label: 'Funnel model, KPI definitions, and forecasts', evidence: 'KPI scorecard and forecast', owner: 'Growth / Analytics' },
    { id: 'ho-calendar', label: 'Campaign and content calendar', evidence: 'Dated calendar', owner: 'Content / Marketing' },
    { id: 'ho-assets', label: 'Asset production tracker', evidence: 'Asset tracker with owners', owner: 'Marketing' },
    { id: 'ho-budget', label: 'Budget and resource allocation', evidence: 'Approved budget', owner: 'GTM Lead / Finance' },
    { id: 'ho-tracking', label: 'Analytics, tracking, and dashboard specification', evidence: 'Measurement plan', owner: 'Analytics' },
    { id: 'ho-enablement', label: 'Sales / customer success enablement and handoff process', evidence: 'Playbooks and SLA', owner: 'Sales / CS' },
    { id: 'ho-roadmap', label: 'Master roadmap with milestones, dependencies, and owners', evidence: 'Execution roadmap', owner: 'GTM Lead' },
    { id: 'ho-golive', label: 'Launch-day go/no-go checklist', evidence: 'Completed readiness review', owner: 'GTM Lead' },
    { id: 'ho-optimize', label: 'Post-launch optimization and experiment plan', evidence: '30/60/90-day review plan', owner: 'Growth' },
    { id: 'ho-risks', label: 'Risk register and contingency plan', evidence: 'Risk mitigations assigned', owner: 'GTM Lead' },
    { id: 'ho-cadence', label: 'Weekly reporting and decision-making cadence', evidence: 'Recurring review scheduled', owner: 'GTM Lead' },
  ],
  notices: ['A generated GTM one-pager (DOCX/PDF) will replace most of this checklist in Step 10.'],
  gate: { fields: ['retro.worked', 'retro.reuse'], checklistMin: 0.8 },
}

export const SECTIONS: readonly SectionDef[] = [
  brief, research, positioning, pricing,
  channels, funnel, budget, assets,
  tracking, teams, roadmap, risks, launch,
  optimize, cadence, retro,
]

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map(s => [s.id, s])) as Record<SectionDef['id'], SectionDef>

export function checklistFor(section: SectionDef, motion: Motion): readonly ChecklistItem[] {
  return (section.checklist ?? []).filter(i => !i.motions || i.motions.includes(motion))
}

export function tableDef(section: SectionDef, key: string): TableDef | undefined {
  return section.tables?.find(tb => tb.key === key)
}
