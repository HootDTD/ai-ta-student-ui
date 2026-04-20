"use client";

import Image from 'next/image';

export type CitationMeta = {
  label: string;
  doc_type?: string;
  file?: string;
  page?: number | null;
  ocr_conf?: number | null;
  bbox?: number[] | null;
  thumb?: string | null;
};

type Props = { meta: CitationMeta };

export function CitationChip({ meta }: Props) {
  const { label, doc_type, file, page, ocr_conf, thumb } = meta;
  const pageLabel = typeof page === 'number' ? `p. ${page}` : null;
  const ocrLabel =
    typeof ocr_conf === 'number' ? `OCR ${(ocr_conf * 100).toFixed(0)}%` : null;
  const metaLine = [pageLabel, ocrLabel].filter(Boolean).join(' · ');

  return (
    <div className="citation-chip">
      <span className="citation-chip__label">{label}</span>
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
