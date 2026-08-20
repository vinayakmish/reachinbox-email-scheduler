import { useState, useEffect, useCallback } from 'react';
import { Sender } from '../types';
import { senderApi, getApiError } from '../services/api';

export function useSenders() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSenders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await senderApi.list();
      setSenders(res.data.data ?? []);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSenders(); }, [fetchSenders]);

  return { senders, isLoading, error, refetch: fetchSenders };
}
