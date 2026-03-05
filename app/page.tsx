"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
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
  type StoredSession,
} from './lib/auth';

type Attachment = { name: string; type: string; dataUrl: string; size: number };
import { CitationChip, type CitationMeta } from '@/components/CitationChip';

type Message = { role: 'user' | 'assistant'; content: string; attachments?: Attachment[]; created_at: string; citations?: CitationMeta[] };
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

async function insertQuestion(payload: InsertQuestionPayload, accessToken: string): Promise<{ id: string }> {
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
  // Removed AI Link logs UI/state
  const SHOW_PREVIEWS = (process.env.NEXT_PUBLIC_SHOW_CITATION_PREVIEWS || '').toString().trim() === '1';
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedClassObj = classOptions.find(c => c.id === selectedClassId);
  const selectedTextbook = textbooks.find(tb => tb.title === (selectedClassObj?.subject_name ?? '')) ?? null;
  const accessToken = session?.access_token || '';
  const userLabel = session?.user_email || session?.user_id || 'Signed in';

  // Normalize common AI formatting to LaTeX delimiters for math rendering
  const normalizeMath = (text: string): string => {
    let out = text;
    // 0) Convert TeX display/inline delimiters \[...\], \(...\) to $$...$$ and $...$
    //    Use [\s\S]*? to allow newlines inside display math.
    out = out.replace(/^\s*\\\[([\s\S]*?)\\\]\s*$/gm, (_m, inner) => `$$${inner.trim()}$$`);
    out = out.replace(/\\\((.+?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
    // 1) Standalone-line bracketed TeX -> display math
    out = out.replace(/^\s*\[\s*([^\n\]]+?)\s*\]\s*$/gm, (m, inner) => {
      if (/\\[a-zA-Z]+|\^|_/.test(inner)) return `$$${inner}$$`;
      return m;
    });
    // 2) Inline bracketed TeX -> inline math
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

  // close class dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // scroll to bottom on new messages
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
    return () => { cancelled = true; };
  }, [accessToken, authReady]);

  // fetch available classes from backend
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

  // initialize or reuse chat id
  useEffect(() => {
    if (!session) {
      setChatId('');
      return;
    }
    const key = `hoot_chat_id_${session.user_id || 'default'}`;
    const existing = localStorage.getItem(key);
    if (existing) setChatId(existing);
    else {
      const id = 'chat-' + Math.random().toString(16).slice(2, 10);
      localStorage.setItem(key, id);
      setChatId(id);
    }
  }, [session]);

  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'));
    const limited = imgs.slice(0, 6); // cap to 6 images
    const MAX_MB = 5;
    const filtered = limited.filter(f => f.size <= MAX_MB * 1024 * 1024);
    const converted = await Promise.all(filtered.map(async f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      dataUrl: await fileToDataUrl(f),
    })));
    setAttachments(prev => [...prev, ...converted]);
  }, []);

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean) as File[];
    if (files.length) await addFiles(files);
  };

  const removeAttachment = (idx: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx));

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
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

    const promptForSupabase = questionText || `[image-only question${attachmentsToSend.length ? ` with ${attachmentsToSend.length} attachment${attachmentsToSend.length === 1 ? '' : 's'}` : ''}]`;
    let questionId: string | null = null;
    try {
      const inserted = await insertQuestion({
        textbook_id: selectedTextbook?.id ?? null,
        class_name: selectedClassObj?.name || '',
        prompt: promptForSupabase,
      }, accessToken);
      questionId = inserted.id;
    } catch (error) {
      // Question/answer logging is optional for chat flow; continue even if RLS blocks writes.
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
          attachments: attachmentsToSend.map(a => ({
            name: a.name,
            mime: a.type,
            data_url: a.dataUrl,
          })),
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const fallback = errorBody || '[error] Failed to get an answer from the AI service.';
        setMessages(prev => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: fallback } : m)));
        return;
      }

      // Parse SSE stream for progress updates + final answer
      const reader = res.body?.getReader();
      if (!reader) {
        setMessages(prev => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: '[error] No response stream' } : m)));
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

        // Parse complete SSE events from buffer
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

      setMessages(prev => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: answerText, citations } : m)));

      const parsed = parseAnswer(answerText);
      const hasErrorTag = /\[error\]/i.test(answerText);
      if (questionId && !hasErrorTag) {
        try {
          await insertAnswer({
            question_id: questionId,
            answer_text: parsed.answerText || answerText.trim(),
            citations: parsed.citations,
            proof: null,
            results: parsed.results,
          }, accessToken);
        } catch (answerErr) {
          console.error('Failed to save answer to Supabase:', answerErr);
        }
      }
    } catch {
      setMessages(prev => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: 'Error connecting to AI service.' } : m)));
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  // keyboard shortcut: Cmd/Ctrl+Enter to send
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const generateReport = async () => {
    if (!chatId || !accessToken) return;
    try {
      const resp = await fetch(`/api/reports/ai-use/${encodeURIComponent(chatId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ style: 'none', length: 'brief' }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        alert(`Failed to create report: ${msg}`);
        return;
      }
      const data = await resp.json();
      const reportId = data.report_id;
      if (reportId) router.push(`/report/${reportId}`);
    } catch {
      alert('Error creating report');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#060606] text-neutral-100 flex items-center justify-center px-4">
        <div className="text-sm text-neutral-300">Checking authentication…</div>
      </div>
    );
  }

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="min-h-screen bg-[#060606] text-neutral-100 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-100">
          Supabase auth is not configured. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#060606] text-neutral-100 flex items-center justify-center px-4">
        <form
          onSubmit={handleSignIn}
          className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 space-y-4"
        >
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sign in to Hoot</h1>
            <p className="mt-1 text-sm text-neutral-400">Use your Supabase account to access course data.</p>
          </div>
          {authError && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {authError}
            </div>
          )}
          <label className="block text-sm text-neutral-300">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 w-full h-10 rounded-xl border border-neutral-700 bg-neutral-950 px-3 outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </label>
          <label className="block text-sm text-neutral-300">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full h-10 rounded-xl border border-neutral-700 bg-neutral-950 px-3 outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </label>
          <button
            type="submit"
            disabled={authLoading}
            className="h-10 w-full rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
          >
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060606] text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 sticky top-0 z-10 bg-[#070607]">
        <div className="px-4 py-3 relative flex items-center justify-between">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="font-semibold tracking-tight text-lg">Hoot</div>
          </div>
          <div className="flex items-center relative z-[1]">
            <div ref={classDropdownRef} className="relative">
              <button
                onClick={() => setClassDropdownOpen(prev => !prev)}
                disabled={classesLoading}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-neutral-700/50 bg-neutral-900/60 text-sm text-neutral-200 hover:bg-neutral-800 hover:border-neutral-600 transition-all duration-200 disabled:opacity-50"
              >
                <span className="max-w-[160px] truncate">
                  {classesLoading ? 'Loading…' : (classOptions.find(c => c.id === selectedClassId)?.name || 'Select class')}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${classDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {classDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute left-0 top-full mt-1.5 min-w-[180px] rounded-lg border border-neutral-700/50 bg-neutral-900 shadow-xl shadow-black/40 overflow-hidden"
                  >
                    {classOptions.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedClassId(c.id);
                          setFormError(null);
                          setClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-100 ${
                          c.id === selectedClassId
                            ? 'bg-neutral-800 text-white'
                            : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                    {!classesLoading && classOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-neutral-500">No classes available</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-[1]">
            <button onClick={generateReport} className="px-3 py-1.5 rounded-md bg-neutral-900 border border-neutral-700 text-sm hover:bg-neutral-800 transition-colors">Generate report</button>
            <div className="text-xs text-neutral-400 hidden md:block max-w-[220px] truncate" title={userLabel}>
              {userLabel}
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-md border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

     <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
        <div className="grid gap-4">
          <div className="space-y-4">
            {textbooksError && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {textbooksError}
              </div>
            )}
            {textbooksLoading && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300">
                Loading course resources…
              </div>
            )}
            {classesError && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {classesError}
              </div>
            )}
            {messages.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-3 ${m.role === 'user' ? 'bg-neutral-900 border border-neutral-800' : ''}`}
              >
                {m.role === 'user' && (
                  <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">{m.role}</div>
                )}
                <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                  {m.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {normalizeMath(m.content)}
                    </ReactMarkdown>
                  ) : (
                    m.content
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
                      <div key={i} className="relative h-24 w-full">
                        <Image
                          src={a.dataUrl}
                          alt={a.name}
                          fill
                          className="rounded-xl border border-neutral-800 object-cover"
                          sizes="(max-width: 640px) 33vw, 200px"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 py-2"
              >
                <video
                  src="/thinking.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-16 h-16 object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-neutral-300">Hooting<span className="dot-1">.</span><span className="dot-2">.</span><span className="dot-3">.</span></span>
                  {loadingStatus && (
                    <span className="text-xs italic text-neutral-500">{loadingStatus}</span>
                  )}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

      </main>

      <div className="border-t border-neutral-800 bg-[#070607]">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {formError && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {formError}
            </div>
          )}
          <Dropzone onDrop={(files) => addFiles(files)}>
            {({ getRootProps, getInputProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className={`mb-2 rounded-xl border border-dashed ${isDragActive ? 'border-neutral-300' : 'border-neutral-800'} p-3 text-sm text-neutral-400 flex items-center gap-2`}
              >
                <input {...getInputProps()} accept="image/*" />
                <ImagePlus className="h-4 w-4" />
                {isDragActive ? 'Drop your screenshots…' : 'Drag & drop screenshots, click to upload, or paste into the box below.'}
              </div>
            )}
          </Dropzone>

          {!!attachments.length && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative">
                  <div className="relative h-16 w-16">
                    <Image
                      src={a.dataUrl}
                      alt={a.name}
                      fill
                      className="object-cover rounded-xl border border-neutral-800"
                      sizes="64px"
                      unoptimized
                    />
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-2 -right-2 bg-neutral-900 border border-neutral-700 rounded-full p-1"
                    aria-label="Remove"
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
              className="flex-1 resize-none rounded-2xl bg-neutral-900 border border-neutral-800 p-3 outline-none focus:ring-2 focus:ring-neutral-600"
            />
            <button
              onClick={send}
              disabled={
                loading ||
                (!input.trim() && attachments.length === 0) ||
                selectedClassId == null
              }
              className="h-10 w-10 rounded-2xl bg-white text-black flex items-center justify-center disabled:opacity-40"
              aria-label="Send"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5" />
              PNG/JPG up to ~5MB each • max 6 images
            </div>
            <div>{loading ? (loadingStatus || 'Thinking…') : 'Press ⌘/Ctrl + Enter to send'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
