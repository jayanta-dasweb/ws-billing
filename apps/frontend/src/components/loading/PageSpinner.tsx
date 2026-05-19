'use client';

interface PageSpinnerProps {
  message?: string;
  /** full viewport vs content area only */
  fullScreen?: boolean;
}

export function PageSpinner({ message = 'Loading…', fullScreen = true }: PageSpinnerProps) {
  return (
    <div
      className={
        fullScreen
          ? 'app-page-loader app-page-loader--fullscreen'
          : 'app-page-loader app-page-loader--inline'
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-page-loader__card">
        <div className="spinner-border text-primary mb-3" />
        <p className="text-muted mb-0 small font-weight-bold">{message}</p>
      </div>
    </div>
  );
}
