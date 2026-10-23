import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Catches render errors so one broken view never blanks the whole app.
 * Used around each page (navigation keeps working) and around the app root.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkFailed = /Loading chunk|dynamically imported module|Failed to fetch/i.test(String(this.state.error?.message));
    return (
      <div role="alert" className="mx-auto my-16 max-w-md rounded-3xl border border-paper-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rosewood-50 text-rosewood-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-ink">{chunkFailed ? 'A new version is available' : 'Something went wrong on this page'}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {chunkFailed ? 'Reload to get the latest version of CaseLink.' : 'Your data is safe. Reload the page, or use the menu to go elsewhere. If it keeps happening, tell the administrator.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-ember-500 to-ember-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <RotateCcw className="h-4 w-4" /> Reload
        </button>
      </div>
    );
  }
}
