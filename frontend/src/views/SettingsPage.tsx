import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { confirmAction } from '../ui/confirm';

type ConfigResponse = {
  adFilter?: { enabled?: boolean };
  cache?: { enabled?: boolean; ttl?: number; maxSize?: number };
  ui?: { title?: string; theme?: string; language?: string; refreshInterval?: number };
  player?: { autoplay?: boolean; defaultVolume?: number; playbackRates?: number[] };
};

export function SettingsPage() {
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [adFilterEnabled, setAdFilterEnabled] = useState(true);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState(300);
  const [cacheMaxSize, setCacheMaxSize] = useState(100);

  const payload = useMemo(
    () => ({
      adFilter: { enabled: adFilterEnabled },
      cache: { enabled: cacheEnabled, ttl: cacheTtlSeconds * 1000, maxSize: cacheMaxSize }
    }),
    [adFilterEnabled, cacheEnabled, cacheTtlSeconds, cacheMaxSize]
  );

  async function load() {
    setLoading(true);
    try {
      const res = await http.get<ConfigResponse>('/config');
      setData(res.data);

      setAdFilterEnabled(res.data.adFilter?.enabled ?? true);
      setCacheEnabled(res.data.cache?.enabled ?? true);
      setCacheTtlSeconds(Math.round((res.data.cache?.ttl ?? 300000) / 1000));
      setCacheMaxSize(res.data.cache?.maxSize ?? 100);
    } catch (e: any) {
      toast.error(e?.message ?? '加载设置失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setLoading(true);
    try {
      await http.post('/config', payload);
      toast.success('设置已保存');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? '保存设置失败');
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    const ok = await confirmAction('确定要重置所有设置吗？（将重新从服务端加载）');
    if (!ok) return;
    load();
    toast.success('设置已重置');
  }

  return (
    <div>
      <PageHeader
        title="设置"
        subtitle="读取 /config 并提交更新（服务端当前为示例实现）"
        actions={
          <>
            <Button variant="primary" onClick={save} disabled={loading}>
              保存设置
            </Button>
            <Button variant="secondary" onClick={reset} disabled={loading}>
              重置
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="广告过滤">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={adFilterEnabled}
              onChange={(e) => setAdFilterEnabled(e.target.checked)}
            />
            启用广告过滤
          </label>
        </Panel>

        <Panel title="缓存">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cacheEnabled}
                onChange={(e) => setCacheEnabled(e.target.checked)}
              />
              启用缓存
            </label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-700 dark:text-slate-300">缓存过期时间 (秒)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500/60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:focus:border-sky-400/60"
                  value={cacheTtlSeconds}
                  onChange={(e) => setCacheTtlSeconds(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-700 dark:text-slate-300">最大缓存条目数</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500/60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:focus:border-sky-400/60"
                  value={cacheMaxSize}
                  onChange={(e) => setCacheMaxSize(parseInt(e.target.value || '0', 10))}
                />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {data ? (
        <div className="mt-4 text-xs text-slate-400">
          UI: {data.ui?.title ?? '-'} | theme {data.ui?.theme ?? '-'} | language{' '}
          {data.ui?.language ?? '-'}
        </div>
      ) : null}
    </div>
  );
}
