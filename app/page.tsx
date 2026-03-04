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

type Attachment = { name: string; type: string; dataUrl: string; size: number };
import { CitationChip, type CitationMeta } from '@/components/CitationChip';

type Message = { role: 'user' | 'assistant'; content: string; attachments?: Attachment[]; created_at: string; citations?: CitationMeta[] };
type Textbook = { id: string; title: string; label: string | null; created_at: string };
type AskResponse = {
  answer?: string;
  logs?: unknown;
  citations?: CitationMeta[];
};

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_ENABLED = Boolean(rawSupabaseUrl && rawSupabaseAnonKey);
const SUPABASE_URL: string | undefined = rawSupabaseUrl;
const SUPABASE_ANON_KEY: string | undefined = rawSupabaseAnonKey;
const SUPABASE_REST_URL = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : undefined;

async function fetchTextbooks(): Promise<Textbook[]> {
  if (!SUPABASE_ENABLED || !SUPABASE_REST_URL || !SUPABASE_ANON_KEY) return [];
  const resp = await fetch(
    `${SUPABASE_REST_URL}/textbooks?select=id,title,label,created_at&order=title.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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

async function insertQuestion(payload: InsertQuestionPayload): Promise<{ id: string }> {
  if (!SUPABASE_ENABLED || !SUPABASE_REST_URL || !SUPABASE_ANON_KEY) {
    return { id: `local-${Date.now()}` };
  }
  const resp = await fetch(`${SUPABASE_REST_URL}/questions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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

async function insertAnswer(payload: InsertAnswerPayload): Promise<void> {
  if (!SUPABASE_ENABLED || !SUPABASE_REST_URL || !SUPABASE_ANON_KEY) return;
  const resp = await fetch(`${SUPABASE_REST_URL}/answers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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

type ClassOption = { slug: string; name: string; subject_name: string };

async function fetchClasses(): Promise<ClassOption[]> {
  const resp = await fetch('/api/classes', { cache: 'no-store' });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

export default function Page() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksLoading, setTextbooksLoading] = useState<boolean>(true);
  const [textbooksError, setTextbooksError] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string>('');
  // Removed AI Link logs UI/state
  const SHOW_PREVIEWS = (process.env.NEXT_PUBLIC_SHOW_CITATION_PREVIEWS || '').toString().trim() === '1';
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedClassObj = classOptions.find(c => c.slug === selectedClass);
  const selectedTextbook = textbooks.find(tb => tb.title === (selectedClassObj?.subject_name ?? '')) ?? null;

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
      if (!SUPABASE_ENABLED) {
        setTextbooks([]);
        setTextbooksError(null);
        setTextbooksLoading(false);
        return;
      }
      setTextbooksLoading(true);
      try {
        const data = await fetchTextbooks();
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
  }, []);

  // fetch available classes from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchClasses();
        if (!cancelled) {
          setClassOptions(data);
          if (data.length > 0) setSelectedClass(data[0].slug);
        }
      } catch {
        // silently fail — dropdown will be empty
      } finally {
        if (!cancelled) setClassesLoading(false);
      }
    })();
    return () => { cancelled = false; };
  }, []);

  // initialize or reuse chat id
  useEffect(() => {
    const existing = localStorage.getItem('hoot_chat_id');
    if (existing) setChatId(existing);
    else {
      const id = 'chat-' + Math.random().toString(16).slice(2, 10);
      localStorage.setItem('hoot_chat_id', id);
      setChatId(id);
    }
  }, []);

  const saveChat = async (turns: Message[]) => {
    if (!chatId || !turns.length) return;
    const payload = {
      chat_id: chatId,
      meta: {},
      turns: turns.map((t, i) => ({
        turn_id: String(i + 1),
        role: t.role,
        content: t.content,
        created_at: t.created_at,
        model: t.role === 'assistant' ? undefined : null,
        tool_name: null,
        attachments: t.attachments?.map(a => ({ name: a.name, mime: a.type, data_url: a.dataUrl })) || [],
      })),
    };
    try {
      await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  };

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

  const send = async () => {
    const questionText = input.trim();
    const attachmentsToSend = attachments;
    if (!questionText && attachmentsToSend.length === 0) return;
    if (!selectedClass) {
      setFormError('Select a class before asking.');
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
    const baseMessages = [...messages, userMessage];
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
        class_name: selectedClass,
        prompt: promptForSupabase,
      });
      questionId = inserted.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to log question.';
      setMessages(prev => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: `[error] ${msg}` } : m)));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          class: selectedClass,
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

      const data = await res.json() as AskResponse;
      const answerText = typeof data.answer === 'string' ? data.answer : '';
      // Logs are no longer displayed in the UI
      const citations = Array.isArray(data.citations) ? data.citations : [];

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
          });
        } catch (answerErr) {
          console.error('Failed to save answer to Supabase:', answerErr);
        }
      }

      saveChat([...baseMessages, { role: 'assistant', content: answerText, created_at: now }]);
    } catch {
      setMessages(prev => prev.map((m, idx) => (idx === aiIndex ? { ...m, content: 'Error connecting to AI service.' } : m)));
    } finally {
      setLoading(false);
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
    if (!chatId) return;
    try {
      const resp = await fetch(`/api/reports/ai-use/${encodeURIComponent(chatId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 sticky top-0 z-10 bg-neutral-950">
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
                  {classesLoading ? 'Loading…' : (classOptions.find(c => c.slug === selectedClass)?.name || 'Select class')}
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
                        key={c.slug}
                        onClick={() => {
                          setSelectedClass(c.slug);
                          setFormError(null);
                          setClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors duration-100 ${
                          c.slug === selectedClass
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
            <div className="text-sm text-neutral-400 hidden sm:block">Beta UI</div>
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
            {messages.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-3 ${m.role === 'user' ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-950 border border-neutral-800'}`}
              >
                <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">{m.role}</div>
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
            <div ref={bottomRef} />
          </div>
        </div>
        
      </main>

      <div className="border-t border-neutral-800 bg-neutral-950">
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
                !selectedClass
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
            <div>{loading ? 'Thinking…' : 'Press ⌘/Ctrl + Enter to send'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
