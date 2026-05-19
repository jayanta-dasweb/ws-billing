'use client';

type AlertVariant = 'success' | 'danger' | 'warning' | 'info';

interface AutoDismissAlertProps {
  message: string;
  variant?: AlertVariant;
  className?: string;
}

/** Renders a Bootstrap alert only when message is non-empty (pair with useTimedAlerts). */
export function AutoDismissAlert({
  message,
  variant = 'danger',
  className = '',
}: AutoDismissAlertProps) {
  if (!message) return null;
  return (
    <div className={`alert alert-${variant} py-2 auto-dismiss-alert ${className}`.trim()} role="alert">
      {message}
    </div>
  );
}
