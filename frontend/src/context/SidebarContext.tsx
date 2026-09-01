'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('erp_muller_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch (e) {
      // Ignorar errores en SSR
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('erp_muller_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  const setCollapsed = (val: boolean) => {
    setIsCollapsed(val);
    try {
      localStorage.setItem('erp_muller_sidebar_collapsed', String(val));
    } catch (e) {}
  };

  const openMobileSidebar = () => setIsMobileOpen(true);
  const closeMobileSidebar = () => setIsMobileOpen(false);
  const toggleMobileSidebar = () => setIsMobileOpen((prev) => !prev);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setCollapsed,
        isMobileOpen,
        openMobileSidebar,
        closeMobileSidebar,
        toggleMobileSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar debe ser usado dentro de un SidebarProvider');
  }
  return context;
}
