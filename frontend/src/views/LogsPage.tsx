import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { LoadingState, EmptyState } from '../ui/States';
import { confirmAction } from '../ui/confirm';

type LogItem = {
  level: string;
  message: string;
  timestamp: string;
  module?: string;
  category?: string;
  url?: string;
  reason?: string;
  [key: string]: any; // 允许其他元数据字段
};

type LogsResponse = {
  logs?: LogItem[];
};

function levelBadge(level: string) {
  const key = (level || 'info').toLowerCase();
  const cls =
    key === 'error'
      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-200'
      : key === 'warn'
        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
        : key === 'debug'
          ? 'bg-slate-500/20 text-slate-700 dark:text-slate-200'
          : 'bg-sky-500/15 text-sky-700 dark:text-sky-200';
  return <span className={`rounded-md px-2 py-0.5 text-xs ${cls}`}>{key}</span>;
}

// 广告过滤日志卡片
function AdFilterLogCard({ log, onFeedback }: { log: LogItem; onFeedback: (url: string, isAd: boolean) => void }) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-50 p-3 text-sm dark:border-rose-400/30 dark:bg-rose-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {levelBadge(log.level)}
          <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">[广告拦截]</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
          {log.module ? <span className="text-xs text-slate-500 dark:text-slate-400">[{log.module}]</span> : null}
        </div>
        {log.url && (
          <Button
            variant="ghost"
            className="h-6 px-2 text-xs text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/40"
            onClick={() => onFeedback(log.url!, true)}
            title="将此片段作为广告样本加入训练集"
          >
            + 加入训练 (广告)
          </Button>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex">
          <span className="w-16 flex-shrink-0 text-xs text-slate-500">URL:</span>
          <span className="break-all font-mono text-xs text-slate-800 dark:text-slate-200">{log.url}</span>
        </div>
        <div className="flex">
          <span className="w-16 flex-shrink-0 text-xs text-slate-500">原因:</span>
          <span className="break-all text-xs text-slate-600 dark:text-slate-300">{log.reason}</span>
        </div>
      </div>
    </div>
  );
}

export function LogsPage() {
  const [level, setLevel] = useState<string>('');
  const [module, setModule] = useState<string>('');

  const queryKey = useMemo(() => ['logs', level, module], [level, module]);

  const logsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      if (module) params.set('module', module);
      params.set('limit', '200');

      const { data } = await http.get<LogsResponse>(`/logs?${params.toString()}`);
      return data;
    },
    refetchInterval: 5000
  });

  async function clearLogs() {
    const ok = await confirmAction('确定要清除所有日志吗？');
    if (!ok) return;

    try {
      await http.delete('/logs');
      toast.success('日志已清除');
      logsQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? '清除日志失败');
    }
  }

  function extractUrlFromMessage(message: string): string | null {
    const match = message.match(/https?:\/\/[^\s"',]+/);
    return match ? match[0] : null;
  }

  async function handleFeedback(url: string, isAd: boolean) {
    try {
      await http.post('/nn-model/feedback', {
        url,
        isAd,
        source: 'log-feedback'
      });
      toast.success(isAd ? '已标记为广告并加入训练集' : '已标记为正常并加入训练集');
    } catch (e: any) {
      toast.error(e?.message ?? '反馈失败');
    }
  }

  const logs = logsQuery.data?.logs ?? [];

  return (
    <div>
      <PageHeader
        title="日志"
        subtitle="查看系统日志，支持按等级/模块筛选"
        actions={
          <>
            <Button variant="secondary" onClick={() => logsQuery.refetch()} disabled={logsQuery.isFetching}>
              刷新
            </Button>
            <Button variant="danger" onClick={clearLogs}>
              清除
            </Button>
          </>
        }
      />

      <Panel title="筛选">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">等级</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500/60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:focus:border-sky-400/60"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">全部</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="debug">debug</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">模块</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500/60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:focus:border-sky-400/60"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="例如: api / proxy / cache / processor"
            />
          </div>
        </div>
      </Panel>

      <div className="mt-4">
        <Panel title="系统日志">
          {logsQuery.isLoading ? <LoadingState /> : null}

          {logs.length === 0 && !logsQuery.isLoading ? (
            <EmptyState title="暂无日志" />
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-auto">
              {logs.map((l, idx) => {
                // 如果是广告过滤日志，使用专用卡片
                if (l.category === 'AD_FILTER') {
                  return <AdFilterLogCard key={idx} log={l} onFeedback={handleFeedback} />;
                }

                const url = extractUrlFromMessage(l.message);
                // 默认日志卡片
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/30"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {levelBadge(l.level)}
                      <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(l.timestamp).toLocaleString()}</span>
                      {l.module ? <span className="text-xs text-slate-500 dark:text-slate-400">[{l.module}]</span> : null}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{l.message}</div>
                    
                    {url && (
                      <div className="mt-2 flex gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <Button
                          variant="ghost"
                          className="h-6 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/20"
                          onClick={() => handleFeedback(url, true)}
                        >
                          标记为广告
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-6 px-2 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                          onClick={() => handleFeedback(url, false)}
                        >
                          标记为正常
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
