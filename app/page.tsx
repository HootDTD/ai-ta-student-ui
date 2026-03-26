"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dropzone from 'react-dropzone';
import { Send, X, ImagePlus, Paperclip, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_AUTH_ENABLED,
  SUPABASE_REST_URL,
  clearStoredSession,
  ensureActiveSession,
  loadStoredSession,
  saveStoredSession,
  signInWithPassword,
  signUpWithPassword,
  type StoredSession,
} from './lib/auth';
import { CitationChip, type CitationMeta } from '@/components/CitationChip';

type Attachment = { name: string; type: string; dataUrl: string; size: number };
type Message = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  created_at: string;
  citations?: CitationMeta[];
};
type Textbook = { id: string; title: string; label: string | null; created_at: string };

const SUPABASE_ENABLED = Boolean(SUPABASE_AUTH_ENABLED && SUPABASE_REST_URL && SUPABASE_ANON_KEY);

async function fetchTextbooks(accessToken: string): Promise<Textbook[]> {
  if (!SUPABASE_ENABLED || !SUPABASE_REST_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth/REST is not configured.');
  }
  if (!accessToken) {
    throw new Error('Missing bearer token.');
  }
  const resp = await fetch(
    `${SUPABASE_REST_URL}/textbooks?select=id,title,label,created_at&order=title.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Failed to load textbooks (${resp.status})`);
  }
  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected textbooks response shape.');
  }
  return data as Textbook[];
}

type InsertQuestionPayload = {
  textbook_id: string | null;
  class_name: string;
  prompt: string;
};

async function insertQuestion(
  payload: InsertQuestionPayload,
  accessToken: string,
): Promise<{ id: string }> {
  if (!SUPABASE_ENABLED || !SUPABASE_REST_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth/REST is not configured.');
  }
  if (!accessToken) {
    throw new Error('Missing bearer token.');
  }
  const resp = await fetch(`${SUPABASE_REST_URL}/questions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Failed to create question (${resp.status})`);
  }
  const data = await resp.json();
  if (!Array.isArray(data) || !data[0]?.id) {
    throw new Error('Question insertion did not return an id.');
  }
  return data[0] as { id: string };
}

type InsertAnswerPayload = {
  question_id: string;
  answer_text: string;
  citations: string[] | null;
  proof: Record<string, unknown> | null;
  results: Record<string, string> | null;
};

async function insertAnswer(payload: InsertAnswerPayload, accessToken: string): Promise<void> {
  if (!SUPABASE_ENABLED || !SUPABASE_REST_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase auth/REST is not configured.');
  }
  if (!accessToken) {
    throw new Error('Missing bearer token.');
  }
  const resp = await fetch(`${SUPABASE_REST_URL}/answers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Failed to save answer (${resp.status})`);
  }
  const data = await resp.json();
  if (!Array.isArray(data) || !data[0]?.id) {
    throw new Error('Answer insertion did not return a row.');
  }
}

type ParsedAnswer = {
  answerText: string;
  citations: string[] | null;
  results: Record<string, string> | null;
};

