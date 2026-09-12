'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F19]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-slate-400">Cargando ERP Muller...</p>
        </div>
      </div>
    );
  }

  // Si está en el modo adaptado para Tobii TD I-16, renderizar pantalla completa inmersiva
  const isAdaptedMode = pathname.includes('/control-adaptado');
  if (isAdaptedMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 w-full">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0B0F19]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 sm:pb-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
