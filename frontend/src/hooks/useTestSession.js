import { useState, useEffect, useRef, useCallback } from 'react';
import { getStatusStreamUrl } from '../services/api';

export function useTestSession(sessionId) {
  const [status, setStatus] = useState('idle');
  const [conversation, setConversation] = useState([]);
  const [report, setReport] = useState(null);
  const [persona, setPersona] = useState(null);
  const [error, setError] = useState(null);
  const [messagesRemaining, setMessagesRemaining] = useState(0);
  const eventSourceRef = useRef(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setConversation([]);
    setReport(null);
    setPersona(null);
    setError(null);
    setMessagesRemaining(0);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const url = getStatusStreamUrl(sessionId);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status);
      setConversation(data.conversation || []);
      setMessagesRemaining(data.messagesRemaining || 0);
      if (data.report) setReport(data.report);
    });

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status);
    });

    es.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      setConversation((prev) => [...prev, data]);
      if (data.messagesRemaining !== undefined) {
        setMessagesRemaining(data.messagesRemaining);
      }
    });

    es.addEventListener('persona', (e) => {
      const data = JSON.parse(e.data);
      setPersona(data.persona);
    });

    es.addEventListener('report', (e) => {
      const data = JSON.parse(e.data);
      setReport(data.report);
    });

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        setError(data.message);
        setStatus('error');
      } catch {
        // SSE connection error
      }
    });

    es.onerror = () => {
      // Reconnection is handled automatically by EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId]);

  return { status, conversation, report, persona, error, messagesRemaining, reset };
}
