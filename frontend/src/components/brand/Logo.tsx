import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeMap = {
    sm: { box: 'w-8 h-8', text: 'text-sm', subtext: 'text-[9px]', svg: 32 },
    md: { box: 'w-10 h-10', text: 'text-base', subtext: 'text-[10px]', svg: 40 },
    lg: { box: 'w-14 h-14', text: 'text-xl', subtext: 'text-xs', svg: 56 },
    xl: { box: 'w-20 h-20', text: 'text-2xl', subtext: 'text-sm', svg: 80 },
  };

  const current = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon Emblem */}
      <div
        className={`${current.box} relative flex-shrink-0 rounded-2xl overflow-hidden shadow-lg shadow-sky-500/20 transition-transform duration-300 hover:scale-105`}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Cyan/Blue Brand Background */}
          <rect width="200" height="200" rx="36" fill="#0088CC" />
          
          {/* Subtle glossy gradient overlay */}
          <rect
            width="200"
            height="200"
            rx="36"
            fill="url(#muller-shine)"
            opacity="0.25"
          />

          {/* White 'M' Emblem */}
          <path
            d="M 52 120 
               L 52 64 
               C 52 42 66 32 90 32
               C 95 32 100 36 100 40
               C 100 36 105 32 110 32
               C 134 32 148 42 148 64
               L 148 120
               L 136 126
               L 136 68
               C 136 52 128 46 112 46
               C 106 46 104 50 104 56
               L 104 140
               L 96 140
               L 96 56
               C 96 50 94 46 88 46
               C 72 46 64 52 64 68
               L 64 126
               Z"
            fill="#FFFFFF"
          />
          {/* Additional bottom bevel details on outer prongs */}
          <path
            d="M 52 120 L 64 126 L 64 68 C 64 52 72 46 88 46 C 94 46 96 50 96 56 L 96 140 L 80 148 L 80 66 C 80 58 76 56 70 56 C 64 56 64 62 64 68 L 64 126 Z"
            fill="#FFFFFF"
            opacity="0.15"
          />
          {/* Center Column Accent Fill */}
          <path
            d="M 80 142 L 88 147 L 96 142 L 96 66 C 96 58 92 56 88 56 C 84 56 80 58 80 66 Z"
            fill="#FFFFFF"
          />
          <path
            d="M 104 142 L 112 147 L 120 142 L 120 66 C 120 58 116 56 112 56 C 108 56 104 58 104 66 Z"
            fill="#FFFFFF"
          />

          {/* Argentine Flag */}
          <g transform="translate(68, 154)">
            <clipPath id="arg-clip">
              <rect width="28" height="17" rx="3" />
            </clipPath>
            <g clipPath="url(#arg-clip)">
              <rect width="28" height="5.67" fill="#74ACDF" />
              <rect y="5.67" width="28" height="5.67" fill="#FFFFFF" />
              <circle cx="14" cy="8.5" r="1.8" fill="#F6B40E" />
              <rect y="11.34" width="28" height="5.67" fill="#74ACDF" />
            </g>
            <rect width="28" height="17" rx="3" stroke="#FFFFFF" strokeWidth="0.5" strokeOpacity="0.4" fill="none" />
          </g>

          {/* German Flag */}
          <g transform="translate(104, 154)">
            <clipPath id="ger-clip">
              <rect width="28" height="17" rx="3" />
            </clipPath>
            <g clipPath="url(#ger-clip)">
              <rect width="28" height="5.67" fill="#000000" />
              <rect y="5.67" width="28" height="5.67" fill="#DD0000" />
              <rect y="11.34" width="28" height="5.67" fill="#FFCE00" />
            </g>
            <rect width="28" height="17" rx="3" stroke="#FFFFFF" strokeWidth="0.5" strokeOpacity="0.4" fill="none" />
          </g>

          {/* Defs */}
          <defs>
            <linearGradient id="muller-shine" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" stopOpacity="0.8" />
              <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="1" stopColor="#003366" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h1 className={`font-black text-white tracking-wider leading-none ${current.text}`}>
              MULLER
            </h1>
            <span className={`font-light text-sky-400 tracking-widest leading-none ${current.text}`}>
              JUAN
            </span>
          </div>
          <span className={`text-sky-400/90 font-medium tracking-wide mt-1 flex items-center gap-1 ${current.subtext}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            SISTEMA ERP INTEGRAL
          </span>
        </div>
      )}
    </div>
  );
}
