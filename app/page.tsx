"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Dropzone from 'react-dropzone';
import { Send, X, ImagePlus, Paperclip, ChevronDown, MoreVertical, Sun, Moon, Plus, MessageSquare, PanelLeftClose, PanelLeft, Trash2 } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  SUPABASE_AUTH_ENABLED,
  clearStoredSession,
  ensureActiveSession,
  loadStoredSession,
  saveStoredSession,
  signInWithPassword,
  signUpWithPassword,
  type StoredSession,
} from './lib/auth';
import { CitationChip, type CitationMeta } from '@/components/CitationChip';
import SpecialCharsPalette from '@/components/SpecialCharsPalette';
import { startSessionFromHoot, ApolloApiError, getStudentProgress, type StudentProgress } from '@/lib/apollo/api';

type Attachment = { name: string; type: string; dataUrl: string; size: number };
type Message = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  created_at: string;
  citations?: CitationMeta[];
};
type ChatSummary = {
  chat_id: string;
  search_space_id: number;
  title: string;
  turn_count: number;
  created_at: string | null;
  updated_at: string | null;
};

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
  const resp = await fetch('/api/my-classes', {
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
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatList, setChatList] = useState<ChatSummary[]>([]);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [apolloError, setApolloError] = useState<string | null>(null);
  const [apolloStarting, setApolloStarting] = useState(false);
  const [apolloProgress, setApolloProgress] = useState<StudentProgress | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    document.documentElement.classList.add('theme-transition');
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 450);
  };
  const [formError, setFormError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string>('');
  const SHOW_PREVIEWS =
    (process.env.NEXT_PUBLIC_SHOW_CITATION_PREVIEWS || '').toString().trim() === '1';
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function insertChar(ch: string) {
    const ta = inputRef.current;
    if (!ta) {
      setInput((d) => d + ch);
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const next = input.slice(0, start) + ch + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + ch.length, start + ch.length);
    });
  }

  const selectedClassObj = classOptions.find((c) => c.id === selectedClassId);
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
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

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
            setClassesError('You are not enrolled in any classes. Ask your instructor for a join code.');
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
    if (!authReady || !session?.user_id) {
      setApolloProgress(null);
      return;
    }
    let cancelled = false;
    getStudentProgress(session.user_id)
      .then((p) => { if (!cancelled) setApolloProgress(p); })
      .catch(() => { if (!cancelled) setApolloProgress(null); });
    return () => { cancelled = true; };
  }, [authReady, session?.user_id]);

  const createNewChatId = useCallback(() => {
    const id = `chat-${Math.random().toString(16).slice(2, 10)}`;
    setChatId(id);
    setMessages([]);
    return id;
  }, []);

  useEffect(() => {
    if (!session) {
      setChatId('');
      return;
    }
    // On login, start a fresh chat
    createNewChatId();
  }, [session, createNewChatId]);

  const fetchChatList = useCallback(async () => {
    if (!accessToken || !selectedClassId) {
      setChatList([]);
      return;
    }
    setChatListLoading(true);
    try {
      const resp = await fetch(`/api/chats?search_space_id=${selectedClassId}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) throw new Error('Failed to load chats');
      const data = (await resp.json()) as ChatSummary[];
      setChatList(Array.isArray(data) ? data.filter((c) => c.turn_count > 0) : []);
    } catch {
      setChatList([]);
    } finally {
      setChatListLoading(false);
    }
  }, [accessToken, selectedClassId]);

  useEffect(() => {
    if (!authReady || !accessToken || !selectedClassId) {
      setChatList([]);
      return;
    }
    void fetchChatList();
  }, [authReady, accessToken, selectedClassId, fetchChatList]);

  const handleNewChat = useCallback(() => {
    createNewChatId();
    setSidebarOpen(false);
  }, [createNewChatId]);

  const handleLoadChat = useCallback(async (targetChatId: string) => {
    console.log('[handleLoadChat] called with:', targetChatId, 'current chatId:', chatId, 'hasToken:', !!accessToken);
    if (!accessToken) {
      console.warn('[handleLoadChat] no access token');
      return;
    }
    if (targetChatId === chatId) {
      console.log('[handleLoadChat] same chat, closing sidebar');
      setSidebarOpen(false);
      return;
    }
    setLoadingChatId(targetChatId);
    try {
      const url = `/api/chats/${encodeURIComponent(targetChatId)}`;
      console.log('[handleLoadChat] fetching:', url);
      const resp = await fetch(url, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('[handleLoadChat] response status:', resp.status);
      if (!resp.ok) throw new Error(`Failed to load chat (${resp.status})`);
      const data = await resp.json();
      const turns = (data.turns || []) as Array<{
        role: string;
        content: string;
        created_at?: string;
        attachments?: Attachment[];
        citations?: CitationMeta[];
      }>;
      const loadedMessages: Message[] = turns.map((t) => ({
        role: t.role as 'user' | 'assistant',
        content: t.content || '',
        created_at: t.created_at || '',
        attachments: t.attachments,
        citations: Array.isArray(t.citations) ? t.citations : [],
      }));
      setChatId(targetChatId);
      setMessages(loadedMessages);
      setSidebarOpen(false);
    } catch {
      setFormError('Failed to load chat history.');
    } finally {
      setLoadingChatId(null);
    }
  }, [accessToken, chatId]);

  const handleDeleteChat = useCallback(async (targetChatId: string) => {
    console.log('[handleDeleteChat] called with:', targetChatId, 'hasToken:', !!accessToken);
    if (!accessToken) return;
    try {
      const resp = await fetch(`/api/chats/${encodeURIComponent(targetChatId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('[handleDeleteChat] response status:', resp.status);
      if (resp.status !== 204 && !resp.ok) throw new Error('Failed to delete chat');
      // If we deleted the active chat, start a new one
      if (targetChatId === chatId) {
        createNewChatId();
      }
      setChatList((prev) => prev.filter((c) => c.chat_id !== targetChatId));
    } catch {
      setFormError('Failed to delete chat.');
    }
  }, [accessToken, chatId, createNewChatId]);

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

  const startApollo = async () => {
    setApolloError(null);
    setApolloStarting(true);
    try {
      const transcript = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      const studentId = session?.user_id ?? 'unknown';
      const { session_id } = await startSessionFromHoot(studentId, transcript);
      router.push(`/apollo?session=${session_id}`);
    } catch (err) {
      if (err instanceof ApolloApiError && err.errorCode === 'no_matching_concept') {
        setApolloError("Apollo doesn't cover this topic yet.");
      } else {
        setApolloError((err as Error).message);
      }
    } finally {
      setApolloStarting(false);
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
    setChatList([]);
    setSidebarOpen(false);
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
    } catch {
      setMessages((prev) =>
        prev.map((m, idx) => (idx === aiIndex ? { ...m, content: 'Error connecting to AI service.' } : m)),
      );
    } finally {
      setLoading(false);
      setLoadingStatus('');
      void fetchChatList();
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
          <p className="note">After signing in, use a class join link from your instructor to enroll.</p>
        </form>
      </div>
    );
  }

  const formatRelativeTime = (isoDate: string | null) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat sidebar */}
      <aside
        className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar--open' : ''}`}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
          <button
            onClick={handleNewChat}
            className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-transparent hover:bg-[var(--card-fill)] transition-colors"
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md hover:bg-[var(--card-fill)] transition-colors"
            type="button"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chatListLoading && (
            <div className="p-3 text-xs text-[var(--muted)]">Loading chats…</div>
          )}
          {!chatListLoading && chatList.length === 0 && (
            <div className="p-3 text-xs text-[var(--muted)]">No previous chats</div>
          )}
          {chatList.map((chat) => {
            const isActive = chat.chat_id === chatId;
            const isLoading = loadingChatId === chat.chat_id;
            return (
              <div
                key={chat.chat_id}
                className={`chat-sidebar-item ${isActive ? 'chat-sidebar-item--active' : ''}`}
                onClick={() => {
                  console.log('[sidebar] clicked chat:', chat.chat_id);
                  void handleLoadChat(chat.chat_id);
                }}
                role="button"
                tabIndex={0}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">
                    {isLoading ? 'Loading…' : (chat.title || 'Untitled chat')}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {formatRelativeTime(chat.updated_at)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('[sidebar] deleting chat:', chat.chat_id);
                    void handleDeleteChat(chat.chat_id);
                  }}
                  className="chat-sidebar-delete shrink-0 p-1 rounded-md hover:bg-[var(--danger-bg)] transition-colors"
                  type="button"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
      <header className="site-header">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-1.5 relative">
          <div className="flex items-center gap-2 relative z-[1]">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-md hover:bg-[var(--card-fill)] transition-colors"
                type="button"
                aria-label="Open chat history"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
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
            {apolloProgress && (
              <div
                className="apollo-xp-chip"
                title={`Level ${apolloProgress.level} · ${apolloProgress.xp_total} XP`}
                aria-label={`${apolloProgress.title}, ${apolloProgress.xp_total} experience points`}
              >
                <span className="apollo-xp-chip__level">L{apolloProgress.level}</span>
                <span className="apollo-xp-chip__xp">{apolloProgress.xp_total} XP</span>
              </div>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="site-brand">Hoot</div>
          </div>
          <div ref={headerMenuRef} className="relative z-[1]">
            <button
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              className="header-menu-trigger"
              type="button"
              aria-label="Menu"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {headerMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="header-menu"
                >
                  <button
                    onClick={toggleTheme}
                    className="dropdown-item text-sm flex items-center gap-2"
                    type="button"
                  >
                    {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {darkMode ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    onClick={() => { generateReport(); setHeaderMenuOpen(false); }}
                    className="dropdown-item text-sm"
                    type="button"
                  >
                    Generate report
                  </button>
                  <button
                    onClick={() => { handleSignOut(); setHeaderMenuOpen(false); }}
                    className="dropdown-item text-sm"
                    type="button"
                  >
                    Sign out of {accountLabel}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 pt-3 pb-4 space-y-4">
        <div className="grid gap-4">
          <div className="space-y-4">
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
                className={m.role === 'user' ? 'flex justify-end' : ''}
              >
              <div className={m.role === 'user' ? 'msg-user' : 'msg-ai'}>
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
                  <div className="msg-ai__sources">
                    <span className="msg-ai__sources-label">Sources referenced</span>
                    {m.citations.map((c, i) => (
                      <CitationChip key={i} meta={c} />
                    ))}
                  </div>
                )}
                {!!m.attachments?.length && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {m.attachments.map((a, i) => (
                      <div key={i} className="relative h-24 w-full border border-[var(--border)] bg-[var(--img-placeholder)]">
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

      <div className="border-t border-[var(--border)] bg-[var(--bar-bg)]">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {apolloError && (
            <div role="alert" className="mb-3 notice" data-tone="danger">
              {apolloError}
            </div>
          )}
          {messages.length > 0 && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={startApollo}
                disabled={apolloStarting}
                className="ui-button ui-button--primary ui-button--small"
                type="button"
              >
                {apolloStarting ? 'Starting\u2026' : 'Teach Apollo what you just learned'}
              </button>
            </div>
          )}
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
                  <div className="relative h-16 w-16 border border-[var(--border)] bg-[var(--img-placeholder)]">
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

          <div className="mb-2">
            <SpecialCharsPalette onInsert={insertChar} />
          </div>

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
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
      </div>{/* end main content wrapper */}
    </div>
  );
}
