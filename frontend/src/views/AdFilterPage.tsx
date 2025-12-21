import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { StatCard } from '../ui/StatCard';
import { LoadingState, EmptyState } from '../ui/States';
import { ShieldCheck, Film, Target, Zap } from 'lucide-react';

type StatsResponse = {
  processor?: {
    enabled?: boolean;
    stats?: { adsFiltered?: number; processedCount?: number; processingTime?: number };
  };
};

type TsDetectorStats = {
  config?: { enabled?: boolean; cacheSize?: number; thresholds?: any };
  detector?: { totalAnalyzed?: number; adsDetected?: number; cacheHits?: number };
  processor?: { accuracy?: number };
};

type LogsResponse = {
  logs?: Array<{ level: string; message: string; timestamp: string; module?: string }>;
};

export function AdFilterPage() {
  const statsQuery = useQuery({
    queryKey: ['adFilterStats'],
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

  const logsQuery = useQuery({
    queryKey: ['adFilterLogs'],
    queryFn: async () => {
      const { data } = await http.get<LogsResponse>('/logs?level=info&module=processor&limit=50');
      return data;
    },
    refetchInterval: 3000
  });

  async function exportStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      adsFiltered: statsQuery.data?.processor?.stats?.adsFiltered ?? 0,
      totalSegments: statsQuery.data?.processor?.stats?.processedCount ?? 0,
      tsDetectionEnabled: tsQuery.data?.config?.enabled ?? false,
      tsTotalAnalyzed: tsQuery.data?.detector?.totalAnalyzed ?? 0
    };

    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-filter-stats-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('统计已导出');
  }

  const ads = statsQuery.data?.processor?.stats?.adsFiltered ?? 0;
  const seg = statsQuery.data?.processor?.stats?.processedCount ?? 0;
  const total = ads + seg;
  const rate = total > 0 ? ((ads / total) * 100).toFixed(1) : '0.0';
  const acc = tsQuery.data?.processor?.accuracy ? (tsQuery.data.processor.accuracy * 100).toFixed(1) : '0.0';
  const avg = statsQuery.data?.processor?.stats?.processingTime ?? 0;

  return (
    <div>
      <PageHeader
        title="广告过滤"
        subtitle="统计概览 + TS 检测状态 + 实时过滤日志"
        actions={
          <>
            <Button variant="secondary" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
              刷新
            </Button>
            <Button variant="primary" onClick={exportStats}>
              导出统计
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="总过滤广告" value={ads.toLocaleString()} hint={`过滤率 ${rate}%`} icon={ShieldCheck} />
        <StatCard title="总处理片段" value={seg.toLocaleString()} hint="所有 TS 片段" icon={Film} />
        <StatCard title="过滤准确率" value={`${acc}%`} hint="基于 TS 检测" icon={Target} />
        <StatCard title="过滤效率" value={`${avg.toFixed(2)}ms`} hint="平均处理时间" icon={Zap} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="TS 检测统计">
          {tsQuery.isLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">检测状态</span>
                <span>{tsQuery.data?.config?.enabled ? '启用' : '禁用'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">缓存大小</span>
                <span>{tsQuery.data?.config?.cacheSize ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">总分析</span>
                <span>{tsQuery.data?.detector?.totalAnalyzed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">检测到广告</span>
                <span>{tsQuery.data?.detector?.adsDetected ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">缓存命中</span>
                <span>{tsQuery.data?.detector?.cacheHits ?? 0}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="实时过滤日志">
          {logsQuery.isLoading ? <LoadingState /> : null}
          {logsQuery.data?.logs && logsQuery.data.logs.length > 0 ? (
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {logsQuery.data.logs.map((l, idx) => (
                <div key={idx} className="rounded-lg border border-white/10 bg-slate-950/30 p-3 text-sm">
                  <div className="text-xs text-slate-400">{new Date(l.timestamp).toLocaleString()}</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-100">{l.message}</div>
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
