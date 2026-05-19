import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Film,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
  RotateCcw,
  Search,
  Trash2,
  Video,
  Wifi,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SwitchSystemMenu from '../components/SwitchSystemMenu';
import DvrTimeline from '../components/DvrTimeline';
import { useAuth } from '../contexts/AuthContext';

const SCL_API = import.meta.env.VITE_SCL_API_URL || '/scl-api';

interface ClipInfo {
  id: string;
  session_id: string;
  mode: string;
  status: string;
  created_at: string;
  total_duration_seconds: number;
  thumbnail_path?: string;
  resolution?: string;
  athlete_name?: string;
  event_type?: string;
  event_label?: string;
  camera_id?: string;
}

interface RecordingInfo {
  id: string;
  session_id: string;
  game_id: string;
  status: string;
  cameras: string[];
  started_at?: string;
  ended_at?: string;
  total_duration_seconds?: number;
  thumbnail_path?: string;
}

interface SessionInfo {
  id: string;
  device_name: string;
  channel: string;
  started_at: string;
  total_bytes: number;
  tenant_id?: string;
  user_id?: number;
  mode: string;
  uptime_seconds: number;
}

type TabType = 'live' | 'clips' | 'recordings' | 'editor';

const PAGE_SIZE = 12;

async function sclFetch<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${SCL_API}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Erro ao buscar dados');
  }
  return response.json();
}

// ─── Auto Thumbnail Generator via Canvas ─────────────────────────────────
function useVideoThumbnail(videoUrl: string | null, seekTime = 3) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!videoUrl) return;
    let cancelled = false;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = videoUrl;

    const capture = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          setThumbnail(canvas.toDataURL('image/jpeg', 0.8));
        } catch {
          // CORS issue — silently fail
        }
      }
      video.pause();
      video.src = '';
    };

    video.addEventListener('seeked', capture, { once: true });
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(seekTime, video.duration * 0.1 || seekTime);
    }, { once: true });

    video.load();

    return () => {
      cancelled = true;
      video.src = '';
    };
  }, [videoUrl, seekTime]);

  return thumbnail;
}

// ─── Video Preview Hook ────────────────────────────────────────────────────
function useVideoPreview(clipId: string, token: string | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreviewUrl = useCallback(async () => {
    if (!token || previewUrl) return;
    try {
      const data = await sclFetch<{ url: string }>(
        `/api/athlete/clips/${clipId}/stream`, token
      );
      setPreviewUrl(data.url);
    } catch {
      // silently fail
    }
  }, [clipId, token, previewUrl]);

  // Auto-fetch preview URL on mount (pra gerar thumbnail)
  useEffect(() => { fetchPreviewUrl(); }, [fetchPreviewUrl]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    fetchPreviewUrl();
  }, [fetchPreviewUrl]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (isHovered && previewUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      timerRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered, previewUrl]);

  return { videoRef, previewUrl, isHovered, handleMouseEnter, handleMouseLeave };
}

