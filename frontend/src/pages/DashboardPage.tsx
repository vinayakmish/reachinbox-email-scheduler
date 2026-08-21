import React, { useState, useCallback } from 'react';
import { Header } from '../components/Header';
import { ComposeModal } from '../components/ComposeModal';
import { CreateSenderModal } from '../components/CreateSenderModal';
import { EmailTable } from '../components/EmailTable';
import { useSenders } from '../hooks/useSenders';
import { useEmailJobs } from '../hooks/useEmailJobs';

type Tab = 'scheduled' | 'sent';

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isCreateSenderOpen, setIsCreateSenderOpen] = useState(false);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [sentPage, setSentPage] = useState(1);

  const { senders, refetch: refetchSenders } = useSenders();
  const scheduledEmails = useEmailJobs('scheduled', scheduledPage);
  const sentEmails = useEmailJobs('sent', sentPage);

  const handleCampaignSuccess = useCallback(() => {
    scheduledEmails.refetch();
  }, [scheduledEmails]);

  const activeEmailData = activeTab === 'scheduled' ? scheduledEmails : sentEmails;
  const activePage = activeTab === 'scheduled' ? scheduledPage : sentPage;
  const handlePageChange = activeTab === 'scheduled' ? setScheduledPage : setSentPage;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your email campaigns and track delivery</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateSenderOpen(true)}
              className="btn-secondary text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Sender
            </button>
            <button
              onClick={() => setIsComposeOpen(true)}
              className="btn-primary text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Compose New Email
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Scheduled',
              value: scheduledEmails.data?.total ?? '—',
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              onClick: () => setActiveTab('scheduled'),
              clickable: true,
            },
            {
              label: 'Sent',
              value: sentEmails.data?.sentCount ?? sentEmails.data?.total ?? '—',
              color: 'text-green-600',
              bg: 'bg-green-50',
              onClick: () => setActiveTab('sent'),
              clickable: true,
            },
            {
              label: 'Failed',
              value: sentEmails.data?.failedCount ?? 0,
              color: 'text-red-600',
              bg: 'bg-red-50',
              onClick: () => setActiveTab('sent'),
              clickable: true,
            },
            {
              label: 'Senders',
              value: senders.length,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
              onClick: undefined,
              clickable: false,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              onClick={stat.onClick}
              className={`card p-4 transition-all duration-150 ${
                stat.clickable
                  ? 'cursor-pointer hover:shadow-md hover:border-gray-300 active:scale-[0.99]'
                  : 'cursor-default'
              }`}
            >
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${stat.bg} mb-2`}>
                <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
              </div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Table */}
        <div className="card overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-4 pt-4 border-b border-gray-100">
            <div className="flex gap-1">
              {(['scheduled', 'sent'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
                  {activeTab === tab && activeEmailData.data && (
                    <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-full">
                      {activeEmailData.data.total}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={activeEmailData.refetch}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Table */}
          <EmailTable
            data={activeEmailData.data}
            isLoading={activeEmailData.isLoading}
            error={activeEmailData.error}
            type={activeTab}
            page={activePage}
            onPageChange={handlePageChange}
            onRefresh={activeEmailData.refetch}
          />
        </div>
      </main>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSuccess={handleCampaignSuccess}
      />
      <CreateSenderModal
        isOpen={isCreateSenderOpen}
        onClose={() => setIsCreateSenderOpen(false)}
        onSuccess={refetchSenders}
      />
    </div>
  );
}
