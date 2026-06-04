import React from 'react';

interface CheckboxProps {
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange }) => {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-checkbox-container input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .custom-checkbox-container {
          display: block;
          position: relative;
          cursor: pointer;
          font-size: 1.5rem;
          user-select: none;
        }

        .custom-checkbox-checkmark {
          --clr: #2563EB;
          position: relative;
          top: 0;
          left: 0;
          height: 1.3em;
          width: 1.3em;
          background-color: #ccc;
          border-radius: 50%;
          transition: 300ms;
        }

        .custom-checkbox-container input:checked ~ .custom-checkbox-checkmark {
          background-color: var(--clr);
          border-radius: .5rem;
          animation: pulse 500ms ease-in-out;
        }

        .custom-checkbox-checkmark:after {
          content: "";
          position: absolute;
          display: none;
        }

        .custom-checkbox-container input:checked ~ .custom-checkbox-checkmark:after {
          display: block;
        }

        .custom-checkbox-container .custom-checkbox-checkmark:after {
          left: 0.45em;
          top: 0.25em;
          width: 0.25em;
          height: 0.5em;
          border: solid #E0E0E2;
          border-width: 0 0.15em 0.15em 0;
          transform: rotate(45deg);
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 #2563EB90;
            rotate: 20deg;
          }

          50% {
            rotate: -20deg;
          }

          75% {
            box-shadow: 0 0 0 10px #2563EB60;
          }

          100% {
            box-shadow: 0 0 0 13px #2563EB30;
            rotate: 0;
          }
        }
      `}} />
      <label className="custom-checkbox-container">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <div className="custom-checkbox-checkmark" />
      </label>
    </>
  );
}

export default Checkbox;