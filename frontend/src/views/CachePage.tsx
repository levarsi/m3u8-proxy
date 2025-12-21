import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { formatDurationMs } from '../lib/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { LoadingState, EmptyState } from '../ui/States';
import { confirmAction } from '../ui/confirm';

type CacheStats = {
  enabled: boolean;
  ttl: number;
  size: number;
  maxSize: number;
  stats?: {
    hits?: number;
    misses?: number;
    hitRate?: string;
    topAccessed?: Array<{ key: string; frequency: number }>;
  };
};

export function CachePage() {
  const statsQuery = useQuery({
    queryKey: ['cacheStats'],
    queryFn: async () => {
      const { data } = await http.get<CacheStats>('/cache/stats');
      return data;
    },
    refetchInterval: 5000
  });

  async function clearAll() {
    const ok = await confirmAction('确定要清除所有缓存吗？');
    if (!ok) return;

    try {
      await http.get('/cache/clear');
      toast.success('缓存已清除');
      statsQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? '清除缓存失败');
    }
  }

  const data = statsQuery.data;

  return (
    <div>
      <PageHeader
        title="缓存管理"
        subtitle="查看缓存命中率、TTL 和热门缓存项"
        actions={
          <>
            <Button variant="danger" onClick={clearAll}>
              清除缓存
            </Button>
            <Button variant="secondary" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
              刷新
            </Button>
          </>
        }
      />

      {statsQuery.isLoading ? <LoadingState /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="缓存统计">
          {!data ? (
            <LoadingState />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">状态</span>
                <span>{data.enabled ? '启用' : '禁用'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">TTL</span>
                <span>{formatDurationMs(data.ttl)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">大小</span>
                <span>
                  {data.size} / {data.maxSize}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">命中率</span>
                <span>{data.stats?.hitRate ?? '0%'}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="热门缓存项">
          {!data ? (
            <LoadingState />
          ) : data.stats?.topAccessed && data.stats.topAccessed.length > 0 ? (
            <div className="space-y-2">
              {data.stats.topAccessed.map((it) => (
                <div
                  key={it.key}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/30"
                >
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{it.key}</div>
                  <div className="mt-1">访问次数: {it.frequency}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无热门缓存项" />
          )}
        </Panel>
      </div>
    </div>
  );
}
