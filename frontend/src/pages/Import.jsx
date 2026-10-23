import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { CheckCircle2, Download, FileSpreadsheet, FileUp, GitMerge, Info, RotateCcw, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { parseCsv, toCsv } from '../lib/csv.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Page, PageHeader } from '../components/ui.jsx';

const COLUMNS = ['externalRef', 'receivedAt', 'bureau', 'permanentId', 'channel', 'category', 'priority', 'subject', 'description', 'complainantName', 'complainantEmail', 'complainantPhone'];

const SAMPLE = [
  ['CPG/2026/2001', '2026-10-05', 'PGRC', '1-5566778899', 'cpgrams', 'fee_refund', 'high', 'Refund not given after admission cancellation', 'I cancelled my B.Pharm admission in August and the institute has not refunded my fee even after six weeks.', 'Asha Reddy', 'asha.reddy@example.com', ''],
  ['CPG/2026/2002', '2026-10-08', 'RB', '1-6677889900', 'cpgrams', 'faculty', 'medium', 'शिक्षकों को वेतन नहीं मिला', 'संस्थान के शिक्षकों को चार महीने से वेतन नहीं मिला है और कई शिक्षक नौकरी छोड़ रहे हैं।', 'Faculty Association', '', '9800000099'],
];

function downloadTemplate() {
  const blob = new Blob(['﻿' + toCsv(COLUMNS, SAMPLE)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'caselink-import-template.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Import() {
  const { user } = useAuth();
  const toast = useToast();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [check, setCheck] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState('');
  const [drag, setDrag] = useState(false);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setFile(null);
    setRows([]);
    setCheck(null);
    setDone(null);
    setParseError('');
    if (input.current) input.current.value = '';
  };

  const load = async (f) => {
    reset();
    if (!f) return;
    if (f.size > 2_000_000) return setParseError('File is larger than 2 MB. Split it into smaller files.');
    const text = await f.text();
    let parsed;
    try {
      parsed = f.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
      if (!Array.isArray(parsed)) parsed = parsed.rows;
      if (!Array.isArray(parsed)) throw new Error('Expected an array of rows');
    } catch (err) {
      return setParseError(`Could not read the file: ${err.message}`);
    }
    if (parsed.length > 500) return setParseError(`The file has ${parsed.length} rows; import at most 500 at a time.`);
    setFile(f);
    setRows(parsed);
    validate(parsed);
  };

  const validate = async (data = rows) => {
    setBusy('check');
    try {
      const { data: r } = await api.post('/import/cases', { rows: data, dryRun: true });
      setCheck(r);
    } catch (err) {
      setParseError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const runImport = async () => {
    setBusy('import');
    try {
      const { data: r } = await api.post('/import/cases', { rows, dryRun: false }, { timeout: 180000 });
      setDone(r);
      toast(`Imported ${r.imported} case${r.imported === 1 ? '' : 's'} — ${r.overlaps} potential overlap${r.overlaps === 1 ? '' : 's'} found`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const resultByRow = new Map((done || check)?.results.map((r) => [r.row, r]) || []);

  return (
    <Page>
      <PageHeader
        eyebrow="Integration"
        title="Import cases"
        description="Bring in complaints exported from other systems (for example CPGRAMS or a bureau spreadsheet). Every imported case goes through overlap detection."
        actions={
          <Button variant="secondary" icon={Download} onClick={downloadTemplate} data-tour="import-template">
            CSV template
          </Button>
        }
      />

      <div className="mb-5 flex gap-3 rounded-2xl bg-paper-soft/80 p-4 text-sm text-ink-soft">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-ember-600" />
        <p>
          Live connection to CPGRAMS or other AICTE systems needs authorised API access. Until then, export complaints to CSV or JSON and import them here. Rows are checked first; nothing is saved until you confirm.
          {user.role === 'bureau_head' && <b className="text-ink"> As a bureau head you can import {user.bureau} cases only.</b>} Rows with an external reference that was already imported are skipped.
        </p>
      </div>

      {!file && (
        <motion.label
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-tour="import-drop"
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            load(e.dataTransfer.files?.[0]);
          }}
          className={clsx('flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition', drag ? 'border-ember-400 bg-ember-50' : 'border-paper-line bg-white/70 hover:border-ember-300')}
        >
          <motion.div animate={{ y: drag ? -6 : [0, -4, 0] }} transition={{ repeat: drag ? 0 : Infinity, duration: 2.4 }} className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-ember-100 text-ember-600">
            <FileUp className="h-7 w-7" />
          </motion.div>
          <p className="font-semibold text-ink">Drop a CSV or JSON file here, or click to choose</p>
          <p className="mt-1 text-sm text-ink-muted">Up to 500 rows · columns as in the template</p>
          <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
        </motion.label>
      )}

      {parseError && <p className="mt-4 rounded-xl bg-rosewood-50 px-4 py-3 text-sm font-medium text-rosewood-700">{parseError}</p>}

      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 shrink-0 text-ember-600" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{file.name}</p>
                  <p className="text-xs text-ink-muted">
                    {rows.length} row{rows.length === 1 ? '' : 's'}
                    {check && ` · ${check.valid} valid · ${check.total - check.valid} with problems`}
                    {done && ` · ${done.imported} imported · ${done.overlaps} overlaps found`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                  Choose another file
                </Button>
                {!done && (
                  <Button icon={Upload} loading={busy === 'import'} disabled={!check?.valid || busy === 'check'} onClick={runImport}>
                    Import {check?.valid || 0} valid row{check?.valid === 1 ? '' : 's'}
                  </Button>
                )}
                {done && (
                  <Link to="/overlaps">
                    <Button icon={GitMerge}>Review overlaps</Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="scroll-x">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-paper-line bg-paper-soft/80 text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">#</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold">Institution</th>
                      <th className="px-3 py-2.5 font-semibold">Bureau · Category</th>
                      <th className="px-3 py-2.5 font-semibold">Subject</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-line">
                    {rows.slice(0, 200).map((r, i) => {
                      const res = resultByRow.get(i + 1);
                      return (
                        <tr key={i} className={clsx(res && !res.ok && !res.skipped && 'bg-rosewood-50/40')}>
                          <td className="px-3 py-2.5 text-xs text-ink-faint">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            {!res ? (
                              <span className="text-xs text-ink-faint">{busy === 'check' ? 'Checking…' : '—'}</span>
                            ) : res.ok ? (
                              <span className="chip bg-sage-50 text-sage-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> {res.caseRef || 'Ready'}
                              </span>
                            ) : (
                              <span className={clsx('chip', res.skipped ? 'bg-paper-deep text-ink-muted' : 'bg-rosewood-50 text-rosewood-700')} title={Object.entries(res.errors || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}>
                                <XCircle className="h-3.5 w-3.5" /> {res.skipped ? 'Skipped' : 'Fix'}
                              </span>
                            )}
                            {res && !res.ok && (
                              <ul className="mt-1 space-y-0.5 text-xs text-rosewood-700">
                                {Object.entries(res.errors || {}).map(([k, v]) => (
                                  <li key={k}>
                                    <b>{k}</b>: {v}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{r.permanentId}</td>
                          <td className="px-3 py-2.5 text-xs text-ink-soft">
                            {r.bureau} · {r.category}
                          </td>
                          <td className="max-w-xs truncate px-3 py-2.5 text-ink">{r.subject}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 200 && <p className="border-t border-paper-line px-4 py-2 text-xs text-ink-muted">Showing the first 200 of {rows.length} rows.</p>}
            </div>
            <p className="flex items-center gap-2 text-xs text-ink-faint">
              <ShieldCheck className="h-4 w-4" /> Imports are recorded in the audit trail with your name.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
