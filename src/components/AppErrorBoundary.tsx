import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide React error boundary. Catches render-time errors anywhere in the
 * tree so the whole app never goes blank. Provides a friendly recovery UI.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for diagnostics; never throw in here.
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message =
      this.state.error.message?.slice(0, 240) || "An unexpected error occurred.";

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-8"
      >
        <div
          className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app hit an unexpected error. Your conversations are still saved
            in this browser.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-secondary/60 p-3 text-left font-mono text-[11px] text-muted-foreground">
            {message}
          </pre>
          <div className="mt-5 flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row">
            <button
              onClick={this.handleReload}
              className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              Reload page
            </button>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
