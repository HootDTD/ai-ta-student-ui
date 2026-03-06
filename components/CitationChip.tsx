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

  return (
    <div className="citation-chip">
      <span className="citation-chip__label">{label}</span>
      <div className="citation-chip__preview">
        <div className="eyebrow">{doc_type || 'Reference'}</div>
        <div>{file || '—'}{typeof page === 'number' ? ` • p. ${page}` : ''}</div>
        {typeof ocr_conf === 'number' && (
          <div className="note">OCR confidence: {(ocr_conf * 100).toFixed(0)}%</div>
        )}
        {thumb && (
          <div className="preview-image" style={{ width: '100%', aspectRatio: '16 / 10' }}>
            <Image src={thumb} alt={label} fill className="object-cover" sizes="256px" unoptimized />
          </div>
        )}
      </div>
    </div>
  );
}
