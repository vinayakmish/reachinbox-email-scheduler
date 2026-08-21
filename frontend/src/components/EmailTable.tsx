import React, { useState } from 'react';
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
  const [selectedSmtpEmail, setSelectedSmtpEmail] = useState<EmailJob | null>(null);
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
              {type === 'sent' && (
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  SMTP Delivery
                </th>
              )}
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
                {type === 'sent' && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {email.previewUrl ? (
                        <a
                          href={email.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors shadow-sm"
                          title="Open instant rendered email preview (no login required)"
                        >
                          <span>View Email</span>
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : null}
                      <button
                        onClick={() => setSelectedSmtpEmail(email)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        title="View Ethereal SMTP Details"
                      >
                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        SMTP Info
                      </button>
                    </div>
                  </td>
                )}
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

      {/* Ethereal SMTP Details Modal */}
      {selectedSmtpEmail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedSmtpEmail(null)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden z-10 border border-gray-100">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    ✉
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Ethereal SMTP Details</h3>
                    <p className="text-xs text-gray-500">Sandbox email delivery transport metadata</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSmtpEmail(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">SMTP Host</span>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {selectedSmtpEmail.sender?.smtpHost || 'smtp.ethereal.email'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">SMTP Port</span>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {selectedSmtpEmail.sender?.smtpPort || 587} (TLS)
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-200/60">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">SMTP Auth User</span>
                    <p className="text-xs font-mono font-medium text-indigo-600 mt-0.5 break-all">
                      {selectedSmtpEmail.sender?.smtpUser || selectedSmtpEmail.sender?.email || 'ethereal_user'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Sender Identity:</span>
                    <span className="font-medium text-gray-900">
                      {selectedSmtpEmail.sender?.displayName} &lt;{selectedSmtpEmail.sender?.email}&gt;
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Target Recipient:</span>
                    <span className="font-medium text-gray-900">{selectedSmtpEmail.recipientEmail}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Sent Timestamp:</span>
                    <span className="font-medium text-gray-900">{formatDate(selectedSmtpEmail.sentAt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-gray-500">Delivery Status:</span>
                    <StatusBadge status={selectedSmtpEmail.status} />
                  </div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
                  {selectedSmtpEmail.previewUrl ? (
                    <a
                      href={selectedSmtpEmail.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 btn-primary text-xs flex items-center justify-center gap-1.5 text-center bg-emerald-600 hover:bg-emerald-700"
                    >
                      <span>View Rendered Email (No Login)</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : null}
                  <button
                    onClick={() => setSelectedSmtpEmail(null)}
                    className="btn-secondary text-xs px-4"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

