import clsx from 'clsx';

// CaseLink mark: a "C" holding an institution, joined by a chain link.
export function LogoMark({ className, onDark }) {
  const img = <img src="/brand/caselink-mark.png" alt="" draggable="false" className={clsx('shrink-0 select-none object-contain', onDark ? 'h-[78%] w-[78%]' : className)} />;
  // On coloured backgrounds the orange mark sits on a white tile for contrast.
  return onDark ? <span className={clsx('grid shrink-0 place-items-center rounded-xl bg-white shadow-card', className)}>{img}</span> : img;
}

export function Logo({ className, light }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <LogoMark className="h-10 w-10" onDark={light} />
      <div className="leading-tight">
        <p className={clsx('text-[1.15rem] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
          Case<span className={light ? 'text-ember-100' : 'text-ember-600'}>Link</span>
        </p>
        <p className={clsx('text-[0.62rem] font-semibold uppercase tracking-[0.14em]', light ? 'text-ember-100' : 'text-ink-muted')}>Connected grievances</p>
      </div>
    </div>
  );
}

export const TAGLINE = ['One institution', 'Connected grievances', 'Every bureau'];
