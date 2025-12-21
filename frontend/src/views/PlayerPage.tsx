import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { toast } from 'sonner';
import { isLikelyUrl } from '../lib/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';

export function PlayerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [info, setInfo] = useState('');

  const canLoad = useMemo(() => isLikelyUrl(url.trim()), [url]);

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

  async function load() {
    const target = url.trim();
    if (!target) {
      toast.warning('请输入 M3U8 URL');
      return;
    }
    if (!isLikelyUrl(target)) {
      toast.warning('请输入有效的 URL');
      return;
    }

    const finalUrl = `/proxy?url=${encodeURIComponent(target)}`;

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

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          setPlayerStatus('loading', `清单已解析，共 ${data.levels.length} 个清晰度`);
          video
            .play()
            .then(() => {
              setPlayerStatus('playing', '视频播放中');
              toast.success('视频加载成功');
            })
            .catch((e) => {
              setPlayerStatus('error', '播放失败');
              toast.error(e?.message ?? '播放失败');
            });
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
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
    } catch (e: any) {
      setPlayerStatus('error', '加载失败');
      toast.error(e?.message ?? '加载失败');
    }
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
      <PageHeader title="播放器" subtitle="通过代理加载外部 M3U8（/proxy）" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="播放器">
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-300">M3U8 URL</label>
                <div className="mt-1 flex gap-2">
                  <input
                    className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/60"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/playlist.m3u8"
                  />
                  <Button variant="primary" onClick={load} disabled={!canLoad}>
                    加载
                  </Button>
                </div>
                <div className="mt-2 text-xs text-slate-400">状态: {status} {info ? `- ${info}` : ''}</div>
              </div>

              <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <video ref={videoRef} controls className="h-full w-full" />
              </div>
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="控制">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={toggleFullscreen}>
                全屏
              </Button>
              <Button variant="secondary" onClick={togglePip}>
                画中画
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