// ─── Clip Card ─────────────────────────────────────────────────────────────
function ClipCard({
  clip,
  token,
  onStream,
  onDownload,
  onDelete,
  canDelete,
  getStatusColor,
  getStatusLabel,
  formatDate,
}: {
  clip: ClipInfo;
  token: string | null;
  onStream: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  getStatusColor: (s: string) => string;
  getStatusLabel: (s: string) => string;
  formatDate: (s?: string) => string;
}) {
  const { videoRef, previewUrl, isHovered, handleMouseEnter, handleMouseLeave } =
    useVideoPreview(clip.id, token);

  // Preferir thumbnail gerado pelo servidor (via ffmpeg + X-Accel-Redirect)
  // Fallback: gera no browser via canvas (lento, baixa o video inteiro)
  const serverThumbnail = clip.status === 'ready' && token
    ? `${SCL_API}/api/athlete/clips/${clip.id}/thumbnail?token=${encodeURIComponent(token)}`
    : null;
  const autoThumbnail = useVideoThumbnail(
    !clip.thumbnail_path && !serverThumbnail && clip.status === 'ready' ? previewUrl : null
  );

  const thumbnailSrc = clip.thumbnail_path
    ? `${SCL_API}${clip.thumbnail_path}`
    : serverThumbnail || autoThumbnail;

  return (
    <div
      className="group rounded-2xl border border-white/5 bg-white/3 overflow-hidden hover:border-purple-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.08)] hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Thumbnail / Preview */}
      <div
        className="aspect-video bg-zinc-900 relative flex items-center justify-center overflow-hidden cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => clip.status === 'ready' && onStream(clip.id)}
      >
        {/* Thumbnail (estática ou gerada automaticamente) */}
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered && previewUrl ? 'opacity-0' : 'opacity-100'}`}
          />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isHovered && previewUrl ? 'opacity-0' : 'opacity-100'}`}>
            <Film className="w-10 h-10 text-zinc-700" />
          </div>
        )}

        {/* Video Preview */}
        {previewUrl && (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        {/* Hover overlay gradient */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />

        {/* Play icon centered */}
        {clip.status === 'ready' && (
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Preview badge */}
        {isHovered && previewUrl && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold tracking-widest uppercase border border-white/10">
            Prévia 5s
          </div>
        )}

      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${getStatusColor(clip.status)}`}>
              {getStatusLabel(clip.status)}
            </span>
            {(clip as any).camera_label && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md text-sky-400 bg-sky-500/10 border border-sky-500/20">
                {(clip as any).camera_label || clip.camera_id}
              </span>
            )}
          </div>
          {clip.event_label && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md text-amber-400 bg-amber-500/10 border border-amber-500/20">
              {clip.event_label}
            </span>
          )}
        </div>

        {clip.athlete_name && (
          <p className="text-sm text-white font-semibold truncate mb-0.5">{clip.athlete_name}</p>
        )}
        <p className="text-sm text-zinc-400 font-medium">{(clip as any).reference_ts ? new Date((clip as any).reference_ts * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : formatDate(clip.created_at)}</p>

        {clip.resolution && (
          <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{clip.resolution}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {clip.status === 'ready' && (
            <>
              <button
                onClick={() => onStream(clip.id)}
                className="flex-1 py-2 rounded-xl bg-purple-500/10 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1.5 border border-purple-500/10 hover:border-purple-500/20"
              >
                <Eye className="w-3.5 h-3.5" />
                Assistir
              </button>
              <button
                onClick={() => onDownload(clip.id)}
                className="flex-1 py-2 rounded-xl bg-white/3 text-zinc-400 text-xs font-bold hover:bg-white/6 transition-colors flex items-center justify-center gap-1.5 border border-white/5 hover:border-white/10"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <Download className="w-3.5 h-3.5" />
                Baixar
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(clip.id)}
              className="py-2 px-3 rounded-xl bg-red-500/5 text-red-500/60 text-xs font-bold hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center justify-center border border-red-500/10 hover:border-red-500/20"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Recording Card ────────────────────────────────────────────────────────
function RecordingCard({
  rec,
  token,
  getStatusColor,
  getStatusLabel,
  formatDuration,
  formatDate,
  onError,
}: {
  rec: RecordingInfo;
  token: string | null;
  getStatusColor: (s: string) => string;
  getStatusLabel: (s: string) => string;
  formatDuration: (s: number) => string;
  formatDate: (s?: string) => string;
  onError: (msg: string) => void;
}) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Busca a URL de stream para gerar thumbnail automaticamente
  useEffect(() => {
    if (!token || rec.thumbnail_path || rec.status !== 'ready') return;
    sclFetch<{ url: string }>(`/api/athlete/recordings/${rec.id}/stream`, token)
      .then(d => setStreamUrl(d.url))
      .catch(() => {});
  }, [rec.id, rec.status, rec.thumbnail_path, token]);

  const autoThumbnail = useVideoThumbnail(streamUrl);

  const thumbnailSrc = rec.thumbnail_path
    ? `${SCL_API}${rec.thumbnail_path}`
    : autoThumbnail;

  const handleStream = async () => {
    if (!token) return;
    try {
      const data = await sclFetch<{ url: string }>(`/api/athlete/recordings/${rec.id}/stream`, token);
      window.open(data.url, '_blank');
    } catch (err: any) {
      onError(err.message || 'Erro ao abrir gravação');
    }
  };

  const handleDownload = async () => {
    if (!token) return;
    try {
      const data = await sclFetch<{ url: string; filename: string }>(`/api/athlete/recordings/${rec.id}/download`, token);
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.filename;
      a.click();
    } catch (err: any) {
      onError(err.message || 'Erro ao baixar gravação');
    }
  };

  return (
    <div
      className="rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/20 transition-all group"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-stretch">
        {/* Thumbnail */}
        <div className="w-36 sm:w-44 flex-shrink-0 bg-zinc-900 relative overflow-hidden">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center min-h-[80px]">
              <Video className="w-8 h-8 text-zinc-700" />
            </div>
          )}
          {rec.status === 'recording' && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/90 text-white text-[10px] font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              REC
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${getStatusColor(rec.status)}`}>
                {getStatusLabel(rec.status)}
              </span>
              <span className="text-[10px] text-zinc-600 font-medium">
                {rec.cameras.length} câmera{rec.cameras.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-white font-semibold truncate">
              Gravação de {formatDate(rec.started_at)}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-600 flex-wrap">
              {rec.total_duration_seconds && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(rec.total_duration_seconds)}
                </span>
              )}
              {rec.ended_at && (
                <span>Término: {formatDate(rec.ended_at)}</span>
              )}
              {rec.cameras.length > 0 && (
                <span className="text-zinc-700">{rec.cameras.slice(0, 2).join(', ')}{rec.cameras.length > 2 ? ` +${rec.cameras.length - 2}` : ''}</span>
              )}
            </div>
          </div>

          {rec.status === 'ready' && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleStream}
                className="py-1.5 px-3 rounded-xl bg-purple-500/10 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center gap-1.5 border border-purple-500/10"
              >
                <Play className="w-3 h-3" />
                Assistir
              </button>
              <button
                onClick={handleDownload}
                className="py-1.5 px-3 rounded-xl text-zinc-400 text-xs font-bold hover:text-white transition-colors flex items-center gap-1.5 border border-white/5 hover:border-white/10"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <Download className="w-3 h-3" />
                Baixar
              </button>
            </div>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center pr-4 text-zinc-700 group-hover:text-zinc-500 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Live Session Player (double-buffered chunk playback) ──────────────────
function LiveSessionPlayer({ sessionId, token }: { sessionId: string; token: string }) {
  const [cameras, setCameras] = useState<string[]>([]);
  const [bufferingMap, setBufferingMap] = useState<Record<string, boolean>>({});
  const videoRefsA = useRef<Record<string, HTMLVideoElement | null>>({});
  const videoRefsB = useRef<Record<string, HTMLVideoElement | null>>({});

  // Detect active cameras
  useEffect(() => {
    let active = true;
    const detect = async () => {
      const found: string[] = [];
      for (const camId of ['cam_a', 'cam_b']) {
        try {
          const resp = await fetch(`${SCL_API}/api/streams/${sessionId}/live-info?camera_id=${camId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.mode !== 'none') found.push(camId);
          }
        } catch { /* ignore */ }
      }
      if (active && found.length > 0) {
        setCameras(prev => {
          if (prev.length === found.length && prev.every((c, i) => c === found[i])) return prev;
          return found;
        });
      }
    };
    detect();
    const iv = setInterval(detect, 15000);
    return () => { active = false; clearInterval(iv); };
  }, [sessionId, token]);

  // Start fetch + playback loops for each detected camera
  useEffect(() => {
    if (cameras.length === 0) return;
    let running = true;
    const blobUrls: string[] = [];
    const queues: Record<string, { url: string; ts: number }[]> = {};
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    cameras.forEach(camId => {
      queues[camId] = [];
      setBufferingMap(prev => ({ ...prev, [camId]: true }));

      // ── Chunk fetch loop ──
      (async () => {
        let after = 1; // start with 1 → server returns oldest available chunk
        let filling = true;
        while (running) {
          try {
            if ((queues[camId] || []).length >= 6) { await sleep(3000); continue; }
            const resp = await fetch(
              `${SCL_API}/api/streams/${sessionId}/latest-chunk?camera_id=${camId}&after=${after}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (resp.status === 200) {
              const ts = parseInt(resp.headers.get('X-Chunk-Timestamp') || '0');
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              blobUrls.push(url);
              queues[camId].push({ url, ts });
              after = ts;
              if (filling && queues[camId].length >= 2) {
                filling = false;
                setBufferingMap(prev => ({ ...prev, [camId]: false }));
              }
              if (filling) continue; // fetch next immediately during initial fill
            } else if (filling) {
              await sleep(1000);
              continue;
            }
          } catch { /* ignore */ }
          await sleep(filling ? 500 : 3000);
        }
      })();

      // ── Chunk playback loop (double-buffered) ──
      (async () => {
        let useA = true;
        // Wait for initial buffer
        while (running && (queues[camId] || []).length < 2) await sleep(300);

        while (running) {
          const q = queues[camId];
          if (!q || q.length === 0) {
            setBufferingMap(prev => ({ ...prev, [camId]: true }));
            await sleep(300);
            continue;
          }
          setBufferingMap(prev => ({ ...prev, [camId]: false }));

          const chunk = q.shift()!;
          const el = useA ? videoRefsA.current[camId] : videoRefsB.current[camId];
          const other = useA ? videoRefsB.current[camId] : videoRefsA.current[camId];
          if (!el) { URL.revokeObjectURL(chunk.url); await sleep(200); continue; }

          el.src = chunk.url;

          // Wait for canplay
          await new Promise<void>(resolve => {
            let resolved = false;
            const done = () => { if (resolved) return; resolved = true; resolve(); };
            el.addEventListener('canplay', done, { once: true });
            el.addEventListener('error', done, { once: true });
            el.load();
            setTimeout(done, 5000);
          });

          // Show current, hide other
          el.style.opacity = '1';
          el.style.zIndex = '2';
          if (other) { other.style.opacity = '0'; other.style.zIndex = '1'; }

          try { await el.play(); } catch { /* ignore */ }

          // Wait for ended
          await new Promise<void>(resolve => {
            let resolved = false;
            const done = () => { if (resolved) return; resolved = true; resolve(); };
            el.addEventListener('ended', done, { once: true });
            el.addEventListener('error', done, { once: true });
            setTimeout(done, 15000);
          });

          URL.revokeObjectURL(chunk.url);
          useA = !useA;
        }
      })();
    });

    return () => {
      running = false;
      blobUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [cameras, sessionId, token]);

  // No cameras detected yet → loading state
  if (cameras.length === 0) {
    return (
      <div className="aspect-video bg-zinc-900 relative flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
        <p className="absolute bottom-3 text-xs text-zinc-600">Conectando câmeras...</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black relative overflow-hidden flex">
      {cameras.map(camId => (
        <div key={camId} className="relative h-full" style={{ width: cameras.length > 1 ? '50%' : '100%' }}>
          <video
            ref={el => { videoRefsA.current[camId] = el; }}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0, zIndex: 1 }}
          />
          <video
            ref={el => { videoRefsB.current[camId] = el; }}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0, zIndex: 1 }}
          />
          {bufferingMap[camId] && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
              <p className="text-xs text-zinc-400 mt-2">Carregando...</p>
            </div>
          )}
        </div>
      ))}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-500/30">
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        AO VIVO
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function LancesPage() {
  const navigate = useNavigate();
  const { user, tenants, isSuperAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('clips');
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchAthlete, setSearchAthlete] = useState('');
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerClipId, setPlayerClipId] = useState<string | null>(null);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const token = localStorage.getItem('auth_token');
  const currentTenant = tenants.find(t => t.system?.slug === 'lances') || null;

  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => { loadData(); }, [activeTab]);
  useEffect(() => { setPage(1); }, [searchAthlete]);

  const fetchAllPages = async <T,>(endpoint: string, key: string, tkn: string): Promise<T[]> => {
    let all: T[] = [];
    let pg = 1;
    const limit = 200;
    while (true) {
      const data = await sclFetch<Record<string, any>>(`${endpoint}?page=${pg}&limit=${limit}`, tkn);
      const items: T[] = data[key] || [];
      all = [...all, ...items];
      if (items.length < limit || all.length >= (data.total || 0)) break;
      pg++;
    }
    return all;
  };

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'clips') {
        const all = await fetchAllPages<ClipInfo>('/api/athlete/clips', 'clips', token);
        setClips(all);
      } else if (activeTab === 'recordings') {
        const all = await fetchAllPages<RecordingInfo>('/api/athlete/recordings', 'recordings', token);
        setRecordings(all);
      } else if (activeTab === 'live') {
        try {
          const data = await sclFetch<SessionInfo[]>('/api/athlete/sessions', token);
          setSessions(Array.isArray(data) ? data : []);
        } catch { setSessions([]); }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtro por nome do jogador: busca em athlete_name + event_label
  // (alguns lances guardam o nome em event_label, ex.: "DESTAQUE - GIBSON BRUNO")
  const filteredClips = useMemo(() => {
    const q = searchAthlete.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(c => {
      const fields = [c.athlete_name, c.event_label, c.event_type].filter(Boolean) as string[];
      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [clips, searchAthlete]);

  // Client-side pagination
  // Agrupar clips por lance_id (ou ±30s de created_at como fallback)
  const groupedClips = useMemo(() => {
    const groups: { key: string; time: string; refTs?: number; eventLabel?: string; clips: ClipInfo[] }[] = [];
    const sorted = [...filteredClips].sort((a, b) => {
      const aTs = (a as any).reference_ts || new Date(a.created_at).getTime() / 1000;
      const bTs = (b as any).reference_ts || new Date(b.created_at).getTime() / 1000;
      return bTs - aTs;
    });
    for (const clip of sorted) {
      const lanceId = (clip as any).lance_id;
      if (lanceId) {
        const existing = groups.find(g => g.key === lanceId);
        if (existing) { existing.clips.push(clip); continue; }
        groups.push({ key: lanceId, time: clip.created_at, refTs: (clip as any).reference_ts, eventLabel: clip.event_label || undefined, clips: [clip] });
      } else {
        const clipTime = new Date(clip.created_at).getTime();
        const existing = groups.find(g => !g.key.startsWith('clip_') && Math.abs(new Date(g.time).getTime() - clipTime) < 30000);
        if (existing) { existing.clips.push(clip); }
        else { groups.push({ key: `clip_${clip.id}`, time: clip.created_at, clips: [clip] }); }
      }
    }
    return groups;
  }, [filteredClips]);
  const paginatedGroups = useMemo(() => groupedClips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [groupedClips, page]);
  const paginatedClips = useMemo(() => filteredClips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredClips, page]);
  const paginatedRecordings = useMemo(() => recordings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [recordings, page]);
  const totalClipPages = Math.max(1, Math.ceil(groupedClips.length / PAGE_SIZE));
  const totalRecordingPages = Math.max(1, Math.ceil(recordings.length / PAGE_SIZE));

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    // O servidor salva em -04 mas sem timezone no string. Adicionar pra não interpretar como UTC.
    const d = dateStr.includes('T') || dateStr.includes('+') || dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + '-04:00';
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': case 'synced': return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
      case 'pending': case 'extracting': case 'encoding': case 'processing': return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
      case 'failed': return 'text-red-400 bg-red-500/10 border border-red-500/20';
      case 'recording': return 'text-red-400 bg-red-500/10 border border-red-500/20 animate-pulse';
      default: return 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ready: 'Pronto', synced: 'Sincronizado', pending: 'Pendente',
      extracting: 'Extraindo', encoding: 'Codificando', processing: 'Processando',
      failed: 'Erro', recording: 'Gravando', scheduled: 'Agendado', deleted: 'Removido',
    };
    return labels[status] || status;
  };

  const handleStreamClip = async (clipId: string) => {
    if (!token) return;
    try {
      const data = await sclFetch<{ url: string }>(`/api/athlete/clips/${clipId}/stream`, token);
      setPlayerUrl(data.url);
      setPlayerClipId(clipId);
      setPlayerRotation(0);
    } catch (err: any) { setError(err.message); }
  };

  const handleRotateOnServer = async (direction: 'cw' | 'ccw' = 'cw') => {
    if (!token || !playerClipId || isRotating) return;
    setIsRotating(true);
    try {
      const resp = await fetch(`${SCL_API}/api/athlete/clips/${playerClipId}/rotate?direction=${direction}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || 'Erro ao rotacionar');
      }
      // Reload the video with cache-bust
      const data = await sclFetch<{ url: string }>(`/api/athlete/clips/${playerClipId}/stream`, token);
      setPlayerUrl(data.url + (data.url.includes('?') ? '&' : '?') + `_t=${Date.now()}`);
      setPlayerRotation(0);
    } catch (err: any) {
      setError(err.message || 'Erro ao rotacionar');
    } finally {
      setIsRotating(false);
    }
  };

  const handleDownloadClip = async (clipId: string) => {
    if (!token) return;
    try {
      const data = await sclFetch<{ url: string; filename: string }>(`/api/athlete/clips/${clipId}/download`, token);
      const a = document.createElement('a');
      a.href = data.url; a.download = data.filename; a.click();
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!token) return;
    if (!window.confirm('Excluir este lance permanentemente?')) return;
    try {
      const resp = await fetch(`${SCL_API}/api/athlete/clips/${clipId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || 'Erro ao excluir');
      }
      setClips(prev => prev.filter(c => c.id !== clipId));
    } catch (err: any) { setError(err.message || 'Erro ao excluir lance'); }
  };

  const tabs: { key: TabType; label: string; icon: typeof Video; count?: number }[] = [
    { key: 'clips', label: 'Meus Lances', icon: Film, count: clips.length || undefined },
    { key: 'recordings', label: 'Gravações', icon: Video, count: recordings.length || undefined },
    { key: 'live', label: 'Ao Vivo', icon: Wifi, count: sessions.length || undefined },
    { key: 'editor', label: 'Editor', icon: Film },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 50%, #0a0a0f 100%)' }}>
      <div className="fixed inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
        backgroundSize: '150px',
      }} />

      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center top, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />

      <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(10,10,15,0.85)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                <Video className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">Meus Lances</h1>
                <p className="text-[11px] text-zinc-600">Vídeos e transmissões</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <SwitchSystemMenu currentTenant={currentTenant} />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-4">
        <div className="flex gap-1 p-1 rounded-2xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  isActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 2px 16px rgba(124,58,237,0.3)' } : {}}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-500'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-500/20 text-red-400 text-sm flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.05)' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-purple-500/20" style={{ background: 'rgba(124,58,237,0.08)' }}>
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
            <p className="text-zinc-600 text-sm">Carregando...</p>
          </div>
        ) : (
          <>
            {activeTab === 'clips' && (
              clips.length === 0 ? (
                <EmptyState icon={Film} title="Nenhum lance encontrado" description="Seus lances aparecerão aqui quando forem capturados durante os jogos" />
              ) : (
                <div>
                  <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/5 px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={searchAthlete}
                      onChange={e => setSearchAthlete(e.target.value)}
                      placeholder="Filtrar por nome do jogador..."
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
                    />
                    {searchAthlete && (
                      <button
                        onClick={() => setSearchAthlete('')}
                        className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                        title="Limpar filtro"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {filteredClips.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="Nenhum jogador encontrado"
                      description={`Nenhum lance corresponde a "${searchAthlete}". Tente outro nome ou limpe o filtro.`}
                    />
                  ) : (
                  <>
                  {totalClipPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        Anterior
                      </button>
                      <span className="text-xs text-zinc-500 font-mono">
                        {page} / {totalClipPages}
                      </span>
                      <button
                        disabled={page >= totalClipPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        Próximo
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-zinc-600 mb-4 font-medium uppercase tracking-widest">
                    {groupedClips.length} {groupedClips.length === 1 ? 'lance' : 'lances'} ({filteredClips.length} clips) — passe o mouse para ver a prévia
                  </p>
                  <div className="space-y-6">
                    {groupedClips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(group => (
                      <div key={group.key}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          <span className="text-xs font-bold text-zinc-400 uppercase">
                            {group.eventLabel || 'Lance'} — {group.refTs ? new Date(group.refTs * 1000).toLocaleTimeString('pt-BR') : formatDate(group.time)}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {group.clips.length} câmera{group.clips.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {group.clips.map(clip => (
                            <ClipCard
                              key={clip.id}
                              clip={clip}
                              token={token}
                              onStream={handleStreamClip}
                              onDownload={handleDownloadClip}
                              onDelete={handleDeleteClip}
                              canDelete={isSuperAdmin}
                              getStatusColor={getStatusColor}
                              getStatusLabel={getStatusLabel}
                              formatDate={formatDate}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalClipPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        Anterior
                      </button>
                      <span className="text-xs text-zinc-500 font-mono">
                        {page} / {totalClipPages}
                      </span>
                      <button
                        disabled={page >= totalClipPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        Próximo
                      </button>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )
            )}

            {activeTab === 'recordings' && (
              recordings.length === 0 ? (
                <EmptyState icon={Video} title="Nenhuma gravação encontrada" description="Gravações completas dos seus jogos aparecerão aqui" />
              ) : (
                <div>
                  <div className="space-y-3">
                    {paginatedRecordings.map(rec => (
                      <RecordingCard
                        key={rec.id}
                        rec={rec}
                        token={token}
                        getStatusColor={getStatusColor}
                        getStatusLabel={getStatusLabel}
                        formatDuration={formatDuration}
                        formatDate={formatDate}
                        onError={setError}
                      />
                    ))}
                  </div>
                  {totalRecordingPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        Anterior
                      </button>
                      <span className="text-xs text-zinc-500 font-mono">
                        {page} / {totalRecordingPages}
                      </span>
                      <button
                        disabled={page >= totalRecordingPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10 hover:border-purple-500/30 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        Próximo
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {activeTab === 'editor' && (
              sessions.length === 0 ? (
                <EmptyState icon={Film} title="Nenhuma sessão ativa" description="Inicie uma sessão de gravação para usar o editor de lances" />
              ) : (
                <div className="space-y-4">
                  {sessions.map(session => (
                    <div key={session.id}>
                      <h3 className="text-sm font-bold text-zinc-400 mb-2">
                        {(session as any).field_name || 'Sessão'} — {session.id.slice(0, 8)}
                      </h3>
                      {token && <DvrTimeline sessionId={session.id} token={token} />}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'live' && (
              sessions.length === 0 ? (
                <EmptyState icon={Wifi} title="Nenhuma transmissão ao vivo" description="Quando uma câmera estiver ativa na sua quadra durante seu horário, a transmissão aparecerá aqui" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sessions.map(session => (
                    <div key={session.id} className="rounded-2xl border border-white/5 overflow-hidden hover:border-red-500/20 transition-all" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      {token && <LiveSessionPlayer sessionId={session.id} token={token} />}
                      <div className="p-4">
                        <h3 className="font-bold text-white text-sm">{(session as any).field_name || session.device_name || 'Sessão ao vivo'}</h3>
                        <p className="text-xs text-zinc-600 mt-1">
                          {((session as any).cameras_connected ?? 0)} câmera{((session as any).cameras_connected ?? 0) !== 1 ? 's' : ''} · Desde {formatDate(session.started_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Video Player Modal */}
      {playerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/90 backdrop-blur-sm overflow-y-auto py-8"
          onClick={() => { setPlayerUrl(null); setPlayerClipId(null); setPlayerRotation(0); }}
        >
          <div
            className="relative w-full max-w-4xl mx-4 my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Controls bar */}
            <div className="flex items-center justify-between mb-3 sticky top-0 z-10 bg-black/80 backdrop-blur-sm rounded-xl px-2 py-2">
              <div className="flex items-center gap-2">
                {/* Preview rotation (visual only) */}
                <button
                  onClick={() => setPlayerRotation(r => (r + 90) % 360)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white transition-all border border-white/10 hover:border-purple-500/30"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  title="Preview: girar visualização 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  {playerRotation > 0 ? `${playerRotation}°` : 'Girar preview'}
                </button>

                {/* Server rotation (permanent) — esquerda */}
                <button
                  onClick={() => handleRotateOnServer('ccw')}
                  disabled={isRotating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-300 hover:text-white transition-all border border-purple-500/20 hover:border-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(124,58,237,0.1)' }}
                  title="Rotacionar o arquivo permanentemente (90° anti-horário)"
                >
                  {isRotating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  {isRotating ? '...' : 'Esquerda'}
                </button>

                {/* Server rotation (permanent) — direita */}
                <button
                  onClick={() => handleRotateOnServer('cw')}
                  disabled={isRotating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-300 hover:text-white transition-all border border-purple-500/20 hover:border-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(124,58,237,0.1)' }}
                  title="Rotacionar o arquivo permanentemente (90° horário)"
                >
                  {isRotating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCw className="w-4 h-4" />
                  )}
                  {isRotating ? '...' : 'Direita'}
                </button>
              </div>
              <button
                onClick={() => { setPlayerUrl(null); setPlayerClipId(null); setPlayerRotation(0); }}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video */}
            <div className="rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center"
              style={{ aspectRatio: playerRotation % 180 === 0 ? '16/9' : '9/16', maxHeight: '80vh' }}
            >
              <video
                key={playerUrl}
                src={playerUrl}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full"
                style={{
                  transform: `rotate(${playerRotation}deg)`,
                  transition: 'transform 0.3s ease',
                  maxWidth: playerRotation % 180 !== 0 ? '56.25%' : '100%',
                  maxHeight: playerRotation % 180 !== 0 ? '177.78%' : '100%',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Video; title: string; description: string }) {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <Icon className="w-7 h-7 text-zinc-700" />
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-zinc-600 text-sm max-w-sm mx-auto leading-relaxed">{description}</p>
    </div>
  );
}