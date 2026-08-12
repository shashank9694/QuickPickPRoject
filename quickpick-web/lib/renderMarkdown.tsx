import React from "react";

// Renders inline markdown: **bold**, *italic*, `code`, and bare URLs.
function renderInline(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  // Pattern order matters — process bold before italic.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push(text.slice(last, m.index));
    const raw = m[0];
    if (raw.startsWith("**")) {
      segments.push(<strong key={i++}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("*")) {
      segments.push(<em key={i++}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith("`")) {
      segments.push(<code key={i++} className="bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded text-[0.85em] font-mono">{raw.slice(1, -1)}</code>);
    } else {
      segments.push(<a key={i++} href={raw} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-800">{raw}</a>);
    }
    last = m.index + raw.length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments.length === 1 ? segments[0] : segments;
}

export function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    out.push(
      <ul key={key++} className="list-disc list-outside ml-5 space-y-1.5 mb-5 text-slate-700 leading-relaxed">
        {listItems.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
      </ul>
    );
    listItems = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const t = line.trim();

    if (t.startsWith("### ")) {
      flushList();
      out.push(<h3 key={key++} className="text-xl font-bold text-slate-900 mt-8 mb-2">{renderInline(t.slice(4))}</h3>);
    } else if (t.startsWith("## ")) {
      flushList();
      out.push(<h2 key={key++} className="text-2xl font-extrabold text-slate-900 mt-10 mb-3 pb-2 border-b border-slate-100">{renderInline(t.slice(3))}</h2>);
    } else if (t.startsWith("# ")) {
      flushList();
      out.push(<h1 key={key++} className="text-3xl font-extrabold text-slate-900 mt-10 mb-4">{renderInline(t.slice(2))}</h1>);
    } else if (/^[-*] /.test(t)) {
      listItems.push(t.slice(2));
    } else if (t === "---") {
      flushList();
      out.push(<hr key={key++} className="my-8 border-slate-200" />);
    } else if (t === "") {
      flushList();
    } else {
      flushList();
      out.push(<p key={key++} className="text-slate-700 leading-relaxed mb-4">{renderInline(t)}</p>);
    }
  }

  flushList();
  return out;
}
