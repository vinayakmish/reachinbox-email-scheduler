import { useState, useEffect, useCallback, useRef } from 'react';
import { EmailJob, PaginatedResult } from '../types';
import { emailApi, getApiError } from '../services/api';

type EmailType = 'scheduled' | 'sent';

const POLL_INTERVAL_MS = 10_000; // Auto-refresh every 10 seconds

export function useEmailJobs(type: EmailType, page = 1) {
  const [data, setData] = useState<PaginatedResult<EmailJob> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = type === 'scheduled'
        ? await emailApi.scheduled(page)
        : await emailApi.sent(page);
      setData(res.data.data ?? null);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [type, page]);

  // Initial fetch
  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  // Auto-refresh polling for scheduled emails (they change as workers process jobs)
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(() => {
      fetchEmails();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchEmails]);

  return { data, isLoading, error, refetch: fetchEmails };
}