function parseAnswer(fullText: string): ParsedAnswer {
  const trimmed = fullText.trim();
  if (!trimmed) {
    return { answerText: '', citations: null, results: null };
  }

  const lines = trimmed.split('\n');
  const workingLines = [...lines];
  let citations: string[] | null = null;

  let citationLineIndex = -1;
  for (let i = workingLines.length - 1; i >= 0; i -= 1) {
    const rawLine = workingLines[i];
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (/^Citations:/i.test(line)) {
      citationLineIndex = i;
      const matches = line.replace(/^Citations:/i, '').match(/\[[^\]]+\]/g);
      if (matches && matches.length) {
        citations = matches.map((m) => m.trim());
      } else {
        citations = [];
      }
      break;
    }
    const markers = line.match(/\[[^\]]+\]/g);
    const remainder = line.replace(/\[[^\]]+\]/g, '').trim();
    if (markers && markers.length && remainder === '') {
      citationLineIndex = i;
      citations = markers.map((m) => m.trim());
      break;
    }
    if (markers) {
      break;
    }
  }

  if (citationLineIndex >= 0) {
    workingLines.splice(citationLineIndex, 1);
    while (workingLines.length && workingLines[workingLines.length - 1].trim() === '') {
      workingLines.pop();
    }
  }

  let results: Record<string, string> | null = null;
  for (let i = 0; i < workingLines.length; i += 1) {
    const rawLine = workingLines[i];
    const line = rawLine.trim();
    if (/^Results:/i.test(line)) {
      const collected: Record<string, string> = {};
      let j = i + 1;
      for (; j < workingLines.length; j += 1) {
        const entryLine = workingLines[j].trim();
        if (!entryLine) {
          j += 1;
          break;
        }
        if (!entryLine.startsWith('- ')) {
          break;
        }
        const withoutDash = entryLine.slice(2).trim();
        if (!withoutDash) {
          continue;
        }
        const eqIndex = withoutDash.indexOf('=');
        if (eqIndex >= 0) {
          const key = withoutDash.slice(0, eqIndex).trim();
          const value = withoutDash.slice(eqIndex + 1).trim();
          if (key) {
            collected[key] = value;
          }
        } else {
          collected[withoutDash] = '';
        }
      }
      if (Object.keys(collected).length) {
        results = collected;
      }
      workingLines.splice(i, j - i);
      break;
    }
  }

  const answerText = workingLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { answerText, citations: citations && citations.length ? citations : null, results };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

type ClassOption = { id: number; slug: string; name: string; subject_name: string };

async function fetchClasses(accessToken: string, signal?: AbortSignal): Promise<ClassOption[]> {
  if (!accessToken) {
    throw new Error('Missing bearer token.');
  }
  const resp = await fetch('/api/classes', {
    cache: 'no-store',
    signal,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `Failed to load classes (${resp.status})`);
  }
  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected class response format');
  }
  const normalized: ClassOption[] = data
    .map((row: unknown) => {
      const obj = row as Partial<ClassOption> & { id?: number | string };
      const id = Number(obj.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id,
        slug: String(obj.slug || ''),
        name: String(obj.name || ''),
        subject_name: String(obj.subject_name || ''),
      };
    })
    .filter((row: ClassOption | null): row is ClassOption => row !== null);
  return normalized;
}

