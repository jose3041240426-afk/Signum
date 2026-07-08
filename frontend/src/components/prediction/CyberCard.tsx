"use client";

interface CyberCardProps {
  letter: string;
  confidence: number;
  visible: boolean;
}

export function CyberCard({ letter, confidence, visible }: CyberCardProps) {
  if (!visible) return null;
  return (
    <div
      className="absolute right-5 top-5 rounded-2xl border border-blue-300/30 bg-gray-900/90 p-5 text-white backdrop-blur-md"
      style={{ width: 240, height: 142, transition: "opacity 0.3s, transform 0.3s", opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.95)", pointerEvents: "none", overflow: "hidden" }}
    >
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-400/60">SEÑA DETECTADA</div>
      <div 
        className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-3xl font-black text-transparent drop-shadow-lg"
        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={letter || "—"}
      >
        {letter || "—"}
      </div>
      <div className="mt-2 text-center" style={{ visibility: letter ? "visible" : "hidden" }}>
        <span className="text-lg font-bold text-blue-500">{confidence}%</span>
        <span className="ml-1 text-xs text-white/50 uppercase tracking-widest">Certeza</span>
        <div className="mt-1 h-1 w-full rounded-full bg-white/15">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${confidence}%` }} />
        </div>
      </div>
    </div>
  );
}
