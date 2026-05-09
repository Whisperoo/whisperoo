import React from 'react';
import termsText from '@/assets/legal/terms.txt?raw';
import privacyText from '@/assets/legal/privacy.txt?raw';

function renderLegalText(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Array<
    | { type: 'title'; text: string; key: string }
    | { type: 'heading'; text: string; key: string }
    | { type: 'subheading'; text: string; key: string }
    | { type: 'paragraph'; text: string; key: string }
    | { type: 'spacer'; key: string }
  > = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ type: 'spacer', key: `sp-${i}` });
      continue;
    }

    // First non-empty line acts as document title
    if (blocks.findIndex((b) => b.type !== 'spacer') === -1) {
      blocks.push({ type: 'title', text: trimmed, key: `t-${i}` });
      continue;
    }

    // Major section headings like "1. INTRODUCTION AND SCOPE"
    if (/^\d+\.\s+[A-Z][A-Z0-9 ,&()\-]+$/.test(trimmed)) {
      blocks.push({ type: 'heading', text: trimmed, key: `h-${i}` });
      continue;
    }

    // Sub-headings like "Table of Contents"
    if (/^[A-Z][A-Za-z ]+$/.test(trimmed) && trimmed.length <= 40) {
      blocks.push({ type: 'subheading', text: trimmed, key: `sh-${i}` });
      continue;
    }

    blocks.push({ type: 'paragraph', text: line, key: `p-${i}` });
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur px-5 py-3">
        <p className="text-xs text-gray-500">Last updated: see document text</p>
      </div>
      <div className="px-5 py-4">
        {blocks.map((b) => {
          if (b.type === 'spacer') return <div key={b.key} className="h-3" />;
          if (b.type === 'title')
            return (
              <h1
                key={b.key}
                className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-3"
              >
                {b.text}
              </h1>
            );
          if (b.type === 'heading')
            return (
              <h2
                key={b.key}
                className="mt-5 mb-2 text-sm sm:text-base font-semibold text-gray-900"
              >
                {b.text}
              </h2>
            );
          if (b.type === 'subheading')
            return (
              <h3
                key={b.key}
                className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                {b.text}
              </h3>
            );
          return (
            <p
              key={b.key}
              className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap"
            >
              {b.text}
            </p>
          );
        })}
      </div>
    </article>
  );
}

export const TermsOfServiceContent: React.FC = () => renderLegalText(termsText);

export const PrivacyPolicyContent: React.FC = () => renderLegalText(privacyText);
