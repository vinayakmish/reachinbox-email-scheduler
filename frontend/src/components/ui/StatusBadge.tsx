import React from 'react';
import { JobStatus } from '../../types';

interface StatusBadgeProps {
  status: JobStatus | string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'badge-pending' },
  PROCESSING: { label: 'Processing', className: 'badge-processing' },
  SENT: { label: 'Sent', className: 'badge-sent' },
  FAILED: { label: 'Failed', className: 'badge-failed' },
  RESCHEDULED: { label: 'Rescheduled', className: 'badge-rescheduled' },
  SCHEDULED: { label: 'Scheduled', className: 'badge-pending' },
  RUNNING: { label: 'Running', className: 'badge-processing' },
  COMPLETED: { label: 'Completed', className: 'badge-sent' },
  CANCELLED: { label: 'Cancelled', className: 'badge-failed' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'badge-pending' };
  return <span className={config.className}>{config.label}</span>;
}
