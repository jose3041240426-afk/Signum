"use client";

export function NavButton({ children, onClick, icon }: { children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .nav-btn {
          position: relative;
          font-family: inherit;
          font-weight: 500;
          font-size: 18px;
          letter-spacing: 0.05em;
          border-radius: 0.8em;
          cursor: pointer;
          border: none;
          background: linear-gradient(to right, #0f3a73, #2563eb);
          color: ghostwhite;
          overflow: hidden;
          width: 100%;
        }
        .nav-btn svg {
          width: 1.2em;
          height: 1.2em;
          margin-right: 0.5em;
        }
        .nav-btn span {
          position: relative;
          z-index: 10;
          transition: color 0.4s;
          display: inline-flex;
          align-items: center;
          padding: 0.8em 1.2em 0.8em 1.05em;
          justify-content: center;
        }
        .nav-btn::before {
          content: "";
          position: absolute;
          top: 0;
          left: -10%;
          width: 120%;
          height: 100%;
          z-index: 0;
          background: #000;
          transform: skew(30deg);
          transition: transform 0.4s cubic-bezier(0.3, 1, 0.8, 1);
        }
        .nav-btn:hover::before {
          transform: translate3d(100%, 0, 0);
        }
        .nav-btn:active {
          transform: scale(0.95);
        }
      `}} />
      <button className="nav-btn" onClick={onClick}>
        <span>{icon}{children}</span>
      </button>
    </>
  );
}
