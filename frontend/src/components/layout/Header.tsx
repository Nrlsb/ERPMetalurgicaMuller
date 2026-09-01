'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Calendar, ShieldCheck, Sparkles, PanelLeft, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';

export default function Header() {
  const { user } = useAuth();
  const { isCollapsed, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Mobile Search Overlay when expanded */}
      {isSearchExpanded ? (
        <div className="absolute inset-0 bg-[#0B0F19] z-30 px-4 flex items-center gap-3 animate-in fade-in duration-150">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar productos, clientes, pedidos..."
              className="w-full bg-slate-900 border border-sky-500/50 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <button
            onClick={() => setIsSearchExpanded(false)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Cerrar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Left Controls: Hamburger on mobile, PanelToggle on desktop, & Search */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-1 max-w-md">
            {/* Hamburger Button (Mobile only) */}
            <button
              onClick={toggleMobileSidebar}
              title="Abrir menú de navegación"
              className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors lg:hidden shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={toggleSidebar}
              title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              className="hidden lg:flex p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Desktop Search Bar */}
            <div className="relative w-full hidden sm:block">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar productos, clientes, pedidos o comprobantes..."
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all"
              />
            </div>

            {/* Mobile Search Icon Button (Collapsed search) */}
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="sm:hidden p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Buscar"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2.5 sm:space-x-4">
            {/* Date Display (Hidden on mobile) */}
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span className="capitalize">{today}</span>
            </div>

            {/* Notifications */}
            <button className="relative p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-400 ring-2 ring-[#0B0F19]"></span>
            </button>

            {/* User Pill */}
            <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center border border-sky-500/30 shrink-0">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="text-left hidden xs:block sm:block">
                <p className="text-xs font-semibold text-white leading-tight truncate max-w-[100px] sm:max-w-none">
                  {user?.fullName || 'Admin'}
                </p>
                <p className="text-[10px] text-slate-400 leading-none">{user?.role || 'ADMIN'}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
