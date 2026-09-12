'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { accessibleAudio } from '@/lib/accessibleAudio';

interface DwellTargetProps {
  onTrigger: () => void;
  dwellTimeMs?: number; // 0 para desactivar dwell
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'card' | 'outline';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  ringColor?: string;
  soundType?: 'success' | 'cancel' | 'warning';
}

export default function DwellTarget({
  onTrigger,
  dwellTimeMs = 1000,
  disabled = false,
  variant = 'neutral',
  className = '',
  style,
  children,
  ariaLabel,
  title,
  ringColor,
  soundType = 'success',
}: DwellTargetProps) {
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const triggeredRef = useRef<boolean>(false);
  const cooldownRef = useRef<boolean>(false);

  const cancelDwell = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    startTimeRef.current = null;
    setProgress(0);
    setIsHovered(false);
  }, []);

  const handleComplete = useCallback(() => {
    cancelDwell();
    cooldownRef.current = true;
    triggeredRef.current = true;

    if (soundType === 'success') accessibleAudio.playSuccess();
    else if (soundType === 'cancel') accessibleAudio.playCancel();
    else if (soundType === 'warning') accessibleAudio.playWarning();

    onTrigger();

    // Tiempo de enfriamiento para no reactivar inmediatamente si la mirada sigue fija
    setTimeout(() => {
      cooldownRef.current = false;
      triggeredRef.current = false;
    }, 600);
  }, [cancelDwell, onTrigger, soundType]);

  const handlePointerEnter = () => {
    if (disabled || cooldownRef.current || triggeredRef.current) return;
    setIsHovered(true);

    if (dwellTimeMs <= 0) return;

    startTimeRef.current = performance.now();
    accessibleAudio.playDwellTick();

    const loop = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const currentPct = Math.min(100, (elapsed / dwellTimeMs) * 100);
      setProgress(currentPct);

      if (currentPct >= 100) {
        handleComplete();
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handlePointerLeave = () => {
    cancelDwell();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled || cooldownRef.current) return;
    cancelDwell();
    cooldownRef.current = true;

    if (soundType === 'success') accessibleAudio.playSuccess();
    else if (soundType === 'cancel') accessibleAudio.playCancel();
    else if (soundType === 'warning') accessibleAudio.playWarning();

    onTrigger();

    setTimeout(() => {
      cooldownRef.current = false;
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as any);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Estilos según variante
  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30 shadow-lg shadow-blue-500/20 active:scale-[0.98]',
    success:
      'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30 shadow-lg shadow-emerald-500/20 active:scale-[0.98]',
    danger:
      'bg-rose-700 hover:bg-rose-600 text-white border-rose-400/30 shadow-lg shadow-rose-500/20 active:scale-[0.98]',
    warning:
      'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold border-amber-300/40 shadow-lg shadow-amber-500/20 active:scale-[0.98]',
    neutral:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600/50 shadow-md active:scale-[0.98]',
    outline:
      'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-2 border-slate-600/70 active:scale-[0.98]',
    card:
      'bg-slate-900/90 hover:bg-slate-800/90 text-slate-100 border-2 border-slate-700/80 shadow-xl active:scale-[0.99]',
  };

  const activeRingColor =
    ringColor ||
    (variant === 'success'
      ? '#10b981'
      : variant === 'danger'
      ? '#f43f5e'
      : variant === 'warning'
      ? '#f59e0b'
      : '#38bdf8');

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      title={title}
      style={style}
      className={`relative select-none outline-none transition-all duration-150 rounded-2xl border flex flex-col items-center justify-center p-4 focus:ring-4 focus:ring-sky-500/50 ${
        disabled ? 'opacity-40 cursor-not-allowed saturate-50' : 'cursor-pointer hover:border-sky-400/60'
      } ${variantClasses[variant]} ${className}`}
    >
      {/* Barra o Indicador Visual de Progreso de Fijación Ocular (Dwell) */}
      {dwellTimeMs > 0 && isHovered && progress > 0 && !disabled && (
        <>
          {/* Barra de progreso inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-950/40 rounded-b-2xl overflow-hidden pointer-events-none">
            <div
              className="h-full transition-all duration-75 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundColor: activeRingColor,
                boxShadow: `0 0 10px ${activeRingColor}`,
              }}
            />
          </div>

          {/* Anillo de fijación en la esquina superior derecha */}
          <div className="absolute top-2 right-2 w-8 h-8 pointer-events-none flex items-center justify-center">
            <svg className="w-8 h-8 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="13"
                stroke="currentColor"
                strokeWidth="3"
                className="text-white/20"
                fill="none"
              />
              <circle
                cx="16"
                cy="16"
                r="13"
                stroke={activeRingColor}
                strokeWidth="3.5"
                strokeDasharray={2 * Math.PI * 13}
                strokeDashoffset={2 * Math.PI * 13 * (1 - progress / 100)}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </>
      )}

      {/* Contenido del botón */}
      <div className="w-full flex flex-col items-center justify-center text-center pointer-events-none">
        {children}
      </div>
    </button>
  );
}
