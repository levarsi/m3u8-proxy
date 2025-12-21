import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { toast } from 'sonner';
import { http } from '../lib/http';
import { isLikelyUrl } from '../lib/utils';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
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

export function ProxyPlayerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [url, setUrl] = useState('');
  const [loadingTest, setLoadingTest] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [history, setHistory] = useState<TestItem[]>([]);

  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [info, setInfo] = useState('');

  const canUse = useMemo(() => isLikelyUrl(url.trim()), [url]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  function setPlayerStatus(s: typeof status, i: string) {
    setStatus(s);
    setInfo(i);
  }

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

    setLoadingTest(true);
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
      setResultModalOpen(true);

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

      setHistory((prev: TestItem[]) => [item, ...prev].slice(0, 10));
      toast.success('代理测试完成');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '代理测试失败';
      toast.error(msg);
    } finally {
      setLoadingTest(false);
    }
  }

  async function loadIntoPlayer(targetUrl?: string) {
    const raw = (targetUrl ?? url).trim();
    if (!raw) {
      toast.warning('请输入 M3U8 URL');
      return;
    }
    if (!isLikelyUrl(raw)) {
      toast.warning('请输入有效的 URL');
      return;
    }

    const finalUrl = `/proxy?url=${encodeURIComponent(raw)}`;

    const video = videoRef.current;
    if (!video) return;

    setPlayerStatus('loading', '加载中...');

    try {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        });
        hlsRef.current = hls;

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          setPlayerStatus('loading', '媒体已附加');
          hls.loadSource(finalUrl);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (_evt: unknown, data: { levels: unknown[] }) => {
          setPlayerStatus('loading', `清单已解析，共 ${data.levels.length} 个清晰度`);
          video
            .play()
            .then(() => {
              setPlayerStatus('playing', '视频播放中');
              toast.success('视频加载成功');
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : '播放失败';
              setPlayerStatus('error', '播放失败');
              toast.error(msg);
            });
        });

        hls.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal?: boolean }) => {
          if (data?.fatal) {
            setPlayerStatus('error', '播放器错误');
            toast.error('播放器错误');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = finalUrl;
        await video.play();
        setPlayerStatus('playing', '视频播放中');
        toast.success('视频加载成功');
      } else {
        setPlayerStatus('error', '浏览器不支持 HLS');
        toast.error('当前浏览器不支持 HLS 播放');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setPlayerStatus('error', '加载失败');
      toast.error(msg);
    }
  }

  async function testAndPlay() {
    await runTest();
    await loadIntoPlayer();
  }

  function copyTestResult() {
    if (!result) return;
    navigator.clipboard
      .writeText(result)
      .then(() => toast.success('测试结果已复制'))
      .catch(() => toast.error('复制失败'));
  }

  function downloadTestResult() {
    if (!result) return;
    const blob = new Blob([result], { type: 'application/vnd.apple.mpegurl' });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = `proxy-test-${new Date().toISOString().replace(/[:.]/g, '-')}.m3u8`;
    a.click();
    URL.revokeObjectURL(urlObj);
    toast.success('已下载测试结果');
  }

  async function toggleFullscreen() {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await video.requestFullscreen();
    }
  }

  async function togglePip() {
    const video = videoRef.current as any;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        // @ts-ignore
        await document.exitPictureInPicture();
      } else {
        // @ts-ignore
        await video.requestPictureInPicture();
      }
    } catch {
      toast.error('画中画不可用');
    }
  }

  return (
    <div>
      <Modal
        open={resultModalOpen}
        title="测试结果（前 200 行）"
        onClose={() => setResultModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={copyTestResult} disabled={!result}>
              复制
            </Button>
            <Button variant="secondary" onClick={downloadTestResult} disabled={!result}>
              下载
            </Button>
            <Button variant="primary" onClick={() => setResultModalOpen(false)}>
              关闭
            </Button>
          </>
        }
      >
        <pre className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 dark:border-white/10 dark:bg-black/30 dark:text-slate-200">
          {result ? result.split('\n').slice(0, 200).join('\n') : '暂无结果'}
        </pre>
      </Modal>

      <PageHeader
        title="代理测试 / 播放器"
        subtitle="一个页面完成：测试、预览、历史、播放（均通过 /proxy）"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="URL 输入与操作"
            actions={
              <>
                <Button variant="secondary" onClick={runTest} disabled={!canUse || loadingTest}>
                  {loadingTest ? '测试中…' : '测试'}
                </Button>
                <Button variant="primary" onClick={() => loadIntoPlayer()} disabled={!canUse}>
                  播放
                </Button>
                <Button variant="secondary" onClick={testAndPlay} disabled={!canUse || loadingTest}>
                  测试并播放
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setResultModalOpen(true)}
                  disabled={!result}
                  title={!result ? '暂无测试结果' : '查看最近一次测试结果'}
                >
                  查看结果
                </Button>
              </>
            }
          >
            <div>
              <label className="text-sm text-slate-700 dark:text-slate-300">M3U8 URL</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500/60 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:focus:border-sky-400/60"
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u8"
              />
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                播放与测试都走服务端 `/proxy?url=...`，因此不受浏览器 CORS 限制。
              </div>
            </div>
          </Panel>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Panel title="播放器" actions={
              <>
                <Button variant="ghost" onClick={toggleFullscreen}>全屏</Button>
                <Button variant="ghost" onClick={togglePip}>画中画</Button>
              </>
            }>
              <div className="text-xs text-slate-500 dark:text-slate-400">状态: {status}{info ? ` - ${info}` : ''}</div>
              <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-black/40 dark:border-white/10">
                <video ref={videoRef} controls className="h-full w-full" />
              </div>
            </Panel>
          </div>
        </div>

        <div>
          <Panel title="测试历史（点击回填并可直接播放）">
            {history.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">暂无测试历史</div>
            ) : (
              <div className="space-y-2">
                {history.map((h: TestItem, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-200"
                  >
                    <button className="w-full text-left" onClick={() => setUrl(h.url)}>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">{h.url}</div>
                      <div className="mt-1 text-xs">
                        状态 {h.status} | {h.responseTimeMs}ms | 片段 {h.segmentCount} |{' '}
                        {h.hasAds ? '检测到广告标记' : '无广告标记'}
                      </div>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" onClick={() => loadIntoPlayer(h.url)}>
                        播放
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(h.url)
                            .then(() => toast.success('已复制到剪贴板'))
                            .catch(() => toast.error('复制失败'));
                        }}
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
