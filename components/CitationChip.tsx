"use client";

import Image from 'next/image';

import { authHeaders, loadStoredSession } from '@/app/lib/auth';

export type CitationMeta = {
  label: string;
  doc_type?: string;
  file?: string;
  page?: number | null;
  ocr_conf?: number | null;
  bbox?: number[] | null;
  thumb?: string | null;
  // Source-file link keys, all optional (chips without one stay plain text):
  // structured citations from the backend carry `teacher_upload_id`
  // (stringified app.uploads.id); report review chips pass `upload_id` /
  // `doc_id` from their TopicReviewPointer.
  teacher_upload_id?: number | string | null;
  upload_id?: number | string | null;
  doc_id?: number | string | null;
};

type Props = { meta: CitationMeta };

// Numeric-id query for GET /api/materials/file-url, or null when the chip
// has no resolvable source file (older payloads, non-numeric chunk-id
// fallbacks in review pointers).
function sourceQuery(meta: CitationMeta): string | null {
  const uploadId = meta.upload_id ?? meta.teacher_upload_id;
  if (uploadId != null && `${uploadId}`.trim() !== '' && Number.isFinite(Number(uploadId))) {
    return `upload_id=${Number(uploadId)}`;
  }
  if (meta.doc_id != null && `${meta.doc_id}`.trim() !== '' && Number.isFinite(Number(meta.doc_id))) {
    return `doc_id=${Number(meta.doc_id)}`;
  }
  return null;
}

export function CitationChip({ meta }: Props) {
  const { label, doc_type, file, page, ocr_conf, thumb } = meta;
  const pageLabel = typeof page === 'number' ? `p. ${page}` : null;
  const ocrLabel =
    typeof ocr_conf === 'number' ? `OCR ${(ocr_conf * 100).toFixed(0)}%` : null;
  const metaLine = [pageLabel, ocrLabel].filter(Boolean).join(' · ');
  const query = sourceQuery(meta);

  // A new tab can't carry the Bearer header, so the flow is: authenticated
  // fetch mints a short-lived signed URL, then the tab navigates to it. The
  // tab opens synchronously on the click so popup blockers see the gesture;
  // `#page=N` deep-links inside browsers' built-in PDF viewers.
  async function openSource(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const win = window.open('about:blank', '_blank');
    try {
      const session = loadStoredSession();
      const res = await fetch(`/api/materials/file-url?${query}`, {
        headers: authHeaders(session?.access_token) as Record<string, string>,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`file-url ${res.status}`);
      const body = (await res.json()) as { url?: string };
      if (!body.url) throw new Error('file-url response had no url');
      const target = typeof page === 'number' ? `${body.url}#page=${page}` : body.url;
      if (win) win.location.replace(target);
      else window.open(target, '_blank', 'noopener');
    } catch {
      win?.close();
    }
  }

  return (
    <div className="citation-chip">
      {query ? (
        <button
          type="button"
          className="citation-chip__label citation-chip__label--link"
          onClick={openSource}
          title="Open the source PDF in a new tab"
        >
          {label}
        </button>
      ) : (
        <span className="citation-chip__label">{label}</span>
      )}
      <div className="citation-chip__preview">
        <div className="citation-chip__preview-eyebrow">{doc_type || 'Reference'}</div>
        <div className="citation-chip__preview-file">{file || '—'}</div>
        {metaLine && (
          <div className="citation-chip__preview-page">{metaLine}</div>
        )}
        {thumb && (
          <div className="citation-chip__preview-thumb">
            <Image src={thumb} alt={label} fill className="object-cover" sizes="288px" unoptimized />
          </div>
        )}
      </div>
    </div>
  );
}
