import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { SidebarProvider } from '@/context/SidebarContext';

export const metadata: Metadata = {
  title: 'ERP Muller Juan - Sistema de Gestión Empresarial',
  description: 'Sistema Integral ERP para inventario, ventas, compras y finanzas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0B0F19] text-slate-100 min-h-screen">
        <AuthProvider>
          <ToastProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
