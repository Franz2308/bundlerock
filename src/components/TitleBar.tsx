import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
} from '../services/downloadApi';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const checkState = async () => {
      try {
        const max = await isWindowMaximized();
        setIsMaximized(max);
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onResized(async () => {
          try {
            const current = await isWindowMaximized();
            setIsMaximized(current);
          } catch {
            // ignore during resize transition
          }
        });
      } catch (e) {
        console.error('Failed to get window state:', e);
      }
    };
    checkState();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await minimizeWindow();
    } catch (e) {
      console.error('Minimize failed:', e);
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const maximized = await toggleMaximizeWindow();
      setIsMaximized(maximized);
    } catch (e) {
      console.error('Toggle maximize failed:', e);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await closeWindow();
    } catch (e) {
      console.error('Close failed:', e);
    }
  };

  return (
    <header
      data-tauri-drag-region
      className="h-9 bg-[#1a365d] text-white flex items-center justify-between select-none shrink-0 border-b border-[#0f2442] shadow-sm z-50 transition-colors"
    >
      {/* Left: App Logo & Name */}
      <div
        className="flex items-center gap-2 px-3 h-full cursor-default select-none pointer-events-none"
      >
        <div className="w-5 h-5 rounded-full border border-white/70 bg-[#244a77] flex items-center justify-center text-xs font-bold text-white shadow-sm pointer-events-none select-none">
          ↓
        </div>
        <span className="tracking-wide text-xs font-bold uppercase text-white pointer-events-none select-none">
          BundleRock
        </span>
      </div>

      {/* Middle: Draggable space across empty bar */}
      <div
        className="flex-1 h-full cursor-default select-none pointer-events-none"
      />

      {/* Right: Window Controls (Strictly excluded from drag region) */}
      <div
        data-tauri-drag-region="false"
        className="flex items-center h-full select-none"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
          title="Minimizar"
          aria-label="Minimizar ventana"
        >
          <svg className="w-3 h-3 pointer-events-none" viewBox="0 0 10 10" fill="none">
            <path d="M1 5.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleMaximize}
          className="w-11 h-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          aria-label={isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'}
        >
          {isMaximized ? (
            <svg className="w-3 h-3 pointer-events-none" viewBox="0 0 10 10" fill="none">
              <path
                d="M3 3V1.5A.5.5 0 0 1 3.5 1h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H7"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <rect
                x="1"
                y="3"
                width="6"
                height="6"
                stroke="currentColor"
                strokeWidth="1.2"
                rx="0.5"
              />
            </svg>
          ) : (
            <svg className="w-3 h-3 pointer-events-none" viewBox="0 0 10 10" fill="none">
              <rect
                x="1"
                y="1"
                width="8"
                height="8"
                stroke="currentColor"
                strokeWidth="1.2"
                rx="0.5"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center text-white/80 hover:text-white hover:bg-[#e81123] active:bg-[#c4101f] transition-colors cursor-pointer"
          title="Cerrar"
          aria-label="Cerrar ventana"
        >
          <svg className="w-3 h-3 pointer-events-none" viewBox="0 0 10 10" fill="none">
            <path
              d="M1.5 1.5l7 7M8.5 1.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default TitleBar;
