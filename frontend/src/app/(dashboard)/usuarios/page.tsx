'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  X,
  Mail,
  Phone,
  Lock,
  Unlock,
  Smartphone,
  Activity,
  History,
  QrCode,
  Check,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  failedAttempts?: number;
  lockedUntil?: string | null;
  role: { id: string; name: string; description?: string };
  lastLogin?: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  module: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role?: { name: string };
  };
}

export default function UsuariosPage() {
  const { user: currentUser, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'my-security'>('users');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // 2FA Setup State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorQr, setTwoFactorQr] = useState('');
  const [twoFactorInputCode, setTwoFactorInputCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMsg, setTwoFactorMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Change State
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Form State Nuevo Usuario
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    roleId: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default Demo Users
  const defaultUsers: UserItem[] = [
    {
      id: '1',
      fullName: 'Benitez Lucas (Admin)',
      email: 'admin@erpmuller.com',
      phone: '+54 11 9999-8888',
      isActive: true,
      twoFactorEnabled: true,
      failedAttempts: 0,
      lockedUntil: null,
      role: { id: 'r1', name: 'ADMIN', description: 'Acceso total al sistema' },
      lastLogin: new Date().toISOString(),
    },
    {
      id: '2',
      fullName: 'Operador Depósito',
      email: 'operador@erpmuller.com',
      phone: '+54 11 8888-7777',
      isActive: true,
      twoFactorEnabled: false,
      failedAttempts: 2,
      lockedUntil: null,
      role: { id: 'r2', name: 'OPERADOR', description: 'Gestión de inventario y stock' },
      lastLogin: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: '3',
      fullName: 'Vendedor Salón',
      email: 'ventas@erpmuller.com',
      phone: '+54 11 7777-6666',
      isActive: true,
      twoFactorEnabled: false,
      failedAttempts: 0,
      lockedUntil: null,
      role: { id: 'r3', name: 'VENTAS', description: 'Cotizaciones y facturación' },
      lastLogin: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
  ];

  // Default Demo Audit Logs
  const defaultAuditLogs: AuditLogItem[] = [
    {
      id: 'log-1',
      action: 'LOGIN_SUCCESS',
      module: 'AUTH',
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
      createdAt: new Date().toISOString(),
      user: { id: '1', fullName: 'Benitez Lucas (Admin)', email: 'admin@erpmuller.com' },
    },
    {
      id: 'log-2',
      action: '2FA_ENABLED',
      module: 'AUTH',
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      user: { id: '1', fullName: 'Benitez Lucas (Admin)', email: 'admin@erpmuller.com' },
    },
    {
      id: 'log-3',
      action: 'LOGIN_FAILED',
      module: 'AUTH',
      details: { failedAttempts: 2, remainingAttempts: 3 },
      ipAddress: '190.220.12.8',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      user: { id: '2', fullName: 'Operador Depósito', email: 'operador@erpmuller.com' },
    },
    {
      id: 'log-4',
      action: 'UPDATE_PASSWORD_SUCCESS',
      module: 'AUTH',
      ipAddress: '192.168.1.45',
      userAgent: 'Chrome 128.0 / Windows',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      user: { id: '1', fullName: 'Benitez Lucas (Admin)', email: 'admin@erpmuller.com' },
    },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<UserItem[]>('/users');
      if (res.success && res.data && res.data.length > 0) {
        setUsers(res.data);
      } else if (currentUser?.role === 'ADMIN' && currentUser?.id === 'demo-admin-id') {
        setUsers(defaultUsers);
      } else {
        setUsers([]);
      }

      const rolesRes = await fetchApi<any[]>('/users/roles');
      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
      }
    } catch (e) {
      if (currentUser?.role === 'ADMIN' && currentUser?.id === 'demo-admin-id') {
        setUsers(defaultUsers);
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetchApi<AuditLogItem[]>('/users/audit-logs?limit=50');
      if (res.success && res.data && res.data.length > 0) {
        setAuditLogs(res.data);
      } else if (currentUser?.role === 'ADMIN' && currentUser?.id === 'demo-admin-id') {
        setAuditLogs(defaultAuditLogs);
      } else {
        setAuditLogs([]);
      }
    } catch (e) {
      if (currentUser?.role === 'ADMIN' && currentUser?.id === 'demo-admin-id') {
        setAuditLogs(defaultAuditLogs);
      } else {
        setAuditLogs([]);
      }
    } finally {
      setLoadingAudit(false);
    }
  };

  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4 space-y-4">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Acceso Denegado (403)</h2>
        <p className="text-sm text-slate-400 max-w-md">
          No tienes los permisos requeridos para acceder al Centro de Seguridad & Control de Accesos. Esta sección está reservada exclusivamente para Administradores.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors shadow-lg"
        >
          Volver al Dashboard
        </Link>
      </div>
    );
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormData({ fullName: '', email: '', password: '', phone: '', roleId: '' });
        loadData();
      } else {
        const errorDetail =
          res.errors && res.errors.length > 0
            ? res.errors.map((e: any) => e.message).join('. ')
            : res.message;
        setFormError(errorDetail || 'Error al registrar el usuario');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error al registrar el usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockUser = async (userId: string) => {
    try {
      const res = await fetchApi(`/users/${userId}/unlock`, { method: 'POST' });
      if (res.success) {
        loadData();
      }
    } catch (e) {
      console.warn('Error desbloqueando usuario:', e);
    }
  };

  // Iniciar configuración 2FA (Generar QR)
  const handleOpen2FASetup = async () => {
    setTwoFactorLoading(true);
    setTwoFactorMsg(null);
    setTwoFactorInputCode('');
    setIs2FAModalOpen(true);

    try {
      const res = await fetchApi<{ secret: string; qrCodeUrl: string }>('/auth/2fa/setup', {
        method: 'POST',
      });
      if (res.success && res.data) {
        setTwoFactorSecret(res.data.secret);
        setTwoFactorQr(res.data.qrCodeUrl);
      } else {
        // Fallback demo secret y qr
        setTwoFactorSecret('JBSWY3DPEHPK3PXP');
        setTwoFactorQr('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/ERPMuller:admin@erpmuller.com?secret=JBSWY3DPEHPK3PXP&issuer=ERPMuller');
      }
    } catch (err) {
      setTwoFactorSecret('JBSWY3DPEHPK3PXP');
      setTwoFactorQr('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/ERPMuller:admin@erpmuller.com?secret=JBSWY3DPEHPK3PXP&issuer=ERPMuller');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Confirmar y activar 2FA
  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorMsg(null);

    try {
      const res = await fetchApi('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ secret: twoFactorSecret, code: twoFactorInputCode }),
      });

      if (res.success) {
        setTwoFactorMsg({ type: 'success', text: '¡Autenticación en dos pasos (2FA) activada con éxito!' });
        setTimeout(() => {
          setIs2FAModalOpen(false);
          refreshUser();
          loadData();
        }, 1500);
      } else {
        setTwoFactorMsg({ type: 'error', text: res.message || 'Código incorrecto. Revisa tu aplicación.' });
      }
    } catch (e: any) {
      setTwoFactorMsg({ type: 'error', text: 'Error al verificar el código 2FA.' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Desactivar 2FA
  const handleDisable2FA = async () => {
    const pwd = prompt('Ingresa tu contraseña actual para confirmar la desactivación de 2FA:');
    if (!pwd) return;

    try {
      const res = await fetchApi('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: pwd }),
      });
      if (res.success) {
        alert('Autenticación en dos pasos desactivada.');
        refreshUser();
        loadData();
      } else {
        alert(res.message || 'Contraseña incorrecta');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  // Actualizar contraseña propia
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'La nueva contraseña y su confirmación no coinciden.' });
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await fetchApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });

      if (res.success) {
        setPwMsg({ type: 'success', text: 'Contraseña actualizada exitosamente.' });
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPwMsg({ type: 'error', text: res.message || 'Error al cambiar la contraseña' });
      }
    } catch (e: any) {
      setPwMsg({ type: 'error', text: 'Error de red' });
    } finally {
      setPwSubmitting(false);
    }
  };

  const getRoleBadgeClass = (roleName: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'OPERADOR':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'VENTAS':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'COMPRAS':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'FINANZAS':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('SUCCESS') || action.includes('ENABLED') || action.includes('CREATE')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (action.includes('FAILED') || action.includes('LOCKED') || action.includes('BLOCKED')) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (action.includes('DISABLED') || action.includes('UPDATE')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      l.module.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (l.user?.fullName && l.user.fullName.toLowerCase().includes(auditSearchTerm.toLowerCase())) ||
      (l.ipAddress && l.ipAddress.includes(auditSearchTerm))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            <span>Centro de Seguridad & Control de Accesos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de usuarios, control RBAC, autenticación 2FA, políticas de acceso y auditoría de eventos
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios & Roles ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'audit'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Registro de Auditoría (Audit Log)</span>
        </button>

        <button
          onClick={() => setActiveTab('my-security')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'my-security'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Mi Seguridad & 2FA</span>
        </button>
      </div>

      {/* ================= TAB 1: USUARIOS & RBAC ================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Role Cards Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {['ADMIN', 'OPERADOR', 'VENTAS', 'COMPRAS', 'FINANZAS'].map((r) => (
              <div key={r} className="glass-panel p-3.5 rounded-xl border border-slate-800 text-center">
                <Shield className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
                <p className="text-xs font-bold text-white">{r}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {r === 'ADMIN' ? 'Control Total' : `Módulos de ${r}`}
                </p>
              </div>
            ))}
          </div>

          {/* Search and Table */}
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden p-4 space-y-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o rol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Usuario</th>
                    <th className="py-3 px-4 font-semibold">Rol Asignado</th>
                    <th className="py-3 px-4 font-semibold text-center">2FA (TOTP)</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado / Seguridad</th>
                    <th className="py-3 px-4 font-semibold">Último Ingreso</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();

                    return (
                      <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 text-emerald-400 font-bold flex items-center justify-center border border-slate-700">
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-white">{u.fullName}</p>
                              <p className="text-[11px] text-slate-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getRoleBadgeClass(
                              u.role.name
                            )}`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>{u.role.name}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {u.twoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <Smartphone className="w-3 h-3" />
                              <span>Activado</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <span>Inactivo</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              <span>Bloqueado (Fuerza Bruta)</span>
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.isActive
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {u.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {u.lastLogin
                            ? new Date(u.lastLogin).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Nunca'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isLocked && (
                            <button
                              onClick={() => handleUnlockUser(u.id)}
                              className="inline-flex items-center gap-1 py-1 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-semibold transition-colors"
                              title="Desbloquear cuenta de usuario"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Desbloquear</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: AUDITORÍA (AUDIT LOGS) ================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por acción, IP, módulo o usuario..."
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <button
              onClick={loadAuditLogs}
              disabled={loadingAudit}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700 font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              <span>Actualizar Registros</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                    <th className="py-3 px-4 font-semibold">Módulo</th>
                    <th className="py-3 px-4 font-semibold">Acción Realizada</th>
                    <th className="py-3 px-4 font-semibold">Usuario Responsable</th>
                    <th className="py-3 px-4 font-semibold">IP & Navegador</th>
                    <th className="py-3 px-4 font-semibold">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        {new Date(log.createdAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-300">
                        {log.module}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {log.user ? (
                          <div>
                            <p className="font-semibold text-white">{log.user.fullName}</p>
                            <p className="text-[10px] text-slate-400">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Sistema / Anónimo</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        <p className="font-mono text-[11px] text-slate-300">{log.ipAddress || 'Local'}</p>
                        <p className="text-[10px] truncate max-w-xs">{log.userAgent || '—'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: MI SEGURIDAD & 2FA ================= */}
      {activeTab === 'my-security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: 2FA Authentication */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Autenticación en Dos Pasos (2FA)</h3>
                <p className="text-xs text-slate-400">Protege tu cuenta con códigos TOTP de 6 dígitos</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Al activar la autenticación en dos pasos, se te solicitará ingresar un código temporal generado
                en tu aplicación autenticadora (Google Authenticator, Microsoft Authenticator o Authy) cada vez que inicies sesión.
              </p>
              <div className="flex items-center gap-2 pt-2 text-xs font-semibold">
                <span>Estado actual:</span>
                {currentUser?.twoFactorEnabled ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Activado
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-4 h-4" /> No configurado
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2">
              {currentUser?.twoFactorEnabled ? (
                <button
                  type="button"
                  onClick={handleDisable2FA}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Desactivar 2FA</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpen2FASetup}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Configurar 2FA con Código QR</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Cambio de Contraseña */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Cambiar Contraseña</h3>
                <p className="text-xs text-slate-400">Cumple con los estándares de seguridad corporativa</p>
              </div>
            </div>

            {pwMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  pwMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {pwMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{pwMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  required
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  placeholder="Mín. 8 caracteres, mayúscula, número y símbolo"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  placeholder="Repite la nueva contraseña"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={pwSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                {pwSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Actualizar Contraseña</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL NUEVO USUARIO ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="font-bold text-lg text-white">Crear Usuario del Sistema</h3>
                <p className="text-xs text-slate-400">Asigna permisos y credenciales con políticas de seguridad</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcelo Gómez"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Usuario / Identificador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: BenitezLucas o marcelo@erpmuller.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contraseña de Acceso *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mín. 8 caract., mayúscula, número y símbolo (!@#)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Política: Al menos 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rol de Seguridad (RBAC) *
                </label>
                <select
                  required
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Selecciona un rol...</option>
                  {roles && roles.length > 0 ? (
                    roles.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.description ? `(${r.description})` : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="OPERADOR">OPERADOR (Gestión de Stock)</option>
                      <option value="VENTAS">VENTAS (Cotizaciones y Facturación)</option>
                      <option value="COMPRAS">COMPRAS (Proveedores e Insumos)</option>
                      <option value="FINANZAS">FINANZAS (Tesorería y Cajas)</option>
                      <option value="ADMIN">ADMIN (Acceso Total)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIGURACIÓN 2FA ================= */}
      {is2FAModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-scaleIn space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Configurar Google Authenticator</h3>
              </div>
              <button
                onClick={() => setIs2FAModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {twoFactorMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  twoFactorMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {twoFactorMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{twoFactorMsg.text}</span>
              </div>
            )}

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl mx-auto w-48 h-48 shadow-inner">
              {twoFactorQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={twoFactorQr} alt="QR Code 2FA" className="w-40 h-40 object-contain" />
              ) : (
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs text-slate-300">
                1. Escanea el código QR desde tu app autenticadora.
              </p>
              <p className="text-[11px] font-mono text-slate-400 bg-slate-900 p-2 rounded-lg break-all">
                Clave secreta: <span className="text-emerald-400 font-bold">{twoFactorSecret}</span>
              </p>
            </div>

            <form onSubmit={handleConfirm2FA} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">
                  2. Ingresa el código de 6 dígitos para verificar
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={twoFactorInputCode}
                  onChange={(e) => setTwoFactorInputCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className="w-full text-center tracking-[0.5em] text-lg font-mono bg-slate-900 border border-slate-700 rounded-xl py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIs2FAModalOpen(false)}
                  className="flex-1 py-2 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={twoFactorLoading || twoFactorInputCode.length !== 6}
                  className="flex-1 py-2 text-xs font-semibold text-white rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {twoFactorLoading ? 'Verificando...' : 'Activar 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
