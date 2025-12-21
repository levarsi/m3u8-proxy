import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClass: Record<Variant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-600/90 text-white dark:bg-sky-500/90 dark:hover:bg-sky-500',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 dark:border-transparent dark:bg-white/10 dark:hover:bg-white/15 dark:text-white',
  danger: 'bg-rose-600 hover:bg-rose-600/90 text-white dark:bg-rose-500/90 dark:hover:bg-rose-500',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-900 dark:hover:bg-white/5 dark:text-white'
};

export function Button({ className, variant = 'secondary', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        className
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
