import React from 'react';
import type { LucideIcon } from 'lucide-react';

export function StatCard(props: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const Icon = props.icon;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {props.title}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{props.value}</div>
          {props.hint ? <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{props.hint}</div> : null}
        </div>
        {Icon ? (
          <div className="rounded-lg bg-sky-500/15 p-2 text-sky-700 dark:text-sky-200">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
