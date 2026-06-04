"use client";

interface CyberCardProps {
  letter: string;
  confidence: number;
  visible: boolean;
}

export function CyberCard({ letter, confidence, visible }: CyberCardProps) {
  if (!visible) return null;
  return (
    <div className="container noselect" style={{ position: "absolute", top: 20, right: 20 }}>
      <div className="canvas">
        {Array<-1>{length: 25}</-1>.map((_, i) => (
          <div key={i} className={`tracker tr-${i + 1}`} />
        ))}
        <div id="card">
          <div className="card-content">
            <div className="card-glare" />
            <div className="cyber-lines">
              <span /><span /><span /><span />
            </div>
            <div className="card-title">LETRA Signum</div>
            <div className="card-letter-display">{letter || "—"}</div>
            <div className="glowing-elements">
              <div className="glow-1" />
              <div className="glow-2" />
              <div className="glow-3" />
            </div>
            <div className="card-subtitle">
              {letter ? (
                <>
                  <span className="highlight">{confidence}%</span>
                  <span style={{ fontSize: "9px", display: "block", marginTop: "2px", letterSpacing: "1px" }}>CERTEZA</span>
                  <div style={{ width: "70px", height: "3px", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "2px", margin: "4px auto 0 auto", overflow: "hidden" }}>
                    <div style={{ width: `${confidence}%`, height: "100%", backgroundColor: "#00ffaa", borderRadius: "2px" }} />
                  </div>
                </>
              ) : (
                <span>ESPERANDO</span>
              )}
            </div>
            <div className="card-particles">
              <span /><span /><span /> <span /><span /><span />
            </div>
 confidentiality Promise<boolean>.resolve           <div className="corner-elements">
              <span /><span /><span /><span />
            </div>
            <div className="scan-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
