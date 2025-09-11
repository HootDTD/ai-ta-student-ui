"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Dropzone from 'react-dropzone';
import { Send, X, ImagePlus, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Attachment = { name: string; type: string; dataUrl: string; size: number };
type Message = { role: 'user' | 'assistant'; content: string; attachments?: Attachment[] };

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

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
    const q = input.trim();
    if (!q && attachments.length === 0) return;

    // push user message
    setMessages(prev => [...prev, { role: 'user', content: q, attachments }]);
    setInput('');
    setAttachments([]);
    setLoading(true);

    // placeholder for streaming assistant message
    const aiIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Minimal body the backend should accept; extend as needed:
          // course_id, doc_sets, etc., can be added here later.
          question: q,
          attachments: attachments.map(a => ({
            name: a.name,
            mime: a.type,
            data_url: a.dataUrl, // base64 data URL; backend decodes
          })),
        }),
      });

      // Handle streaming and non-streaming
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      if (reader) {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages(prev => prev.map((m, i) => i === aiIndex ? { ...m, content: acc } : m));
        }
      } else {
        const text = await res.text();
        acc = text;
        setMessages(prev => prev.map((m, i) => i === aiIndex ? { ...m, content: acc } : m));
      }
    } catch (err) {
      setMessages(prev => prev.map((m, i) => i === aiIndex ? { ...m, content: 'Error connecting to AI service.' } : m));
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-800 sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-tight">AI-TA</div>
          <div className="text-sm text-neutral-400">Beta UI</div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
        {messages.map((m, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-3 ${m.role === 'user' ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-950 border border-neutral-800'}`}
          >
            <div className="text-xs uppercase tracking-wider text-neutral-400 mb-2">{m.role}</div>
            <div className="prose prose-invert max-w-none whitespace-pre-wrap">
              {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
            </div>
            {!!m.attachments?.length && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {m.attachments.map((a, i) => (
                  <img key={i} src={a.dataUrl} alt={a.name} className="rounded-xl border border-neutral-800 object-cover h-24 w-full" />
                ))}
              </div>
            )}
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </main>

      <div className="border-t border-neutral-800 sticky bottom-0 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
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
                  <img src={a.dataUrl} alt={a.name} className="h-16 w-16 object-cover rounded-xl border border-neutral-800" />
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
              disabled={loading || (!input.trim() && attachments.length === 0)}
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

