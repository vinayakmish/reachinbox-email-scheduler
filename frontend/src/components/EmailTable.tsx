import React from 'react';
import { EmailJob, PaginatedResult } from '../types';
import { StatusBadge } from './ui/StatusBadge';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState } from './ui/EmptyState';
import { Pagination } from './ui/Pagination';

interface EmailTableProps {
  data: PaginatedResult<EmailJob> | null;
  isLoading: boolean;
  error: string | null;
  type: 'scheduled' | 'sent';
  page: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function EmailTable({
  data, isLoading, error, type, page, onPageChange, onRefresh,
}: EmailTableProps) {
  const timeLabel = type === 'scheduled' ? 'Scheduled Time' : 'Sent Time';
  const timeKey = type === 'scheduled' ? 'scheduledAt' : 'sentAt';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-900 font-medium">Failed to load emails</p>
        <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
        <button onClick={onRefresh} className="btn-secondary text-sm">
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.emails.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
        title={type === 'scheduled' ? 'No scheduled emails' : 'No sent emails'}
        description={
          type === 'scheduled'
            ? 'Scheduled emails will appear here once you create a campaign.'
            : 'Emails will appear here after they are sent.'
        }
      />
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                Recipient
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                Subject
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                {timeLabel}
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.emails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-900 font-medium">{email.recipientEmail}</span>
                  {email.sender && (
                    <p className="text-xs text-gray-400 mt-0.5">via {email.sender.displayName}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 line-clamp-1">{email.subject}</span>
                  {email.campaign && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{email.campaign.subject}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">
                    {formatDate(email[timeKey as keyof EmailJob] as string)}
                  </span>
                  {email.errorMessage && (
                    <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs" title={email.errorMessage}>
                      {email.errorMessage.slice(0, 60)}...
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={email.status} />
                  {email.attempts > 1 && (
                    <p className="text-xs text-gray-400 mt-0.5">{email.attempts} attempts</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        limit={data.limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}
