// Domain vocabulary shared by the API and the UI (served via GET /api/meta).
// Bureau list is sample configuration for the prototype and can be extended.

export const BUREAUS = [
  { code: 'PGRC', name: 'Public Grievance Redressal Cell' },
  { code: 'RB', name: 'Regulation Bureau' },
  { code: 'AB', name: 'Approval Bureau' },
];
export const BUREAU_CODES = BUREAUS.map((b) => b.code);

export const CATEGORIES = [
  { code: 'fee_refund', label: 'Fee refund', slaDays: 21 },
  { code: 'excess_fee', label: 'Excess / unapproved fee', slaDays: 30 },
  { code: 'admission', label: 'Admission irregularity', slaDays: 30 },
  { code: 'certificates', label: 'Certificates withheld', slaDays: 15 },
  { code: 'faculty', label: 'Faculty / staff shortage', slaDays: 45 },
  { code: 'infrastructure', label: 'Infrastructure / labs', slaDays: 45 },
  { code: 'hostel', label: 'Hostel & amenities', slaDays: 30 },
  { code: 'harassment', label: 'Harassment / ragging', slaDays: 7 },
  { code: 'scholarship', label: 'Scholarship disbursal', slaDays: 30 },
  { code: 'approval', label: 'Approval / intake violation', slaDays: 60 },
  { code: 'other', label: 'Other', slaDays: 30 },
];
export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);
export const categoryLabel = (code) => CATEGORIES.find((c) => c.code === code)?.label || code;
export const slaDaysFor = (code) => CATEGORIES.find((c) => c.code === code)?.slaDays || 30;

export const CHANNELS = [
  { code: 'portal', label: 'Online portal' },
  { code: 'email', label: 'Email' },
  { code: 'cpgrams', label: 'CPGRAMS' },
  { code: 'letter', label: 'Letter / post' },
  { code: 'inspection', label: 'Inspection / suo motu' },
];
export const CHANNEL_CODES = CHANNELS.map((c) => c.code);

export const STATUSES = [
  { code: 'registered', label: 'Registered', open: true },
  { code: 'under_review', label: 'Under review', open: true },
  { code: 'awaiting_institution', label: 'Awaiting institution', open: true },
  { code: 'coordination', label: 'In coordination', open: true },
  // Closed on the institution's written promise; stays open in the Promise Ledger
  // until the complainant confirms the promise was kept.
  { code: 'resolved_on_promise', label: 'Resolved on promise', open: false },
  { code: 'resolved', label: 'Resolved', open: false },
  { code: 'closed', label: 'Closed', open: false },
];
export const STATUS_CODES = STATUSES.map((s) => s.code);
export const OPEN_STATUSES = STATUSES.filter((s) => s.open).map((s) => s.code);

// Allowed status transitions. Closing is deliberately one-way.
export const TRANSITIONS = {
  registered: ['under_review', 'awaiting_institution', 'coordination', 'resolved'],
  under_review: ['awaiting_institution', 'coordination', 'resolved'],
  awaiting_institution: ['under_review', 'coordination', 'resolved'],
  coordination: ['under_review', 'awaiting_institution', 'resolved'],
  resolved: ['closed', 'under_review'],
  resolved_on_promise: ['under_review'],
  closed: [],
};

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const ROLES = [
  { code: 'officer', label: 'Bureau officer' },
  { code: 'bureau_head', label: 'Bureau head' },
  { code: 'senior_reviewer', label: 'Senior reviewer' },
  { code: 'admin', label: 'Administrator' },
  { code: 'institution', label: 'Institution (portal)' },
];
export const STAFF_ROLES = ['officer', 'bureau_head', 'senior_reviewer', 'admin'];
export const ROLE_CODES = ROLES.map((r) => r.code);

// Escalation chain. Deadlines come from each category's slaDays.
//   reminderAt: fraction of the SLA after which the assigned officer is reminded
//   levels: who is alerted once a case is overdue by afterOverdueDays
export const ESCALATION = {
  reminderAt: 0.8,
  levels: [
    { level: 1, afterOverdueDays: 0, roles: ['bureau_head'], sameBureau: true, label: 'Escalated to bureau head' },
    { level: 2, afterOverdueDays: 7, roles: ['senior_reviewer'], sameBureau: false, label: 'Escalated to senior reviewer' },
  ],
};

// Watchlist: flags unusual complaint volume per institution and category.
// It describes a trend only — never guilt or wrongdoing.
export const WATCHLIST = {
  windowDays: 60, // recent window
  baselineDays: 365, // history before the window used as the normal rate
  minCount: 3, // at least this many complaints in the window
  minRatio: 2, // and at least this multiple of the expected (baseline) count
};

// Promise Ledger: institution commitments tracked as debts.
export const PROMISES = {
  vagueDefaultDays: 30, // check-in date when a promise names no deadline
  confirmWindowDays: 7, // complainant has this long to answer the check-in
  // Copy-paste replies: near-identical reply text sent to several complainants.
  templateSimilarity: 0.6, // word 3-gram Jaccard similarity that counts as "same text"
  templateMinOthers: 2, // flag when this many other complainants got the same text
};

// Overlap engine configuration.
export const OVERLAP = {
  ruleWindowDays: 120, // same institution + same category within this window => related
  candidateLimit: 300, // max same-institution cases compared per new case
  ruleScore: 0.65,
};
