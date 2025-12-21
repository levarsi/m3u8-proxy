import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { isLikelyUrl } from '../lib/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';

type TestItem = {
  url: string;
  status: number;
  responseTimeMs: number;
  segmentCount: number;
  timestamp: string;
  hasAds: boolean;
};

export function ProxyTestPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<TestItem[]>([]);

  const canTest = useMemo(() => isLikelyUrl(url.trim()), [url]);

  async function runTest() {
    const target = url.trim();
    if (!target) {
      toast.warning('请输入 M3U8 URL');
      return;
    }
    if (!isLikelyUrl(target)) {
      toast.warning('请输入有效的 URL');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const start = performance.now();
      const res = await http.get<string>(`/proxy?url=${encodeURIComponent(target)}`, {
        headers: { Accept: 'application/vnd.apple.mpegurl' },
        responseType: 'text'
      });
      const end = performance.now();

      const content = typeof res.data === 'string' ? res.data : '';
      setResult(content);

      const lines = content.split('\n');
      const segmentCount = lines.filter((l) => l.trim() && !l.startsWith('#')).length;
      const hasAds = content.includes('# Advertisements filtered');

      const item: TestItem = {
        url: target,
        status: res.status,
        responseTimeMs: Math.round(end - start),
        segmentCount,
        timestamp: new Date().toISOString(),
        hasAds
      };

      setHistory((prev) => [item, ...prev].slice(0, 10));

      toast.success('代理测试完成');
    } catch (e: any) {
      toast.error(e?.message ?? '代理测试失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="代理测试" subtitle="输入 M3U8 URL，经由 /proxy 获取并分析" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="M3U8 URL 测试"
            actions={
              <Button variant="primary" onClick={runTest} disabled={!canTest || loading}>
                {loading ? '测试中…' : '测试'}
              </Button>
            }
          >
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-300">M3U8 URL</label>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/60"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u8"
                />
                <div className="mt-2 text-xs text-slate-400">
                  外部 URL 将由服务端代理处理以规避 CORS。
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-300">结果（前 200 行）</label>
                <pre className="mt-1 max-h-[420px] overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-200">
                  {result ? result.split('\n').slice(0, 200).join('\n') : '暂无结果'}
                </pre>
              </div>
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="测试历史">
            {history.length === 0 ? (
              <div className="text-sm text-slate-400">暂无测试历史</div>
            ) : (
              <div className="space-y-2">
                {history.map((h, idx) => (
                  <button
                    key={idx}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/30 p-3 text-left text-sm text-slate-200 hover:bg-white/5"
                    onClick={() => setUrl(h.url)}
                  >
                    <div className="truncate text-xs text-slate-400">{h.url}</div>
                    <div className="mt-1 text-xs">
                      状态 {h.status} | {h.responseTimeMs}ms | 片段 {h.segmentCount} |{' '}
                      {h.hasAds ? '检测到广告标记' : '无广告标记'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
