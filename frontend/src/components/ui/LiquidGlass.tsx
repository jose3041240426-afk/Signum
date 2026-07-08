"use client";

export function LiquidGlass({
  children,
  style,
  className,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .lq-container {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
        }
        .lq-bend {
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: 24px;
          overflow: hidden;
          backdrop-filter: blur(8px) saturate(180%);
          filter: url(#glass-blur);
        }
        .lq-face {
          position: absolute;
          inset: 0;
          z-index: 1;
          border-radius: 24px;
          box-shadow: 0 4px 4px rgba(0, 0, 0, 0.15), 0 0 12px rgba(0, 0, 0, 0.08);
          pointer-events: none;
        }
        .lq-edge {
          position: absolute;
          inset: 0;
          z-index: 2;
          border-radius: 24px;
          box-shadow: inset 2px 2px 3px 0 rgba(255, 255, 255, 0.35),
            inset -2px -2px 3px 0 rgba(255, 255, 255, 0.35);
          pointer-events: none;
        }
      `}} />
      <div className={"lq-container" + (className ? " " + className : "")} style={style} onClick={onClick}>
        <div className="lq-bend" />
        <div className="lq-face" />
        <div className="lq-edge" />
        <div style={{ position: "relative", zIndex: 3 }}>{children}</div>
      </div>
    </>
  );
}
