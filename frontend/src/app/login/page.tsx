'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  Smartphone,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/brand/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@erpmuller.com');
  const [password, setPassword] = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA Challenge State
  const [is2FAStage, setIs2FAStage] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);

  const { login, verify2FALogin } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (is2FAStage) {
        if (!tempToken || twoFactorCode.trim().length !== 6) {
          setError('Ingrese el código de 6 dígitos de su aplicación autenticadora.');
          setIsSubmitting(false);
          return;
        }

        const res = await verify2FALogin(tempToken, twoFactorCode.trim());
        if (res.success) {
          router.push('/dashboard');
        } else {
          setError(res.message || 'Código 2FA incorrecto o expirado');
        }
      } else {
        const res = await login(email, password);
        if (res.requires2FA && res.tempToken) {
          setTempToken(res.tempToken);
          setIs2FAStage(true);
          setTwoFactorCode('');
        } else if (res.success) {
          router.push('/dashboard');
        } else {
          setError(res.message || 'Error al iniciar sesión');
        }
      }
    } catch (err) {
      setError('Ocurrió un error inesperado de comunicación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setIs2FAStage(false);
    setTempToken(null);
    setTwoFactorCode('');
    setError(null);
  };

  const setCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError(null);
    setIs2FAStage(false);
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/4 w-[32rem] h-[32rem] bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[32rem] h-[32rem] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="flex flex-col items-center justify-center mb-8 text-center">
          <Logo size="xl" showText={false} className="mb-4" />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-wider">
              MULLER
            </h1>
            <span className="text-2xl font-light text-sky-400 tracking-widest">
              JUAN
            </span>
          </div>
          <p className="text-xs text-sky-400 font-medium tracking-wide mt-1">
            SISTEMA ERP INTEGRAL
          </p>
        </div>

        {/* Login / 2FA Card */}
        <div className="bg-[#0e1628]/90 p-8 rounded-3xl border border-slate-800/90 shadow-2xl shadow-sky-950/30 backdrop-blur-2xl">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!is2FAStage ? (
            /* Paso 1: Credenciales Estándar */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="usuario@erpmuller.com"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Ingresar al Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Paso 2: Desafío 2FA */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center pb-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto mb-3">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">Verificación en Dos Pasos</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ingresa el código de 6 dígitos generado por tu aplicación Google Authenticator o Authy.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                  Código de Autenticación (2FA)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    placeholder="000000"
                    className="w-full text-center tracking-[0.5em] text-lg font-mono bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || twoFactorCode.length !== 6}
                className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verificar y Acceder</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al inicio de sesión</span>
              </button>
            </form>
          )}

          {/* Quick Demo Fill Presets */}
          {!is2FAStage && (
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                Acceso Rápido de Prueba (Demo)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCredentials('admin@erpmuller.com', 'Admin123!')}
                  className="flex-1 py-1.5 px-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs border border-slate-700/70 transition-colors font-medium text-center"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => setCredentials('operador@erpmuller.com', 'Admin123!')}
                  className="flex-1 py-1.5 px-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs border border-slate-700/70 transition-colors font-medium text-center"
                >
                  📦 Operador
                </button>
                <button
                  type="button"
                  onClick={() => setCredentials('ventas@erpmuller.com', 'Admin123!')}
                  className="flex-1 py-1.5 px-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs border border-slate-700/70 transition-colors font-medium text-center"
                >
                  🛒 Ventas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security Footer Note */}
        <div className="flex items-center justify-center space-x-2 mt-6 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Protegido con Helmet, Rate Limiting, 2FA & RBAC</span>
        </div>
      </div>
    </div>
  );
}
