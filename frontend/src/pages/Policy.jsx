import { motion } from 'framer-motion';
import { BrainCircuit, Database, EyeOff, KeyRound, ScrollText, ShieldCheck, Users, AlertTriangle } from 'lucide-react';
import { Card, Page, PageHeader, stagger } from '../components/ui.jsx';

const SECTIONS = [
  {
    icon: Database,
    title: 'Purpose and data held',
    body: [
      'CaseLink consolidates institution-related complaint cases across AICTE bureaus so officials can see every case for an institution, identified by its AICTE Permanent ID.',
      'It stores case details, complainant name and contact details, case history, overlap decisions and an audit trail. It does not store documents or financial information in this prototype.',
      'This prototype runs on synthetic data only. No real complainant or institution data is used.',
    ],
  },
  {
    icon: Users,
    title: 'Roles and access',
    body: [
      'Bureau officers register and update cases of their own bureau. Bureau heads additionally see their bureau’s audit activity.',
      'Senior reviewers have a read-only consolidated view across bureaus and may decide overlaps. Administrators manage the platform.',
      'Institution accounts use a separate portal: they see only their own institution’s cases, never the complainant’s identity or ClosureGuard’s checklist, and can only submit responses for AICTE to review.',
      'Every API request is authenticated and checked against the user’s role and bureau on the server, not only in the interface.',
    ],
  },
  {
    icon: EyeOff,
    title: 'Masking and data minimisation',
    body: [
      'Complaint text is visible across bureaus because coordination needs it. Complainant names are masked, and email and phone are hidden, outside the owning bureau.',
      'Duplicate complainants are detected using a keyed one-way hash of email or phone, so bureaus can learn that a complainant is the same person without seeing who it is.',
    ],
  },
  {
    icon: BrainCircuit,
    title: 'Use of AI',
    body: [
      'The semantic layer only compares complaint text. It never receives complainant identity, and it runs as a separate internal service that can be hosted on AICTE’s own servers.',
      'AI output is a recommendation with visible evidence (matched fields, shared concepts, similarity). It never merges cases, changes status or closes a complaint. A named official records every decision with a reason.',
      'ClosureGuard compares the institution’s response with the complaint and flags unanswered concerns, missing evidence and inconsistencies. Officers can override any finding; a case is resolved only by an officer’s recorded decision, and accepting with open items requires a written justification.',
      'The Watchlist only reports that complaint volume has changed for an institution and category. It is not a risk score and is never a finding of wrongdoing.',
      'The Promise Ledger judges institutions only on their own written words: each promise is quoted exactly, and the Promise Kept Rate counts only outcomes the complainant confirmed. The complainant check-in link shows no personal details and works once.',
    ],
  },
  {
    icon: ScrollText,
    title: 'Audit trail integrity',
    body: [
      'Sign-ins, failed sign-ins, case views, changes and overlap decisions are written to an append-only log. Each entry stores the hash of the previous entry.',
      'Any edit or deletion breaks the chain and is reported by the verification check available to senior reviewers.',
      'Overdue cases are escalated automatically — to the bureau head, then to a senior reviewer — and each escalation is recorded on the case and in this log.',
    ],
  },
  {
    icon: KeyRound,
    title: 'Security controls',
    body: [
      'Passwords are hashed with bcrypt. Sessions use signed JWTs in httpOnly, SameSite=Strict cookies, and signing out revokes all of a user’s sessions.',
      'Sign-in is rate limited and accounts lock for 15 minutes after five failed attempts. All input is validated on the server; security headers are set with Helmet; CORS is restricted to configured origins.',
      'Service-to-service calls to the AI service can be authenticated with a shared key.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Before production use',
    body: [
      'This policy describes the prototype. Adoption would require review by AICTE’s IT security and legal teams, a data retention schedule, alignment with the Digital Personal Data Protection Act, 2023, and integration with AICTE’s identity provider.',
    ],
  },
];

export default function Policy() {
  return (
    <Page>
      <PageHeader eyebrow="Governance" title="Data & security policy" description="How CaseLink handles grievance information, who can see what, and how decisions stay accountable." />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2" data-tour="policy-grid">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ember-100 text-ember-700">
                <s.icon className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-ink">{s.title}</h2>
            </div>
            <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
              {s.body.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </Card>
        ))}
      </motion.div>
      <p className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
        <ShieldCheck className="h-4 w-4" /> Report security issues to the project team; see SECURITY.md in the repository.
      </p>
    </Page>
  );
}
