import React from 'react';

export function Panel(props: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div className="text-sm font-semibold">{props.title}</div>
        <div className="flex items-center gap-2">{props.actions}</div>
      </div>
      <div className="p-4">{props.children}</div>
    </div>
  );
}