export default function Page() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksLoading, setTextbooksLoading] = useState<boolean>(true);
  const [textbooksError, setTextbooksError] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string>('');
  const SHOW_PREVIEWS =
    (process.env.NEXT_PUBLIC_SHOW_CITATION_PREVIEWS || '').toString().trim() === '1';
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedClassObj = classOptions.find((c) => c.id === selectedClassId);
  const selectedTextbook =
    textbooks.find((tb) => tb.title === (selectedClassObj?.subject_name ?? '')) ?? null;
  const accessToken = session?.access_token || '';
  const accountLabel = session?.user_email || session?.user_id || 'this account';

  const APOLLO_VERBS = [
    'scouring', 'flying', 'soaring', 'diving', 'gliding', 'swooping',
    'searching', 'scanning', 'fluttering', 'burrowing', 'navigating',
    'rummaging', 'combing', 'rifling', 'hunting', 'perching on',
    'hooting at', 'pecking through', 'roosting in', 'nesting in',
  ];
  const apolloVerb = useMemo(
    () => APOLLO_VERBS[Math.floor(Math.random() * APOLLO_VERBS.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading],
  );

  const normalizeMath = (text: string): string => {
    let out = text;
    out = out.replace(/^\s*\\\[([\s\S]*?)\\\]\s*$/gm, (_m, inner) => `$$${inner.trim()}$$`);
    out = out.replace(/\\\((.+?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
    out = out.replace(/^\s*\[\s*([^\n\]]+?)\s*\]\s*$/gm, (m, inner) => {
      if (/\\[a-zA-Z]+|\^|_/.test(inner)) return `$$${inner}$$`;
      return m;
    });
    out = out.replace(/\[(\s*[^\]]*?)\]/g, (m, inner) => {
      if (/\\[a-zA-Z]+|\^|_/.test(inner) && !/\$\$?.*\$\$?/.test(inner)) {
        return `$${inner.trim()}$`;
      }
      return m;
    });
    return out;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!SUPABASE_AUTH_ENABLED) {
        if (!cancelled) {
          setAuthError('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.');
          setSession(null);
          setAuthReady(true);
        }
        return;
      }

      const stored = loadStoredSession();
      const active = await ensureActiveSession(stored);
      if (cancelled) return;
      if (active) {
        saveStoredSession(active);
        setSession(active);
      } else {
        clearStoredSession();
        setSession(null);
      }
      setAuthReady(true);
    })().catch((err: unknown) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : 'Failed to initialize auth session.';
      setAuthError(msg);
      setSession(null);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!authReady) {
        return;
      }
      if (!SUPABASE_ENABLED) {
        setTextbooks([]);
        setTextbooksError('Supabase REST is not configured.');
        setTextbooksLoading(false);
        return;
      }
      if (!accessToken) {
        setTextbooks([]);
        setTextbooksError(null);
        setTextbooksLoading(false);
        return;
      }
      setTextbooksLoading(true);
      try {
        const data = await fetchTextbooks(accessToken);
        if (!cancelled) {
          setTextbooks(data);
          setTextbooksError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load textbooks.';
          setTextbooksError(msg);
          setTextbooks([]);
        }
      } finally {
        if (!cancelled) {
          setTextbooksLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, authReady]);

  useEffect(() => {
    if (!authReady) return;
    if (!accessToken) {
      setClassOptions([]);
      setSelectedClassId(null);
      setClassesError(null);
      setClassesLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    setClassesLoading(true);
    (async () => {
      try {
        const data = await fetchClasses(accessToken, controller.signal);
        if (!cancelled) {
          setClassOptions(data);
          if (data.length > 0) {
            setSelectedClassId(data[0].id);
            setClassesError(null);
          } else {
            setSelectedClassId(null);
            setClassesError('No classes were returned by the backend.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof DOMException && err.name === 'AbortError'
              ? 'Loading classes timed out. Check backend connectivity.'
              : err instanceof Error
                ? err.message
                : 'Failed to load classes.';
          setClassesError(msg);
          setClassOptions([]);
          setSelectedClassId(null);
        }
      } finally {
        if (!cancelled) {
          setClassesLoading(false);
        }
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [accessToken, authReady]);

  useEffect(() => {
    if (!session) {
      setChatId('');
      return;
    }
    const key = `hoot_chat_id_${session.user_id || 'default'}`;
    const existing = localStorage.getItem(key);
    if (existing) setChatId(existing);
    else {
      const id = `chat-${Math.random().toString(16).slice(2, 10)}`;
      localStorage.setItem(key, id);
      setChatId(id);
    }
  }, [session]);

  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const limited = imgs.slice(0, 6);
    const MAX_MB = 5;
    const filtered = limited.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    const converted = await Promise.all(
      filtered.map(async (f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: await fileToDataUrl(f),
      })),
    );
    setAttachments((prev) => [...prev, ...converted]);
  }, []);

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter(Boolean) as File[];
    if (files.length) await addFiles(files);
  };

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    try {
      const nextSession = await signInWithPassword(email.trim(), password);
      saveStoredSession(nextSession);
      setSession(nextSession);
      setPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    setAuthError(null);
    setAuthNotice(null);
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    try {
      const result = await signUpWithPassword(email.trim(), password);
      if (result.session) {
        saveStoredSession(result.session);
        setSession(result.session);
        setPassword('');
        return;
      }
      setAuthNotice(
        result.requiresEmailConfirmation
          ? 'Account created. Check your email to confirm, then sign in.'
          : 'Account created. You can sign in now.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    clearStoredSession();
    setSession(null);
    setMessages([]);
    setInput('');
    setAttachments([]);
    setClassOptions([]);
    setSelectedClassId(null);
    setChatId('');
  };

  const send = async () => {
    const questionText = input.trim();
    const attachmentsToSend = attachments;
    if (!questionText && attachmentsToSend.length === 0) return;
    if (!accessToken) {
      setFormError('Sign in is required before sending messages.');
      return;
    }
    if (selectedClassId == null) {
      setFormError('Select a class before asking.');
      return;
    }
    if (!chatId) {
      setFormError('Chat session is not ready yet. Please try again.');
      return;
    }
    setFormError(null);

    const now = new Date().toISOString();
    const userMessage: Message = {
      role: 'user',
      content: questionText,
      attachments: attachmentsToSend,
      created_at: now,
    };
    const assistantPlaceholder: Message = { role: 'assistant', content: '', created_at: now };
    const nextMessages = [...messages, userMessage, assistantPlaceholder];
    const aiIndex = messages.length + 1;

    setMessages(nextMessages);
    setInput('');
    setAttachments([]);
    setLoading(true);

    const promptForSupabase =
      questionText ||
      `[image-only question${attachmentsToSend.length ? ` with ${attachmentsToSend.length} attachment${attachmentsToSend.length === 1 ? '' : 's'}` : ''}]`;
    let questionId: string | null = null;
    try {
      const inserted = await insertQuestion(
        {
          textbook_id: selectedTextbook?.id ?? null,
          class_name: selectedClassObj?.name || '',
          prompt: promptForSupabase,
        },
        accessToken,
      );
      questionId = inserted.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to log question.';
      console.warn('Skipping question logging:', msg);
    }

    try {
      const res = await fetch('/api/ask/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          chat_id: chatId,
          search_space_id: selectedClassId,
          question: questionText,
          attachments: attachmentsToSend.map((a) => ({
            name: a.name,
            mime: a.type,
            data_url: a.dataUrl,
          })),
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const fallback = errorBody || '[error] Failed to get an answer from the AI service.';
        setMessages((prev) => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: fallback } : m)));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) =>
          prev.map((m, idx) => (idx === aiIndex ? { ...m, content: '[error] No response stream' } : m)),
        );
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let answerText = '';
      let citations: CitationMeta[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
          }
          const eventData = dataLines.join('\n');
          if (!eventType || !eventData) continue;

          try {
            const payload = JSON.parse(eventData);
            if (eventType === 'status') {
              setLoadingStatus(payload.message || '');
            } else if (eventType === 'answer') {
              answerText = typeof payload.answer === 'string' ? payload.answer : '';
              citations = Array.isArray(payload.citations) ? payload.citations : [];
            } else if (eventType === 'error') {
              answerText = payload.message || '[error] Unknown error';
            }
          } catch {
            // Ignore malformed SSE data
          }
        }
      }

      setMessages((prev) =>
        prev.map((m, idx) => (idx === aiIndex ? { ...m, content: answerText, citations } : m)),
      );

      const parsed = parseAnswer(answerText);
      const hasErrorTag = /\[error\]/i.test(answerText);
      if (questionId && !hasErrorTag) {
        try {
          await insertAnswer(
            {
              question_id: questionId,
              answer_text: parsed.answerText || answerText.trim(),
              citations: parsed.citations,
              proof: null,
              results: parsed.results,
            },
            accessToken,
          );
        } catch (answerErr) {
          console.error('Failed to save answer to Supabase:', answerErr);
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m, idx) => (idx === aiIndex ? { ...m, content: 'Error connecting to AI service.' } : m)),
      );
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const generateReport = () => {
    if (!messages.length) {
      alert('Start a conversation before generating a report.');
      return;
    }

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const mdToHtml = (md: string): string => {
      let h = esc(md);
      h = h.replace(/^#{1,6} (.+)$/gm, '<strong>$1</strong>');
      h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
      return h;
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    const subject = selectedClassObj?.subject_name || selectedClassObj?.name || '—';
    const userTurns = messages.filter((m) => m.role === 'user');
    const allCitations = messages.flatMap((m) => m.citations ?? []);
    const uniqueCitations = [...new Map(allCitations.map((c) => [c.label, c])).values()];

    const turnsHtml = messages
      .map((m) => {
        const isUser = m.role === 'user';
        const cleanContent = isUser
          ? esc(m.content)
          : mdToHtml(parseAnswer(m.content).answerText || m.content);
        const citLabels = m.citations?.map((c) => esc(c.label)).join(', ') || '';
        return `
        <div class="turn ${isUser ? 'turn--user' : 'turn--ai'}">
          <div class="turn-label">${isUser ? 'Student Prompt' : 'Hoot AI Response'}</div>
          <div class="turn-body">${cleanContent}</div>
          ${citLabels ? `<div class="turn-sources">Sources referenced: ${citLabels}</div>` : ''}
        </div>`;
      })
      .join('\n');

    const citationsHtml = uniqueCitations.length
      ? `<section class="section">
          <h2>Sources Referenced by AI</h2>
          <ul>${uniqueCitations
            .map(
              (c) =>
                `<li><strong>${esc(c.label)}</strong>${c.file ? ` — ${esc(c.file)}` : ''}${typeof c.page === 'number' ? `, p.\u00a0${c.page}` : ''}</li>`,
            )
            .join('')}</ul>
        </section>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AI Use Acknowledgement Report — ${dateStr}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,'Times New Roman',serif;font-size:11pt;color:#1a1a1a;background:#fff}
  .page{max-width:780px;margin:0 auto;padding:48px}
  h1{font-size:20pt;font-weight:700;margin-bottom:4px}
  h2{font-size:11pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:12px}
  .subtitle{font-size:10pt;color:#555;margin-bottom:32px}
  .section{margin-bottom:28px}
  .meta-grid{display:grid;grid-template-columns:160px 1fr;gap:5px 12px;font-size:10.5pt}
  .meta-grid .key{color:#555}
  .declaration{background:#f6f4f0;border-left:3px solid #555;padding:14px 18px;font-size:10.5pt;line-height:1.65;margin-bottom:10px}
  .formula{background:#f0ede8;border:1px dashed #bbb;padding:12px 16px;font-size:10pt;font-style:italic;line-height:1.65}
  .turn{margin-bottom:12px;padding:12px 14px;border:1px solid #ddd;page-break-inside:avoid}
  .turn--user{background:#fafafa;border-left:3px solid #888}
  .turn--ai{background:#f6f4f0;border-left:3px solid #333}
  .turn-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#555;margin-bottom:6px}
  .turn-body{font-size:10.5pt;line-height:1.6;white-space:pre-wrap}
  .turn-sources{margin-top:8px;font-size:9pt;color:#666;font-style:italic}
  ul{padding-left:1.5em}li{margin-bottom:4px;font-size:10.5pt}
  ol{padding-left:1.5em}
  .footer{margin-top:36px;padding-top:12px;border-top:1px solid #ccc;font-size:9pt;color:#777;text-align:center}
  @media print{
    .page{padding:24px 32px}
    .no-print{display:none}
  }
</style>
</head>
<body>
<div class="page">
  <h1>AI Use Acknowledgement Report</h1>
  <p class="subtitle">Generated ${dateStr} at ${timeStr}&ensp;·&ensp;Hoot AI Tutoring Assistant</p>

  <section class="section">
    <h2>Session Details</h2>
    <div class="meta-grid">
      <span class="key">Date:</span><span>${dateStr}</span>
      <span class="key">Student:</span><span>${esc(session?.user_email || '—')}</span>
      <span class="key">Subject / Class:</span><span>${esc(subject)}</span>
      <span class="key">AI Tool:</span><span>Hoot AI Tutoring Assistant</span>
      <span class="key">Total Interactions:</span><span>${userTurns.length} prompt${userTurns.length !== 1 ? 's' : ''}</span>
      <span class="key">Session ID:</span><span>${esc(chatId)}</span>
    </div>
  </section>

  <section class="section">
    <h2>Declaration of AI Use</h2>
    <div class="declaration">
      I used <strong>Hoot</strong> (an AI tutoring assistant) to assist with
      understanding course material related to <strong>${esc(subject)}</strong>. This session consisted of
      <strong>${userTurns.length} interaction${userTurns.length !== 1 ? 's' : ''}</strong>. I reviewed all
      AI-generated responses critically and used them to support my own understanding. All final work submitted
      represents my own conclusions and analysis.
    </div>
    <div class="formula">
      <strong>Monash acknowledgement statement:</strong><br>
      I used <em>Hoot AI</em> to <em>seek explanations and worked examples for ${esc(subject)}</em>
      (${userTurns.length} iteration${userTurns.length !== 1 ? 's' : ''}). I modified the outputs by
      <em>critically reviewing responses, cross-referencing with course materials, and forming my own conclusions</em>.
    </div>
  </section>

  <section class="section">
    <h2>Prompts Submitted (${userTurns.length})</h2>
    <ol>${userTurns.map((m) => `<li style="margin-bottom:6px">${esc(m.content)}</li>`).join('')}</ol>
  </section>

  <section class="section">
    <h2>Full Conversation Log</h2>
    ${turnsHtml}
  </section>

  ${citationsHtml}

  <section class="section">
    <h2>How AI Output Was Used</h2>
    <p style="font-size:10.5pt;line-height:1.65">
      The AI responses were used as a learning aid to better understand course concepts. Responses were read
      critically and compared against textbook material. Any information used in submitted work was independently
      verified and expressed in my own words.
    </p>
    <p style="margin-top:10px;font-size:9.5pt;color:#666;font-style:italic">
      You may expand this section to describe specifically how you incorporated or adapted the AI&apos;s responses
      in your submitted work, as required by your Chief Examiner.
    </p>
  </section>

  <div class="footer">
    Automatically generated by Hoot on ${dateStr}&ensp;·&ensp;Session ID: ${esc(chatId)}<br>
    This report is intended to support academic integrity declarations in accordance with your institution&apos;s AI use policy.
  </div>
</div>
<script>window.addEventListener('load', () => window.print());</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (!tab) alert('Please allow pop-ups for this site to open the report.');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="module w-full max-w-md">
          <div className="eyebrow">Authentication</div>
          <div>Checking authentication…</div>
        </div>
      </div>
    );
  }

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="module w-full max-w-md">
          <div className="eyebrow">Configuration</div>
          <div className="notice" data-tone="danger">
            Supabase auth is not configured. Set `NEXT_PUBLIC_SUPABASE_URL` and
            `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleSignIn} className="module w-full max-w-sm">
          <div>
            <h1 className="section-title">Sign in to Hoot</h1>
            <p className="note mt-2">Use your Supabase account to access course data.</p>
          </div>
          {authError && (
            <div className="notice" data-tone="danger">
              {authError}
            </div>
          )}
          {authNotice && <div className="notice">{authNotice}</div>}
          <label className="field-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="input"
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="input"
            />
          </label>
          <button type="submit" disabled={authLoading} className="ui-button ui-button--primary ui-button--full">
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" disabled={authLoading} onClick={handleSignUp} className="ui-button ui-button--full">
            {authLoading ? 'Working…' : 'Create account'}
          </button>
          <p className="note">New accounts also need a `course_memberships` row to access a class.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-1.5 relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="site-brand">Hoot</div>
          </div>
          <div className="flex items-center relative z-[1]">
            <div ref={classDropdownRef} className="dropdown">
              <button
                onClick={() => setClassDropdownOpen((prev) => !prev)}
                disabled={classesLoading}
                className="dropdown-trigger !h-8 !min-h-8 !w-auto !px-3 !py-1.5 text-sm"
                type="button"
              >
                <span className="max-w-[160px] truncate">
                  {classesLoading
                    ? 'Loading…'
                    : classOptions.find((c) => c.id === selectedClassId)?.name || 'Select class'}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                    classDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {classDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="dropdown-menu"
                  >
                    {classOptions.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedClassId(c.id);
                          setFormError(null);
                          setClassDropdownOpen(false);
                        }}
                        className="dropdown-item text-sm"
                        data-active={c.id === selectedClassId}
                        type="button"
                      >
                        {c.name}
                      </button>
                    ))}
                    {!classesLoading && classOptions.length === 0 && (
                      <div className="dropdown-item text-sm">No classes available</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-[1]">
            <button onClick={generateReport} className="ui-button ui-button--small" type="button">
              Generate report
            </button>
            <div className="group relative">
              <button onClick={handleSignOut} className="ui-button ui-button--small" type="button">
                Sign out
              </button>
              <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-72 border border-[var(--border)] bg-[rgba(233,223,207,0.95)] p-3 text-sm text-[var(--text)] shadow-[0_16px_32px_rgba(0,0,0,0.09)] group-hover:block group-focus-within:block">
                Are you sure you want to sign out of <span className="font-semibold">{accountLabel}</span>?
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 pt-3 pb-4 space-y-4">
        <div className="grid gap-4">
          <div className="space-y-4">
            {textbooksError && (
              <div className="notice" data-tone="danger">
                {textbooksError}
              </div>
            )}
            {textbooksLoading && <div className="notice">Loading course resources…</div>}
            {classesError && (
              <div className="notice" data-tone="danger">
                {classesError}
              </div>
            )}
            {messages.map((m, idx) => {
              if (m.role === 'assistant' && !m.content && !m.attachments?.length) return null;
              return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${
                  m.role === 'user'
                    ? 'flex justify-end'
                    : ''
                }`}
              >
              <div
                className={`p-3 border border-[var(--border)] ${
                  m.role === 'user'
                    ? 'bg-[rgba(214,205,190,0.55)] text-right inline-block max-w-[75%]'
                    : 'bg-[rgba(233,223,207,0.95)] border-l-4 border-l-[var(--accent)] shadow-[0_16px_32px_rgba(0,0,0,0.09)]'
                }`}
              >
                <div className="prose max-w-none">
                  {m.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {normalizeMath(parseAnswer(m.content).answerText)}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
                {SHOW_PREVIEWS && m.role === 'assistant' && Array.isArray(m.citations) && m.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.citations.map((c, i) => (
                      <CitationChip key={i} meta={c} />
                    ))}
                  </div>
                )}
                {!!m.attachments?.length && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {m.attachments.map((a, i) => (
                      <div key={i} className="relative h-24 w-full border border-[var(--border)] bg-[rgba(214,205,190,0.42)]">
                        <Image
                          src={a.dataUrl}
                          alt={a.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 33vw, 200px"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </motion.div>
              );
            })}
            {loading && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="thinking-indicator">
                <video
                  src="/thinking.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="thinking-indicator__video"
                />
                <div className="flex flex-col">
                  <span className="text-sm">
                    Apollo is {apolloVerb} through all resources
                    <span className="dot-1">.</span>
                    <span className="dot-2">.</span>
                    <span className="dot-3">.</span>
                  </span>
                  {loadingStatus && <span className="note italic text-xs">{loadingStatus}</span>}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      <div className="border-t border-[var(--border)] bg-[rgba(233,223,207,0.82)]">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {formError && (
            <div className="mb-3 notice" data-tone="danger">
              {formError}
            </div>
          )}
          <Dropzone onDrop={(files) => addFiles(files)}>
            {({ getRootProps, getInputProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className="upload-zone mb-2 text-sm"
                data-active={isDragActive}
              >
                <input {...getInputProps()} accept="image/*" />
                <ImagePlus className="h-4 w-4" />
                {isDragActive
                  ? 'Drop your screenshots…'
                  : 'Drag & drop screenshots, click to upload, or paste into the box below.'}
              </div>
            )}
          </Dropzone>

          {!!attachments.length && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative">
                  <div className="relative h-16 w-16 border border-[var(--border)] bg-[rgba(214,205,190,0.42)]">
                    <Image
                      src={a.dataUrl}
                      alt={a.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized
                    />
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-2 -right-2 ui-button ui-button--small ui-button--icon !h-6 !w-6 !p-0"
                    aria-label="Remove"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              rows={3}
              placeholder="Ask anything about your course…"
              className="textarea flex-1"
            />
            <button
              onClick={send}
              disabled={loading || (!input.trim() && attachments.length === 0) || selectedClassId == null}
              className="ui-button ui-button--primary ui-button--icon"
              aria-label="Send"
              title="Send"
              type="button"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs note gap-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5" />
              PNG/JPG up to ~5MB each • max 6 images
            </div>
            <div>{loading ? loadingStatus || 'Thinking…' : 'Press ⌘/Ctrl + Enter to send'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
