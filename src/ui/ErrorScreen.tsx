import { Component, type ErrorInfo, type ReactNode } from 'react';
import { startFreshNextTime } from '../storage/projects';

/**
 * If drawing the app fails, React removes everything and leaves an empty
 * page. This says what happened instead, and offers a way out.
 */
export class ErrorScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workshop could not draw the screen.', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const details = error.stack?.includes(error.message) ? error.stack : `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim();
    return (
      <div className="crash" role="alert">
        <h1>Workshop hit a problem drawing the screen</h1>
        <p>
          Your boards are safe: they’re saved on this computer. Open a fresh board to carry on. If this keeps happening, press
          Copy details and send them to whoever set up Workshop.
        </p>
        <div className="crash__actions">
          <button
            className="button button--primary"
            onClick={() => {
              startFreshNextTime();
              location.reload();
            }}
          >
            Open a fresh board
          </button>
          <button className="button" onClick={() => location.reload()}>
            Try again
          </button>
          <button className="button" onClick={() => navigator.clipboard?.writeText(details).catch(() => undefined)}>
            Copy details
          </button>
        </div>
        <pre>{details}</pre>
      </div>
    );
  }
}
