import { X } from 'lucide-react';
import { useHints } from '../hooks/useHints';

interface HintTooltipProps {
  id: string;
  text: string;
  position?: 'top' | 'bottom';
}

export default function HintTooltip({ id, text, position = 'bottom' }: HintTooltipProps) {
  const { shouldShow, dismiss } = useHints();

  if (!shouldShow(id)) return null;

  return (
    <div
      className="animate-fade-in relative z-20"
      style={{ marginTop: position === 'bottom' ? 8 : 0, marginBottom: position === 'top' ? 8 : 0 }}
    >
      <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] backdrop-blur-sm">
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>

        <p className="text-xs text-amber-200/80 font-medium leading-snug">{text}</p>

        <button
          onClick={(e) => { e.stopPropagation(); dismiss(id); }}
          className="shrink-0 p-0.5 rounded-md hover:bg-amber-500/20 text-amber-400/60 hover:text-amber-300 transition-colors"
          title="Entendi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
