import React, { useEffect } from 'react';

export function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    if (!props.open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={props.onClose}
        aria-label="关闭弹窗"
      />

      <div
        className={[
          'relative mx-4 w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950',
          props.widthClassName ?? 'max-w-4xl'
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.title}</div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            onClick={props.onClose}
          >
            关闭
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-4">{props.children}</div>

        {props.footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
