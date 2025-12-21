import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { HardDrive, ShieldCheck, Target, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { safeNumber, formatBytes, formatDurationMs } from '../lib/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Panel } from '../ui/Panel';
import { EmptyState, LoadingState } from '../ui/States';

type StatsResponse = {
  system?: {
    uptime?: number;
    memory?: { rss?: number; heapUsed?: number; heapTotal?: number };
    nodeVersion?: string;
    platform?: string;
  };
  cache?: {
    enabled?: boolean;
    size?: number;
    maxSize?: number;
    ttl?: number;
    stats?: { hits?: number; misses?: number; hitRate?: string };
  };
  processor?: {
    enabled?: boolean;
    stats?: { processedCount?: number; adsFiltered?: number; processingTime?: number };
  };
  server?: {
    startTime?: string;
    requestCount?: number;
  };
};

type TsDetectorStats = {
  config?: { enabled?: boolean; cacheSize?: number; thresholds?: unknown };
  detector?: { totalAnalyzed?: number; adsDetected?: number; cacheHits?: number };
  processor?: { accuracy?: number };
};

type LogsResponse = {
  logs?: Array<{ level: string; message: string; timestamp: string; module?: string }>;
};

export function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data } = await http.get<StatsResponse>('/stats');
      return data;
    },
    refetchInterval: 5000
  });

  const tsQuery = useQuery({
    queryKey: ['tsDetectorStats'],
    queryFn: async () => {
      const { data } = await http.get<TsDetectorStats>('/ts-detector/stats');
      return data;
    },
    refetchInterval: 5000
  });

  const adLogsQuery = useQuery({
    queryKey: ['adFilterLogs'],
    queryFn: async () => {
      const { data } = await http.get<LogsResponse>('/logs?module=processor&limit=50');
      return data;
    },
    refetchInterval: 3000
  });

  const stats = statsQuery.data;
  const cache = stats?.cache;
  const processor = stats?.processor;

  const ads = processor?.stats?.adsFiltered ?? 0;
  const seg = processor?.stats?.processedCount ?? 0;
  const total = ads + seg;
  const rate = total > 0 ? ((ads / total) * 100).toFixed(1) : '0.0';
  const acc = tsQuery.data?.processor?.accuracy ? (tsQuery.data.processor.accuracy * 100).toFixed(1) : '0.0';
  const avg = processor?.stats?.processingTime ?? 0;

  async function exportAdFilterStats() {
    const payload = {
      timestamp: new Date().toISOString(),
      adsFiltered: ads,
      totalSegments: seg,
      filterRate: `${rate}%`,
      filterAccuracy: `${acc}%`,
      averageProcessingTimeMs: avg,
      tsDetectionEnabled: tsQuery.data?.config?.enabled ?? false,
      tsTotalAnalyzed: tsQuery.data?.detector?.totalAnalyzed ?? 0
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-filter-stats-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('统计已导出');
  }

  return (
    <div>
      <PageHeader
        title="仪表板"
        subtitle="系统状态、缓存与广告过滤概览"
        actions={
          <>
            <Button variant="secondary" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
              刷新
            </Button>
            <Button variant="primary" onClick={exportAdFilterStats}>
              导出过滤统计
            </Button>
          </>
        }
      />

      {statsQuery.isLoading ? <LoadingState /> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="缓存命中率"
          value={cache?.stats?.hitRate ?? '0%'}
          hint={`命中 ${safeNumber(cache?.stats?.hits)} / 未命中 ${safeNumber(cache?.stats?.misses)}`}
          icon={HardDrive}
        />
        <StatCard
          title="总过滤广告"
          value={safeNumber(ads).toLocaleString()}
          hint={`过滤率 ${rate}%`}
          icon={ShieldCheck}
        />
        <StatCard
          title="过滤准确率"
          value={`${acc}%`}
          hint="基于 TS 检测"
          icon={Target}
        />
        <StatCard
          title="过滤效率"
          value={`${Number(avg).toFixed(2)}ms`}
          hint={`处理片段 ${safeNumber(seg).toLocaleString()}`}
          icon={Zap}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="系统信息">
          {!stats ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-900 dark:text-slate-200 md:grid-cols-2">
              <div>
                <div className="text-slate-600 dark:text-slate-400">运行时间</div>
                <div className="mt-1">
                  {stats.system?.uptime ? formatDurationMs(stats.system.uptime * 1000) : '-'}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">Node.js</div>
                <div className="mt-1">{stats.system?.nodeVersion ?? '-'}</div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">内存 (RSS)</div>
                <div className="mt-1">
                  {formatBytes(safeNumber(stats.system?.memory?.rss))}
                </div>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">平台</div>
                <div className="mt-1">{stats.system?.platform ?? '-'}</div>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="缓存概览">
          {!cache ? (
            <LoadingState />
          ) : (
            <div className="space-y-2 text-sm text-slate-900 dark:text-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">状态</span>
                <span>{cache.enabled ? '启用' : '禁用'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">TTL</span>
                <span>{cache.ttl ? formatDurationMs(cache.ttl) : '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">大小</span>
                <span>
                  {safeNumber(cache.size)} / {safeNumber(cache.maxSize)}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="TS 检测统计">
          {tsQuery.isLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-2 text-sm text-slate-900 dark:text-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">检测状态</span>
                <span>{tsQuery.data?.config?.enabled ? '启用' : '禁用'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">缓存大小</span>
                <span>{tsQuery.data?.config?.cacheSize ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">总分析</span>
                <span>{tsQuery.data?.detector?.totalAnalyzed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">检测到广告</span>
                <span>{tsQuery.data?.detector?.adsDetected ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">缓存命中</span>
                <span>{tsQuery.data?.detector?.cacheHits ?? 0}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="实时过滤日志">
          {adLogsQuery.isLoading ? <LoadingState /> : null}
          {adLogsQuery.data?.logs && adLogsQuery.data.logs.length > 0 ? (
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {adLogsQuery.data.logs.map((l, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/30"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-slate-200/60 px-2 py-0.5 text-slate-800 dark:bg-white/10 dark:text-slate-200">
                      {(l.level || 'info').toLowerCase()}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">{new Date(l.timestamp).toLocaleString()}</span>
                    {l.module ? <span className="text-slate-600 dark:text-slate-400">[{l.module}]</span> : null}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{l.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无过滤日志" />
          )}
        </Panel>
      </div>
    </div>
  );
}
