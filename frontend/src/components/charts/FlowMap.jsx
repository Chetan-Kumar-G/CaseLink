import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BUREAU_HEX, INK, Tip, useReducedMotion, useWidth } from './common.jsx';

const BUREAU_ORDER = ['PGRC', 'RB', 'AB'];

/**
 * Bureau → institution flow of open cases (a small Sankey). Ribbon width is
 * the number of open cases; bureaus are direct-labelled so identity never
 * rests on colour alone. Hover or focus a ribbon or node for exact values.
 */
export default function FlowMap({ flows, bureauName }) {
  const [ref, width] = useWidth();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [hover, setHover] = useState(null); // { kind: 'link'|'bureau'|'inst', key, x, y }

  const narrow = width < 560;
  const leftW = narrow ? 64 : 112;
  // Room for institution names grows with the card.
  const rightW = narrow ? 128 : Math.round(Math.min(360, Math.max(220, width * 0.4)));
  const nodeW = 10;
  const rowGap = 12;
  const height = Math.max(260, flows.length * (narrow ? 50 : 56));

  const layout = useMemo(() => {
    if (!width || !flows.length) return null;
    const total = flows.reduce((s, f) => s + f.total, 0);
    const bureaus = BUREAU_ORDER.map((b) => ({ code: b, open: flows.reduce((s, f) => s + (f.links.find((l) => l.bureau === b)?.open || 0), 0) })).filter((b) => b.open);
    const usableL = height - rowGap * (bureaus.length - 1);
    const usableR = height - rowGap * (flows.length - 1);
    const k = Math.min(usableL, usableR) / total;
    const x0 = leftW + nodeW;
    const x1 = width - rightW - nodeW;

    // Centre each column vertically.
    const colHeight = (n, items) => items * k + rowGap * (n - 1);
    let y = (height - colHeight(bureaus.length, total)) / 2;
    const bNodes = bureaus.map((b) => {
      const node = { ...b, y, h: b.open * k, cursor: y };
      y += b.open * k + rowGap;
      return node;
    });
    y = (height - colHeight(flows.length, total)) / 2;
    const iNodes = flows.map((f) => {
      const node = { ...f, y, h: f.total * k, cursor: y };
      y += f.total * k + rowGap;
      return node;
    });

    const links = [];
    for (const inst of iNodes) {
      for (const b of BUREAU_ORDER) {
        const l = inst.links.find((x) => x.bureau === b);
        if (!l) continue;
        const bn = bNodes.find((n) => n.code === b);
        const h = l.open * k;
        const ya = bn.cursor;
        const yb = inst.cursor;
        bn.cursor += h;
        inst.cursor += h;
        const xm = (x0 + x1) / 2;
        links.push({
          key: `${b}-${inst.institution.id}`,
          bureau: b,
          inst,
          open: l.open,
          d: `M${x0},${ya} C${xm},${ya} ${xm},${yb} ${x1},${yb} L${x1},${yb + h} C${xm},${yb + h} ${xm},${ya + h} ${x0},${ya + h} Z`,
          mid: `M${x0},${ya + h / 2} C${xm},${ya + h / 2} ${xm},${yb + h / 2} ${x1},${yb + h / 2}`,
        });
      }
    }
    return { bNodes, iNodes, links, x0, x1 };
  }, [flows, width, height, leftW, rightW]);

  const isActive = (link) => {
    if (!hover) return true;
    if (hover.kind === 'link') return hover.key === link.key;
    if (hover.kind === 'bureau') return hover.key === link.bureau;
    return hover.key === link.inst.institution.id;
  };

  const maxChars = Math.max(12, Math.floor((rightW - 40) / (narrow ? 6.2 : 6.5)));
  const short = (s) => (s.length > maxChars ? `${s.slice(0, maxChars - 1)}…` : s);
  const hoveredLink = hover?.kind === 'link' && layout?.links.find((l) => l.key === hover.key);
  const hoveredInst = hover?.kind === 'inst' && layout?.iNodes.find((n) => n.institution.id === hover.key);
  const hoveredBureau = hover?.kind === 'bureau' && layout?.bNodes.find((n) => n.code === hover.key);

  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label="Open cases flowing from each bureau to the institutions with the most open cases">
          <defs>
            <clipPath id="flow-reveal">
              <motion.rect x="0" y="0" height={height} initial={{ width: reduce ? width : 0 }} animate={{ width }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
            </clipPath>
          </defs>

          <g clipPath="url(#flow-reveal)">
            {layout.links.map((l) => (
              <path
                key={l.key}
                d={l.d}
                fill={BUREAU_HEX[l.bureau]}
                fillOpacity={isActive(l) ? (hover ? 0.62 : 0.32) : 0.08}
                style={{ transition: 'fill-opacity 160ms' }}
                tabIndex={0}
                aria-label={`${l.bureau} to ${l.inst.institution.name}: ${l.open} open case${l.open === 1 ? '' : 's'}`}
                onMouseMove={(e) => setHover({ kind: 'link', key: l.key, ...point(e) })}
                onFocus={(e) => {
                  const b = e.target.getBBox();
                  setHover({ kind: 'link', key: l.key, x: b.x + b.width / 2, y: b.y + b.height / 2 });
                }}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none"
              />
            ))}
            {/* Particles: one per open case, travelling bureau → institution. */}
            {!reduce &&
              layout.links.flatMap((l) =>
                Array.from({ length: l.open }, (_, i) => (
                  <circle key={`${l.key}-p${i}`} r="2.6" fill="#fff" opacity="0" pointerEvents="none">
                    <animateMotion path={l.mid} dur={`${3.2 + (i % 3) * 0.5}s`} begin={`${1.4 + i * 0.9 + (l.open % 2) * 0.4}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;0.95;0.95;0" dur={`${3.2 + (i % 3) * 0.5}s`} begin={`${1.4 + i * 0.9 + (l.open % 2) * 0.4}s`} repeatCount="indefinite" />
                  </circle>
                )),
              )}
          </g>

          {/* Bureau nodes (left) */}
          {layout.bNodes.map((n, i) => (
            <g
              key={n.code}
              tabIndex={0}
              className="cursor-default outline-none"
              aria-label={`${bureauName(n.code)}: ${n.open} open cases at these institutions`}
              onMouseMove={(e) => setHover({ kind: 'bureau', key: n.code, ...point(e) })}
              onFocus={() => setHover({ kind: 'bureau', key: n.code, x: leftW + 20, y: n.y + n.h / 2 })}
              onBlur={() => setHover(null)}
            >
              <motion.rect x={leftW} width={nodeW} rx="3" fill={BUREAU_HEX[n.code]} initial={{ y: n.y + n.h / 2, height: 0 }} animate={{ y: n.y, height: n.h }} transition={{ delay: 0.1 * i, duration: 0.6 }} />
              <rect x="0" y={n.y - 4} width={leftW + nodeW} height={n.h + 8} fill="transparent" />
              <text x={leftW - 10} y={n.y + n.h / 2 - 2} textAnchor="end" fontSize="13" fontWeight="800" fill={INK.text}>
                {n.code}
              </text>
              <text x={leftW - 10} y={n.y + n.h / 2 + 13} textAnchor="end" fontSize="11" fill={INK.muted}>
                {n.open} open
              </text>
            </g>
          ))}

          {/* Institution nodes (right) */}
          {layout.iNodes.map((n, i) => (
            <g
              key={n.institution.id}
              tabIndex={0}
              role="link"
              aria-label={`${n.institution.name}: ${n.total} open cases${n.crossBureauPending ? `, ${n.crossBureauPending} cross-bureau overlaps pending` : ''}. Open Institution 360`}
              className="cursor-pointer outline-none"
              onClick={() => navigate(`/institutions/${n.institution.permanentId}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/institutions/${n.institution.permanentId}`)}
              onMouseMove={(e) => setHover({ kind: 'inst', key: n.institution.id, ...point(e) })}
              onFocus={() => setHover({ kind: 'inst', key: n.institution.id, x: layout.x1 - 180, y: n.y + n.h / 2 })}
              onBlur={() => setHover(null)}
            >
              <motion.rect x={layout.x1} width={nodeW} rx="3" fill={INK.soft} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + 0.08 * i }} y={n.y} height={Math.max(n.h, 3)} />
              <rect x={layout.x1} y={n.y - 4} width={rightW + nodeW} height={Math.max(n.h, 3) + 8} fill="transparent" />
              <motion.g initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + 0.08 * i }}>
                <text x={layout.x1 + nodeW + 10} y={n.y + n.h / 2 - (n.crossBureauPending ? 3 : -4)} fontSize={narrow ? 11 : 12.5} fontWeight="700" fill={hover?.key === n.institution.id ? '#B4420C' : INK.text}>
                  {short(n.institution.name)}
                  <tspan fill={INK.muted} fontWeight="500">
                    {'  '}
                    {n.total}
                  </tspan>
                </text>
                {n.crossBureauPending > 0 && (
                  <g>
                    <circle cx={layout.x1 + nodeW + 14} cy={n.y + n.h / 2 + 11} r="3.5" fill="#F26C1F">
                      {!reduce && <animate attributeName="r" values="3.5;6;3.5" dur="1.8s" repeatCount="indefinite" />}
                      {!reduce && <animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite" />}
                    </circle>
                    <text x={layout.x1 + nodeW + 24} y={n.y + n.h / 2 + 15} fontSize="10.5" fontWeight="600" fill="#B4420C">
                      {n.crossBureauPending} {narrow ? 'overlap' : 'cross-bureau overlap'}{n.crossBureauPending > 1 ? 's' : ''}
                    </text>
                  </g>
                )}
              </motion.g>
            </g>
          ))}
        </svg>
      )}

      {hover && (
        <Tip x={hover.x} y={hover.y} width={width}>
          {hoveredLink && (
            <>
              <p className="text-base font-extrabold">{hoveredLink.open} open</p>
              <p className="flex items-center gap-1.5 text-white/75">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: BUREAU_HEX[hoveredLink.bureau] }} />
                {hoveredLink.bureau} → {hoveredLink.inst.institution.name}
              </p>
            </>
          )}
          {hoveredBureau && (
            <>
              <p className="text-base font-extrabold">{hoveredBureau.open} open</p>
              <p className="text-white/75">{bureauName(hoveredBureau.code)}</p>
            </>
          )}
          {hoveredInst && (
            <>
              <p className="text-base font-extrabold">{hoveredInst.total} open</p>
              <p className="text-white/75">{hoveredInst.institution.name}</p>
              <p className="mt-1 text-white/75">{hoveredInst.links.map((l) => `${l.bureau} ${l.open}`).join(' · ')}</p>
              {hoveredInst.crossBureauPending > 0 && <p className="mt-1 font-semibold text-ember-200">{hoveredInst.crossBureauPending} cross-bureau overlaps pending</p>}
              <p className="mt-1 text-[0.65rem] text-white/50">Click to open Institution 360</p>
            </>
          )}
        </Tip>
      )}
    </div>
  );
}
