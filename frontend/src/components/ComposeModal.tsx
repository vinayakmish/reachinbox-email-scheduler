import React, { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { campaignApi, getApiError } from '../services/api';
import { Sender } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: () => void;
}

export function ComposeModal({ isOpen, onClose, senders, onSuccess }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [senderId, setSenderId] = useState('');
  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ valid: number; invalid: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync senderId whenever senders list changes or modal opens
  useEffect(() => {
    if (senders.length > 0 && !senderId) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  // Reset senderId if it no longer exists in senders
  useEffect(() => {
    if (senderId && senders.length > 0 && !senders.find(s => s.id === senderId)) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRecipientsFile(file);
    setFileInfo(null);

    // Client-side preview count — strip BOM, handle CRLF, match emails
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      // Strip UTF-8 BOM if present and normalize line endings
      const content = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const emails = [...new Set((content.match(emailRegex) || []).map((e) => e.toLowerCase()))];
      setFileInfo({ valid: emails.length, invalid: 0 });
    };
    reader.readAsText(file, 'utf-8');
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientsFile) {
      toast.error('Please upload a recipients file');
      return;
    }
    if (!senderId) {
      toast.error('Please select a sender');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('startTime', new Date(startTime).toISOString());
    formData.append('delayBetweenEmails', String(delayBetweenEmails));
    formData.append('hourlyLimit', String(hourlyLimit));
    formData.append('senderId', senderId);
    formData.append('recipientsFile', recipientsFile);

    try {
      const res = await campaignApi.create(formData);
      const { recipientsSummary } = res.data.data!;
      toast.success(
        `Campaign scheduled! ${recipientsSummary.valid} emails queued.${
          recipientsSummary.duplicatesRemoved > 0
            ? ` (${recipientsSummary.duplicatesRemoved} duplicates removed)`
            : ''
        }`,
        { duration: 5000 },
      );
      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setRecipientsFile(null);
    setFileInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Compose Email Campaign</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Sender */}
            <div>
              <label className="label">Sender</label>
              {senders.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  No senders configured. Please create a sender first.
                </div>
              ) : (
                <select
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="input"
                  required
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} &lt;{s.email}&gt;
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Your email subject"
                required
                maxLength={998}
              />
            </div>

            {/* Body */}
            <div>
              <label className="label">Email Body (HTML or plain text)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input min-h-32 resize-y font-mono text-xs"
                placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                required
                rows={6}
              />
            </div>

            {/* Recipients */}
            <div>
              <label className="label">Recipients File (CSV or TXT)</label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {recipientsFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-700">{recipientsFile.name}</p>
                    {fileInfo && (
                      <p className="text-sm text-indigo-600 mt-1 font-semibold">
                        ✓ ~{fileInfo.valid} valid email addresses detected
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-600">
                      <span className="text-indigo-600 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">CSV or TXT, one email per line, max 5MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Scheduling Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Delay Between Emails (ms)</label>
                <input
                  type="number"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value))}
                  className="input"
                  min={0}
                  max={3600000}
                  step={100}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {delayBetweenEmails >= 1000 ? `${delayBetweenEmails / 1000}s` : `${delayBetweenEmails}ms`} between each email
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Hourly Send Limit (per sender)</label>
                <input
                  type="number"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value))}
                  className="input"
                  min={1}
                  max={10000}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maximum {hourlyLimit} emails per hour from this sender
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting || senders.length === 0}
              >
                {isSubmitting ? (
                  <><LoadingSpinner size="sm" /> Scheduling...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Schedule Campaign
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
