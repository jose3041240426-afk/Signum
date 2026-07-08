"use client";
import { useState } from "react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

interface MenuDrawerProps {
  children?: React.ReactNode;
}

export function MenuDrawer({ children }: MenuDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .hamburger-btn {
          border: none;
          background: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .hamburger-bg {
          border-radius: 16px;
          border: 1px solid #1a1a1a;
          background: rgba(74, 74, 74, 0.39);
          mix-blend-mode: luminosity;
          box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.20);
          backdrop-filter: blur(15px);
          width: 65px;
          height: 65px;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: opacity 0.3s ease;
        }
        .hamburger-bg:hover {
          opacity: 0.85;
        }
        .hamburger-icon {
          width: 32px;
          height: 32px;
          padding: 4px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
        }
        .hamburger-icon span {
          width: 100%;
          height: 0.125rem;
          border-radius: 0.125rem;
          background-color: rgb(0, 122, 255);
          box-shadow: 0 .5px 2px 0 hsla(0, 0%, 0%, .2);
          transition: transform .4s, background-color .4s, opacity .4s;
        }
        .hamburger-icon.open span:nth-child(1) {
          background-color: rgb(255, 59, 48);
          transform: translateY(11px) rotate(-45deg);
        }
        .hamburger-icon.open span:nth-child(2) {
          transform: translate(-50%);
          opacity: 0;
        }
        .hamburger-icon.open span:nth-child(3) {
          background-color: rgb(255, 59, 48);
          transform: translateY(-11px) rotate(45deg);
        }

        .drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0,0,0,0.3);
          backdrop-filter: blur(4px);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        .drawer-overlay.open {
          opacity: 1;
          visibility: visible;
        }

        .drawer-panel {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 9999;
          width: min(90vw, 380px);
          background: rgba(20, 22, 30, 0.95);
          backdrop-filter: blur(24px) saturate(180%);
          border-right: 1px solid rgba(255,255,255,0.1);
          padding: 24px;
          overflow-y: auto;
          transform: translateX(-100%);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          color: #e2e8f0;
        }
        .drawer-panel.open {
          transform: translateX(0);
        }

        .drawer-close {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.08);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          transition: background 0.2s;
        }
        .drawer-close:hover {
          background: rgba(255,255,255,0.15);
        }
      `}} />

      <LiquidGlass
        style={{
          borderRadius: "16px",
          background: "rgba(0, 0, 0, 0.75)",
          width: "65px",
          height: "65px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <button className="hamburger-btn" onClick={() => setIsOpen(true)}>
          <div className={"hamburger-icon" + (isOpen ? " open" : "")}>
            <span />
            <span />
            <span />
          </div>
        </button>
      </LiquidGlass>

      <div
        className={"drawer-overlay" + (isOpen ? " open" : "")}
        onClick={() => setIsOpen(false)}
      />

      <div className={"drawer-panel" + (isOpen ? " open" : "")}>
        <button className="drawer-close" onClick={() => setIsOpen(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </>
  );
}
