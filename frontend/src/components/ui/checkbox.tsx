import React from 'react';

interface CheckboxProps {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange }) => {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .cbx-wrapper {
          --accent-color: #3b82f6;
          display: inline-flex;
          align-items: center;
        }

        .cbx-wrapper .check {
          cursor: pointer;
          position: relative;
          margin: auto;
          width: 18px;
          height: 18px;
          -webkit-tap-highlight-color: transparent;
          transform: translate3d(0, 0, 0);
        }

        .cbx-wrapper .check:before {
          content: "";
          position: absolute;
          top: -15px;
          left: -15px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.08);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .cbx-wrapper .check svg {
          position: relative;
          z-index: 1;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke: #c8ccd4;
          stroke-width: 1.5;
          transform: translate3d(0, 0, 0);
          transition: all 0.2s ease;
        }

        .cbx-wrapper .check svg path {
          stroke-dasharray: 60;
          stroke-dashoffset: 0;
        }

        .cbx-wrapper .check svg polyline {
          stroke-dasharray: 22;
          stroke-dashoffset: 66;
        }

        .cbx-wrapper .check:hover:before {
          opacity: 1;
        }

        .cbx-wrapper .check:hover svg {
          stroke: var(--accent-color, #3b82f6);
        }

        .cbx-wrapper input:checked + .check svg {
          stroke: var(--accent-color, #3b82f6);
        }

        .cbx-wrapper input:checked + .check svg path {
          stroke-dashoffset: 60;
          transition: all 0.3s linear;
        }

        .cbx-wrapper input:checked + .check svg polyline {
          stroke-dashoffset: 42;
          transition: all 0.2s linear;
          transition-delay: 0.15s;
        }
      `}} />
      <label className="cbx-wrapper" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ display: 'none' }}
        />
        <span className="check">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M 1 9 L 1 9 c 0 -5 3 -8 8 -8 L 9 1 C 14 1 17 5 17 9 L 17 9 c 0 4 -4 8 -8 8 L 9 17 C 5 17 1 14 1 9 L 1 9 Z" />
            <polyline points="1 9 7 14 15 4" />
         </svg>
       </span>
     </label>
    </>
  );
};

export default Checkbox;
