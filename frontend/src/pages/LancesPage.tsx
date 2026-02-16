import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Video, Play, Download, Clock, Camera,
  Loader2, RefreshCw, Film, Eye, Smartphone, ExternalLink, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SwitchSystemMenu from '../components/SwitchSystemMenu';

// Em produção o nginx roteia /scl-api/ → scl:6000
// Em dev o Vite proxy faz o mesmo
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

type TabType = 'live' | 'clips' | 'recordings';

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

export default function LancesPage() {
  const navigate = useNavigate();
  const { user, tenants } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('clips');
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('auth_token');

  const currentTenant = tenants.find(t => t.system?.slug === 'lances') || null;

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'clips') {
        const data = await sclFetch<{ clips: ClipInfo[]; total: number }>(
          '/api/athlete/clips?limit=50', token
        );
        setClips(data.clips);
      } else if (activeTab === 'recordings') {
        const data = await sclFetch<{ recordings: RecordingInfo[]; total: number }>(
          '/api/athlete/recordings?limit=50', token
        );
        setRecordings(data.recordings);
      } else if (activeTab === 'live') {
        try {
          const data = await sclFetch<SessionInfo[]>(
            '/api/athlete/sessions', token
          );
          setSessions(Array.isArray(data) ? data : []);
        } catch {
          setSessions([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'synced':
        return 'text-green-400 bg-green-500/10';
      case 'pending':
      case 'extracting':
      case 'encoding':
      case 'processing':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'failed':
        return 'text-red-400 bg-red-500/10';
      case 'recording':
        return 'text-red-400 bg-red-500/10 animate-pulse';
      default:
        return 'text-zinc-400 bg-zinc-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ready: 'Pronto',
      synced: 'Sincronizado',
      pending: 'Pendente',
      extracting: 'Extraindo',
      encoding: 'Codificando',
      processing: 'Processando',
      failed: 'Erro',
      recording: 'Gravando',
      scheduled: 'Agendado',
      deleted: 'Removido',
    };
    return labels[status] || status;
  };

  const handleStreamClip = async (clipId: string) => {
    if (!token) return;
    try {
      const data = await sclFetch<{ url: string }>(
        `/api/athlete/clips/${clipId}/stream`, token
      );
      window.open(data.url, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownloadClip = async (clipId: string) => {
    if (!token) return;
    try {
      const data = await sclFetch<{ url: string; filename: string }>(
        `/api/athlete/clips/${clipId}/download`, token
      );
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.filename;
      a.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!token) return;
    if (!window.confirm('Excluir este lance permanentemente?')) return;
    try {
      const resp = await fetch(`${SCL_API}/api/athlete/clips/${clipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || 'Erro ao excluir');
      }
      setClips(prev => prev.filter(c => c.id !== clipId));
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir lance');
    }
  };

  const tabs: { key: TabType; label: string; icon: typeof Video }[] = [
    { key: 'clips', label: 'Meus Lances', icon: Film },
    { key: 'recordings', label: 'Gravações', icon: Video },
    { key: 'live', label: 'Ao Vivo', icon: Camera },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Meus Lances</h1>
                <p className="text-xs text-zinc-500">Vídeos e transmissões</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <SwitchSystemMenu currentTenant={currentTenant} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-2 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.key
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phone as Camera */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <a
          href={token ? `${SCL_API}/camera/?hub_token=${encodeURIComponent(token)}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 transition-all no-underline ${!token ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Smartphone className="w-6 h-6 text-white" />
          <div className="flex-1 text-left">
            <p className="text-white font-semibold text-sm">Usar Celular como Camera</p>
            <p className="text-emerald-100 text-xs">Toque para iniciar sua camera pessoal</p>
          </div>
          <ExternalLink className="w-4 h-4 text-white/60" />
        </a>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Clips Tab */}
            {activeTab === 'clips' && (
              <div>
                {clips.length === 0 ? (
                  <EmptyState
                    icon={Film}
                    title="Nenhum lance encontrado"
                    description="Seus lances aparecerão aqui quando forem capturados durante os jogos"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clips.map(clip => (
                      <div
                        key={clip.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden group"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video bg-zinc-800 relative flex items-center justify-center">
                          {clip.thumbnail_path ? (
                            <img
                              src={`${SCL_API}${clip.thumbnail_path}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Film className="w-12 h-12 text-zinc-700" />
                          )}

                          {/* Duration badge */}
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-mono">
                            {formatDuration(clip.total_duration_seconds)}
                          </div>

                          {/* Play overlay */}
                          {clip.status === 'ready' && (
                            <button
                              onClick={() => handleStreamClip(clip.id)}
                              className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
                            >
                              <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${getStatusColor(clip.status)}`}>
                              {getStatusLabel(clip.status)}
                            </span>
                            <span className="text-xs text-zinc-500">{clip.mode}</span>
                          </div>

                          <p className="text-sm text-zinc-400">
                            {formatDate(clip.created_at)}
                          </p>

                          {clip.resolution && (
                            <p className="text-xs text-zinc-600 mt-1">{clip.resolution}</p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 mt-3">
                            {clip.status === 'ready' && (
                              <>
                                <button
                                  onClick={() => handleStreamClip(clip.id)}
                                  className="flex-1 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  Assistir
                                </button>
                                <button
                                  onClick={() => handleDownloadClip(clip.id)}
                                  className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  Baixar
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteClip(clip.id)}
                              className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recordings Tab */}
            {activeTab === 'recordings' && (
              <div>
                {recordings.length === 0 ? (
                  <EmptyState
                    icon={Video}
                    title="Nenhuma gravação encontrada"
                    description="Gravações completas dos seus jogos aparecerão aqui"
                  />
                ) : (
                  <div className="space-y-4">
                    {recordings.map(rec => (
                      <div
                        key={rec.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center gap-4"
                      >
                        {/* Thumbnail */}
                        <div className="w-32 h-20 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {rec.thumbnail_path ? (
                            <img
                              src={`${SCL_API}${rec.thumbnail_path}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Video className="w-8 h-8 text-zinc-700" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${getStatusColor(rec.status)}`}>
                              {getStatusLabel(rec.status)}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {rec.cameras.length} câmera{rec.cameras.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <p className="text-sm text-white font-medium truncate">
                            Gravação {formatDate(rec.started_at)}
                          </p>

                          <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                            {rec.total_duration_seconds && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(rec.total_duration_seconds)}
                              </span>
                            )}
                            {rec.ended_at && (
                              <span>Até {formatDate(rec.ended_at)}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {rec.status === 'ready' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors">
                              <Play className="w-5 h-5" />
                            </button>
                            <button className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors">
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Tab */}
            {activeTab === 'live' && (
              <div>
                {sessions.length === 0 ? (
                  <EmptyState
                    icon={Camera}
                    title="Nenhuma transmissão ao vivo"
                    description="Quando uma câmera estiver ativa na sua quadra durante seu horário, a transmissão aparecerá aqui"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sessions.map(session => (
                      <div
                        key={session.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
                      >
                        {/* Live indicator */}
                        <div className="aspect-video bg-zinc-800 relative flex items-center justify-center">
                          <Camera className="w-16 h-16 text-zinc-700" />
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/90 text-white text-xs font-bold">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            AO VIVO
                          </div>
                        </div>

                        <div className="p-4">
                          <h3 className="font-bold text-white">{session.device_name || 'Câmera'}</h3>
                          <p className="text-xs text-zinc-500 mt-1">
                            {session.channel || 'cam_a'}
                            {' · '}
                            Desde {formatDate(session.started_at)}
                          </p>

                          <a
                            href={`${SCL_API}/viewer/?session=${session.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 w-full py-2 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2 no-underline"
                          >
                            <Play className="w-4 h-4" />
                            Assistir
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Video;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-10 h-10 text-zinc-600" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-zinc-500 max-w-md mx-auto">{description}</p>
    </div>
  );
}
