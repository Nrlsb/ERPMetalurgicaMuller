'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Landmark,
  Users,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Factory,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import Logo from '@/components/brand/Logo';

const menuItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    badge: null,
    roles: ['ADMIN', 'OPERADOR', 'VENTAS', 'COMPRAS', 'FINANZAS'],
  },
  {
    title: 'Inventario & Stock',
    href: '/inventario',
    icon: Package,
    badge: 'Módulo 2',
    roles: ['ADMIN', 'OPERADOR', 'COMPRAS'],
  },
  {
    title: 'Fabricación & Recetas',
    href: '/fabricacion',
    icon: Factory,
    badge: 'Módulo 6',
    roles: ['ADMIN', 'OPERADOR'],
  },
  {
    title: 'Ventas & Facturación',
    href: '/ventas',
    icon: ShoppingCart,
    badge: 'Módulo 3',
    roles: ['ADMIN', 'VENTAS'],
  },
  {
    title: 'Compras & Proveedores',
    href: '/compras',
    icon: Truck,
    badge: 'Módulo 4',
    roles: ['ADMIN', 'COMPRAS'],
  },
  {
    title: 'Tesorería & Finanzas',
    href: '/finanzas',
    icon: Landmark,
    badge: 'Módulo 5',
    roles: ['ADMIN', 'FINANZAS'],
  },
  {
    title: 'Usuarios & Roles',
    href: '/usuarios',
    icon: Users,
    badge: 'Módulo 0',
    roles: ['ADMIN'],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar();

  const userRole = user?.role || 'ADMIN';
  const visibleMenuItems = menuItems.filter(
    (item) => !item.roles || item.roles.includes(userRole) || userRole === 'ADMIN'
  );

  const renderNavLinks = (isMobile: boolean = false) => (
    <div className={`flex-1 overflow-y-auto px-3 py-4 space-y-1.5 ${!isMobile && isCollapsed ? 'overflow-x-hidden' : ''}`}>
      {(!isCollapsed || isMobile) ? (
        <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-3 mb-2">
          Navegación Principal
        </div>
      ) : (
        <div className="w-6 h-[1px] bg-slate-800/80 mx-auto my-2" />
      )}

      {visibleMenuItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const collapsedState = !isMobile && isCollapsed;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (isMobile) closeMobileSidebar();
            }}
            title={collapsedState ? `${item.title} ${item.badge ? `(${item.badge})` : ''}` : undefined}
            className={`relative flex items-center ${
              collapsedState ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'
            } rounded-xl text-sm font-medium transition-all duration-200 group ${
              isActive
                ? 'bg-gradient-to-r from-sky-600/20 to-blue-500/10 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Icon
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                  isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {(!collapsedState || isMobile) && <span className="truncate">{item.title}</span>}
            </div>

            {(!collapsedState || isMobile) && (
              <>
                {item.badge ? (
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700/60 shrink-0">
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-4 h-4 text-sky-400 shrink-0" />
                )}
              </>
            )}

            {/* Tooltip flotante en modo contraído de escritorio */}
            {collapsedState && (
              <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-200 fixed left-20 ml-2 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl shadow-2xl whitespace-nowrap z-50 flex items-center gap-2">
                <span>{item.title}</span>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-sky-400 border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );

  const renderUserProfile = (isMobile: boolean = false) => {
    const collapsedState = !isMobile && isCollapsed;
    return (
      <div className="p-3 border-t border-slate-800/80 bg-[#070b14]">
        {!collapsedState || isMobile ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'Usuario'}</p>
                <div className="flex items-center gap-1 text-[11px] text-sky-400 font-medium">
                  <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">{user?.role || 'ADMIN'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (isMobile) closeMobileSidebar();
                logout();
              }}
              title="Cerrar Sesión"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              title={`${user?.fullName || 'Usuario'} (${user?.role || 'ADMIN'})`}
              className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer"
            >
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <button
              onClick={logout}
              title="Cerrar Sesión"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 1. Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* 2. Mobile Drawer Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#090e1a] border-r border-slate-800 flex flex-col h-screen shadow-2xl transition-transform duration-300 ease-in-out lg:hidden select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between min-h-[73px]">
          <Logo size="md" showText={true} />
          <button
            onClick={closeMobileSidebar}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation Links */}
        {renderNavLinks(true)}

        {/* Mobile User Footer */}
        {renderUserProfile(true)}
      </aside>

      {/* 3. Desktop Sidebar */}
      <aside
        className={`hidden lg:flex ${
          isCollapsed ? 'w-20' : 'w-72'
        } bg-[#090e1a]/95 border-r border-slate-800/80 flex-col h-screen sticky top-0 backdrop-blur-xl z-30 transition-all duration-300 ease-in-out select-none`}
      >
        {/* Brand Header */}
        <div
          className={`p-4 border-b border-slate-800/80 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } transition-all duration-300 min-h-[73px]`}
        >
          <div className="overflow-hidden flex items-center">
            <Logo size={isCollapsed ? 'sm' : 'md'} showText={!isCollapsed} />
          </div>

          <button
            onClick={toggleSidebar}
            title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            className={`p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/80 transition-all shrink-0 ${
              isCollapsed ? 'hidden' : 'flex'
            }`}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Botón para expandir si está colapsado */}
        {isCollapsed && (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={toggleSidebar}
              title="Expandir menú lateral"
              className="p-1.5 rounded-xl text-slate-400 hover:text-sky-400 hover:bg-slate-800/80 border border-slate-800 transition-all"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Desktop Navigation Links */}
        {renderNavLinks(false)}

        {/* Desktop User Footer */}
        {renderUserProfile(false)}
      </aside>
    </>
  );
}
