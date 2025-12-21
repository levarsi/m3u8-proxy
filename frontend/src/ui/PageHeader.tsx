import React from 'react';

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
      <div>
        <div className="text-lg font-semibold">{props.title}</div>
        {props.subtitle ? (
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{props.subtitle}</div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
    </div>
  );
}
