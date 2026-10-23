import {
  Bell,
  Building2,
  CalendarClock,
  Compass,
  Copy,
  Download,
  FileStack,
  FileUp,
  Filter,
  GitMerge,
  HandCoins,
  History,
  Inbox,
  Languages,
  Layers,
  LayoutDashboard,
  Network,
  Radar,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

// Each page has its own short tour. `target` matches data-tour="…"; `alt`
// targets are tried when the first is hidden (sidebar items live behind the
// menu button on phones). Steps whose target is missing are skipped, and
// steps without a target are shown centred.

const OVERVIEW = [
  {
    welcome: true,
    title: (u) => `Welcome to CaseLink, ${u.name.split(' ')[0]}`,
    body: 'CaseLink links every complaint to the institution it is about, across all AICTE bureaus — so related cases are seen together, and no complaint is closed on an empty promise. Each page has its own short tour; this one covers the overview.',
  },
  { target: 'stats', icon: LayoutDashboard, title: 'The four numbers that matter', body: 'Open cases, overlap alerts waiting for a decision, open promises (with how many institutions actually kept) and overdue cases — across every bureau.' },
  { target: 'hotspots', icon: Network, title: 'How open cases connect', body: 'Each ribbon is open cases flowing from a bureau to an institution — wider means more. A pulsing dot marks a cross-bureau overlap waiting for review. Hover for numbers; click an institution to open it.' },
  { target: 'promise-card', icon: HandCoins, title: 'Promise Ledger', body: 'When an institution answers “refund in 30 days”, CaseLink tracks that promise. On the deadline the complainant is asked if it happened — a “No” reopens the case. This is the Promise Kept Rate across all institutions.' },
  { target: 'register', alt: ['nav-cases', 'menu'], roles: ['officer', 'bureau_head', 'admin'], icon: FileStack, title: 'Register a case', body: 'Register a complaint in English, Hindi or Hinglish. On save it is checked against every other case of that institution in every bureau.' },
  { target: 'nav-overlaps', alt: ['menu'], icon: GitMerge, title: 'Overlap alerts', body: 'Possible duplicates and related cases with the evidence for each match. You decide — nothing is merged automatically.' },
  { target: 'bell', icon: Bell, title: 'Notifications', body: 'Overlaps, coordination requests, deadlines, escalations, institution replies and broken promises arrive here.' },
  { target: 'page-tour', icon: Compass, title: 'A tour on every page', body: 'Every page has its own short tour. It opens the first time you visit a page after signing in; this button replays it.' },
  { target: 'user', alt: ['menu'], icon: UserRound, title: 'Your account', body: 'Your role and bureau decide what you can see and change.' },
];

const INSTITUTIONS = [
  { target: 'page-header', icon: Building2, title: 'Institutions', body: 'Every institution is identified by its AICTE Permanent ID, so complaints from all bureaus attach to one record.' },
  { target: 'inst-search', icon: Search, title: 'Search', body: 'Filter by name, city, state or Permanent ID.' },
  { target: 'inst-grid', icon: HandCoins, title: 'At a glance', body: 'Each card shows the bureaus with open cases, pending overlap alerts and — once known — the share of written promises the institution actually kept. Open a card for its Institution 360.' },
];

const INSTITUTION_360 = [
  { target: 'i360-hero', icon: Building2, title: 'One institution, one record', body: 'Everything about this institution from PGRC, RB and AB. The orange banner appears when the same issue may be handled by more than one bureau; the coloured chip is its Promise Kept Rate.' },
  { target: 'i360-stats', icon: Layers, title: 'Key figures', body: 'Open cases, bureaus involved, overlaps waiting for review and overdue cases for this institution.' },
  { target: 'i360-tabs', icon: History, title: 'Four views', body: 'By bureau: cases side by side. Overlaps: duplicate and related cases with evidence. Promises: what the institution committed to in writing and whether it delivered. Timeline: every action on every case.' },
];

const CASES = [
  { target: 'page-header', icon: FileStack, title: 'All cases', body: 'Every institution case across bureaus. Complainant details are masked for cases outside your bureau.' },
  { target: 'cases-filters', icon: Filter, title: 'Filters', body: 'Search by case reference, subject or Permanent ID, and narrow by bureau, status or issue.' },
  { target: 'cases-list', icon: CalendarClock, title: 'Deadlines and escalations', body: 'Each row shows its deadline. Overdue cases escalate automatically — first to the bureau head, then to a senior reviewer.' },
];

const CASE_NEW = [
  { target: 'new-pid', icon: Building2, title: 'Start with the Permanent ID', body: 'Type the AICTE Permanent ID; the institution and its open cases appear below it.' },
  { target: 'new-demo', icon: FileStack, title: 'Demo complaint', body: 'Fills in a Hindi fee-refund complaint about Sunrise Institute — the demo scenario.' },
  { target: 'new-description', icon: Languages, title: 'Any language', body: 'Hindi, English or Hinglish. The language is detected as you type, and matching works across languages.' },
  { target: 'new-submit', icon: Send, title: 'Register and check', body: 'On save, the case is compared with every other case of the institution in every bureau. Possible overlaps are shown straight away with their evidence.' },
];

const CASE_DETAIL = [
  { target: 'case-header', icon: FileStack, title: 'The case', body: 'Status, priority, deadline and any escalation. Only the owning bureau can change the case.' },
  { target: 'closureguard', icon: ShieldCheck, title: 'ClosureGuard', body: 'Record the institution’s reply here. ClosureGuard checks it against every concern in the complaint, flags missing evidence and copy-paste replies, and pulls out any promises. You decide: accept, request more, or resolve on promise.' },
  { target: 'case-ledger', icon: HandCoins, title: 'Promise ledger', body: 'Promises tracked for this case. On each date the complainant is asked if it was kept; a “No” reopens the case and raises its priority.' },
  { target: 'case-overlaps', icon: GitMerge, title: 'Related cases', body: 'Duplicates and related cases in any bureau, with the evidence for each match.' },
  { target: 'case-history', icon: History, title: 'History', body: 'Every action on this case — by officers, the institution, the complainant and the system.' },
];

const OVERLAPS = [
  { target: 'page-header', icon: GitMerge, title: 'Overlap alerts', body: 'Found by three layers: exact identifiers, rules, and multilingual semantic matching. Each needs a human decision.' },
  { target: 'ov-tabs', icon: Layers, title: 'Queues', body: 'Pending review, coordination requested, linked and dismissed.' },
  { target: 'ov-filters', icon: Filter, title: 'Focus', body: 'Show only overlaps that span bureaus, or only those involving your bureau.' },
  { target: 'ov-list', icon: ShieldCheck, title: 'Evidence first', body: 'Each card shows why the cases were matched. Link them, request coordination with the other bureau, or dismiss — with a reason that is recorded.' },
];

const PROMISES = [
  { target: 'page-header', icon: HandCoins, title: 'The Promise Ledger', body: 'Every grievance system tracks complaints. CaseLink tracks promises — because that is where institutions escape. Each written promise is a debt until the complainant confirms it.' },
  { target: 'ledger-stats', icon: CalendarClock, title: 'Where promises stand', body: 'Open promises, those due within a week, those waiting for the complainant’s answer, and those broken.' },
  { target: 'ledger-rate', icon: HandCoins, title: 'Promise Kept Rate', body: 'Institutions are judged on their own written words, not on an AI guess. The Approval Bureau sees this rate at approval renewal.' },
  { target: 'ledger-tabs', icon: Filter, title: 'Views', body: 'Open, due soon, asking the complainant, broken, kept, or all.' },
  { target: 'ledger-list', icon: Send, title: 'Each promise', body: 'The institution’s exact words, the amount and the date. In the demo, “Fast-forward to deadline” sends the complainant’s one-tap check-in straight away.' },
];

const WATCHLIST = [
  { target: 'wl-note', icon: Radar, title: 'A trend, not a finding', body: 'The Watchlist shows that complaint volume has changed. It is never a judgement of wrongdoing and has no risk score.' },
  { target: 'wl-grid', icon: Building2, title: 'Unusual volume', body: 'Institutions with far more complaints in one category than their own usual level. Open one in Institution 360 to look at the cases.' },
];

const AUDIT = [
  { target: 'audit-chain', icon: ShieldCheck, title: 'Tamper-evident', body: 'Each entry carries the fingerprint of the previous one, so any edit or deletion breaks the chain and shows up here.' },
  { target: 'audit-filters', icon: Filter, title: 'Filter', body: 'Sign-ins, cases, overlaps or institution views.' },
  { target: 'audit-list', icon: ScrollText, title: 'Every action', body: 'Who did what and when — including views of personal data.' },
];

const IMPORT = [
  { target: 'page-header', icon: FileUp, title: 'Import cases', body: 'Bring in complaints exported from CPGRAMS or a spreadsheet until a live connection is authorised.' },
  { target: 'import-template', icon: Download, title: 'Template', body: 'Download the CSV template to see the expected columns.' },
  { target: 'import-drop', icon: FileUp, title: 'Check, then import', body: 'Drop a CSV or JSON file. Every row is checked first; nothing is saved until you confirm.' },
];

const POLICY = [
  { target: 'page-header', icon: ShieldCheck, title: 'Data & security', body: 'How CaseLink handles grievance data, who can see what, and how decisions stay accountable.' },
  { target: 'policy-grid', icon: Copy, title: 'Plain-language policy', body: 'Roles, masking, AI use, audit integrity and security controls — and what must happen before production.' },
];

export const PORTAL_TOUR = [
  { welcome: true, title: () => 'Welcome to the CaseLink portal', body: 'This is where your institution sees complaints forwarded by AICTE and sends its response.' },
  { target: 'portal-stats', icon: Inbox, title: 'What needs your attention', body: 'Complaints awaiting your reply, open complaints and any past their deadline.' },
  { target: 'portal-cases', icon: FileStack, title: 'Your complaints', body: 'Cases marked “Your reply needed” come first. Open one to respond with the action taken and evidence references such as a UTR number.', tip: 'The complainant’s identity is never shared through the portal.' },
  { target: 'bell', icon: Bell, title: 'Notifications', body: 'You are notified when AICTE forwards a complaint, asks for further action, or a complainant reports a promise was not kept.' },
  { target: 'tour-replay', icon: Compass, title: 'You’re all set', body: 'An AICTE officer reviews every response before a complaint is closed. Replay this tour from this button.' },
];

const PORTAL_CASE = [
  { target: 'page-header', alt: ['portal-responses'], icon: FileStack, title: 'The complaint', body: 'What the complainant reported. Their identity is not shared with the institution.' },
  { target: 'portal-commitments', icon: HandCoins, title: 'Your commitments', body: 'Promises AICTE recorded from your replies. On each date the complainant is asked whether it was kept — if not, the complaint reopens and your Promise Kept Rate drops.' },
  { target: 'portal-responses', icon: Send, title: 'Respond', body: 'Describe the action taken on every point, with evidence references. Promise only what you will deliver.' },
];

/** Picks the tour for a route. Returns { key, steps }. */
export function tourFor(pathname) {
  const routes = [
    [/^\/$/, 'overview', OVERVIEW],
    [/^\/institutions\/[^/]+$/, 'institution-360', INSTITUTION_360],
    [/^\/institutions\/?$/, 'institutions', INSTITUTIONS],
    [/^\/cases\/new$/, 'case-new', CASE_NEW],
    [/^\/cases\/[^/]+$/, 'case-detail', CASE_DETAIL],
    [/^\/cases\/?$/, 'cases', CASES],
    [/^\/overlaps/, 'overlaps', OVERLAPS],
    [/^\/promises/, 'promises', PROMISES],
    [/^\/watchlist/, 'watchlist', WATCHLIST],
    [/^\/audit/, 'audit', AUDIT],
    [/^\/import/, 'import', IMPORT],
    [/^\/policy/, 'policy', POLICY],
    [/^\/portal\/cases\//, 'portal-case', PORTAL_CASE],
    [/^\/portal\/?$/, 'portal', PORTAL_TOUR],
  ];
  const hit = routes.find(([rx]) => rx.test(pathname));
  return hit ? { key: hit[1], steps: hit[2] } : { key: null, steps: [] };
}
