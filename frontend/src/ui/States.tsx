import React from 'react';

export function LoadingState(props: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-slate-600 dark:text-slate-300">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-700/70 dark:border-white/20 dark:border-t-white/70" />
        {props.label ?? '加载中...'}
      </div>
    </div>
  );
}

export function EmptyState(props: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300/60 bg-slate-50/60 px-4 py-10 text-center dark:border-white/15 dark:bg-white/5">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{props.title}</div>
      {props.description ? (
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{props.description}</div>
      ) : null}
    </div>
  );
}
