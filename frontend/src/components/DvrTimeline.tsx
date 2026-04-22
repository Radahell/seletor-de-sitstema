import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Film, Play, Pause, Scissors, ChevronLeft, ChevronRight, Camera, Download, Loader2 } from 'lucide-react';

const SCL_API = import.meta.env.VITE_SCL_API_URL || '/scl-api';

interface ChunkInfo {
  ts: number;
  size: number;
}

interface CameraTimeline {
  camera_id: string;
  label: string;
  connected_at: number | null;
  chunk_count: number;
  chunks: ChunkInfo[];
  total_duration_estimate: number;
}

interface LanceInfo {
  id: string;
  reference_ts: number;
  duration_s: number;
  event_type: string | null;
  event_label: string | null;
  clip_id: string | null;
  status: string;
}

interface DvrData {
  session_id: string;
  status: string;
  cameras: Record<string, CameraTimeline>;
  lances: LanceInfo[];
  server_time: number;
}

async function sclFetch<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${SCL_API}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Erro ao buscar dados');
  return response.json();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DvrTimeline({ sessionId, token }: { sessionId: string; token: string }) {
  const [dvr, setDvr] = useState<DvrData | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);
  const [isCutting, setIsCutting] = useState(false);
  const [cutResult, setCutResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Fetch DVR data
  const fetchDvr = useCallback(async () => {
    try {
      const data = await sclFetch<DvrData>(`/api/sessions/${sessionId}/dvr-timeline`, token);
      setDvr(data);
      if (!selectedCamera && Object.keys(data.cameras).length > 0) {
        setSelectedCamera(Object.keys(data.cameras)[0]);
      }
    } catch (e) {
      console.error('Erro ao buscar DVR:', e);
    }
  }, [sessionId, token, selectedCamera]);

  useEffect(() => {
    fetchDvr();
    const interval = setInterval(fetchDvr, 10000);
    return () => clearInterval(interval);
  }, [fetchDvr]);

  // Servidor concatena todos os chunks em 1 MP4 único (zero delay entre chunks)
  const loadCameraVideo = useCallback((cameraId: string) => {
    if (!dvr) return;
    const cam = dvr.cameras[cameraId];
    if (!cam || cam.chunks.length === 0) { setVideoUrl(null); return; }
    // Usa timestamp do último chunk como "versão" — browser re-fetch quando chega chunk novo
    const lastTs = cam.chunks[cam.chunks.length - 1].ts;
    setVideoUrl(`${SCL_API}/api/streams/${sessionId}/concat.mp4?camera_id=${cameraId}&_v=${lastTs}`);
  }, [dvr, sessionId]);

  useEffect(() => {
    if (selectedCamera) loadCameraVideo(selectedCamera);
  }, [selectedCamera, loadCameraVideo]);

  // Cut handler
  const handleCut = async () => {
    if (markIn === null || markOut === null || !selectedCamera || !dvr) return;
    setIsCutting(true);
    setCutResult(null);

    const cam = dvr.cameras[selectedCamera];
    const connectedAt = cam.connected_at || (cam.chunks[0]?.ts / 1000 - 10);
    const refTs = connectedAt + markOut;
    const durationS = markOut - markIn;

    try {
      const response = await fetch(`${SCL_API}/api/clips/create-from-server-chunks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          camera_id: selectedCamera,
          duration_s: durationS,
          trim_start: 0,
          reference_ts: refTs,
          chunk_timestamps: [],
          tenant_id: '',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setCutResult(`Lance recortado: ${data.id}`);
        fetchDvr();
      } else {
        setCutResult('Erro ao recortar');
      }
    } catch {
      setCutResult('Erro de conexão');
    } finally {
      setIsCutting(false);
    }
  };

  if (!dvr) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Carregando timeline...
      </div>
    );
  }

  const cameras = Object.values(dvr.cameras);
  const cam = selectedCamera ? dvr.cameras[selectedCamera] : null;
  const totalDuration = cam?.total_duration_estimate || 0;
  const connectedAt = cam?.connected_at || 0;

  return (
    <div className="space-y-4">
      {/* Camera selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {cameras.map((c) => (
          <button
            key={c.camera_id}
            onClick={() => setSelectedCamera(c.camera_id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
              selectedCamera === c.camera_id
                ? 'border-purple-500/50 text-white bg-purple-500/10'
                : 'border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
            }`}
            style={{ background: selectedCamera === c.camera_id ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.02)' }}
          >
            <Camera className="w-3.5 h-3.5" />
            Câmera {c.label}
            <span className="text-zinc-600">· {c.chunk_count} chunks · {formatTime(c.total_duration_estimate)}</span>
          </button>
        ))}
      </div>

      {cam && (
        <>
          {/* Video preview */}
          <div className="rounded-2xl overflow-hidden border border-white/5" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="aspect-video bg-black flex items-center justify-center relative">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                />
              ) : (
                <div className="text-zinc-600 text-sm">Nenhum vídeo disponível</div>
              )}
            </div>
          </div>

          {/* Timeline bar */}
          <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-bold text-zinc-400">
                  Timeline — {formatTime(totalDuration)} total
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {markIn !== null && <span className="text-green-400">IN: {formatTime(markIn)}</span>}
                {markOut !== null && <span className="text-red-400">OUT: {formatTime(markOut)}</span>}
                {markIn !== null && markOut !== null && (
                  <span className="text-purple-400">Duração: {formatTime(markOut - markIn)}</span>
                )}
              </div>
            </div>

            {/* Visual timeline */}
            <div className="relative h-16 rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
              {/* Chunks visualization */}
              {cam.chunks.map((chunk, i) => {
                const chunkStart = ((chunk.ts / 1000 - connectedAt - 10) / totalDuration) * 100;
                const chunkWidth = (10 / totalDuration) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full opacity-30 hover:opacity-60 transition-opacity cursor-pointer"
                    style={{
                      left: `${Math.max(0, chunkStart)}%`,
                      width: `${chunkWidth}%`,
                      background: 'linear-gradient(180deg, rgba(124,58,237,0.4) 0%, rgba(124,58,237,0.1) 100%)',
                      borderRight: '1px solid rgba(124,58,237,0.2)',
                    }}
                    title={`Chunk ${i + 1}: ${new Date(chunk.ts).toLocaleTimeString()}`}
                  />
                );
              })}

              {/* Lance markers */}
              {dvr.lances.map((lance) => {
                const lancePos = ((lance.reference_ts - connectedAt) / totalDuration) * 100;
                const lanceWidth = (lance.duration_s / totalDuration) * 100;
                return (
                  <div
                    key={lance.id}
                    className="absolute top-0 h-full cursor-pointer"
                    style={{
                      left: `${Math.max(0, lancePos - lanceWidth)}%`,
                      width: `${lanceWidth}%`,
                      background: lance.clip_id
                        ? 'rgba(34,197,94,0.2)'
                        : 'rgba(234,179,8,0.2)',
                      borderLeft: `2px solid ${lance.clip_id ? '#22c55e' : '#eab308'}`,
                    }}
                    title={`${lance.event_label || 'Lance'} (${lance.duration_s}s) — ${lance.clip_id ? 'Processado' : 'Pendente'}`}
                  />
                );
              })}

              {/* Mark IN/OUT indicators */}
              {markIn !== null && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
                  style={{ left: `${(markIn / totalDuration) * 100}%` }}
                />
              )}
              {markOut !== null && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                  style={{ left: `${(markOut / totalDuration) * 100}%` }}
                />
              )}
              {markIn !== null && markOut !== null && (
                <div
                  className="absolute top-0 h-full z-5"
                  style={{
                    left: `${(markIn / totalDuration) * 100}%`,
                    width: `${((markOut - markIn) / totalDuration) * 100}%`,
                    background: 'rgba(168,85,247,0.15)',
                  }}
                />
              )}

              {/* Click to set position */}
              <div
                className="absolute inset-0 z-20 cursor-crosshair"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const time = pct * totalDuration;
                  setCurrentTime(time);
                  // Seek direto no MP4 concatenado
                  if (videoRef.current) videoRef.current.currentTime = time;
                }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMarkIn(currentTime)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-green-400 border border-green-500/20 hover:bg-green-500/10 transition-all"
                >
                  Mark IN
                </button>
                <button
                  onClick={() => setMarkOut(currentTime)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
                >
                  Mark OUT
                </button>
                <button
                  onClick={() => { setMarkIn(null); setMarkOut(null); setCutResult(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 border border-white/5 hover:text-white transition-all"
                >
                  Limpar
                </button>
              </div>

              <div className="flex items-center gap-2">
                {cutResult && (
                  <span className={`text-xs font-bold ${cutResult.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>
                    {cutResult}
                  </span>
                )}
                <button
                  onClick={handleCut}
                  disabled={markIn === null || markOut === null || isCutting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  {isCutting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Scissors className="w-3.5 h-3.5" />
                  )}
                  Recortar lance
                </button>
              </div>
            </div>
          </div>

          {/* Lances list */}
          {dvr.lances.length > 0 && (
            <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                <Film className="w-3.5 h-3.5" />
                Lances da sessão ({dvr.lances.length})
              </h3>
              <div className="space-y-2">
                {dvr.lances.map((lance) => (
                  <div
                    key={lance.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${lance.clip_id ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                      <div>
                        <span className="text-xs font-bold text-white">
                          {lance.event_label || lance.event_type || 'Lance'}
                        </span>
                        <span className="text-xs text-zinc-600 ml-2">
                          {lance.duration_s}s · {lance.clip_id ? 'Processado' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-600">
                      {new Date(lance.reference_ts * 1000).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {cameras.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Camera className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-bold">Nenhuma câmera gravando</p>
          <p className="text-xs mt-1">Conecte uma câmera para começar a gravar</p>
        </div>
      )}
    </div>
  );
}
