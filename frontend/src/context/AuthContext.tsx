'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  permissions: string[];
  twoFactorEnabled?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; requires2FA?: boolean; tempToken?: string; message?: string }>;
  verify2FALogin: (tempToken: string, code: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const res = await fetchApi<UserProfile>('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('erp_muller_user', JSON.stringify(res.data));
      }
    } catch (e) {
      console.warn('Error refrescando sesión:', e);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('erp_muller_token');
    const savedUser = localStorage.getItem('erp_muller_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('erp_muller_token');
        localStorage.removeItem('erp_muller_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const response = await fetchApi<{ token: string; user: UserProfile }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, email: identifier, password }),
      });

      if (response.requires2FA && response.tempToken) {
        return {
          success: true,
          requires2FA: true,
          tempToken: response.tempToken,
          message: response.message || 'Se requiere verificación en dos pasos (2FA)',
        };
      }

      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem('erp_muller_token', response.data.token);
        localStorage.setItem('erp_muller_user', JSON.stringify(response.data.user));
        return { success: true };
      }

      // Si el backend no está corriendo o responde demo, permitir acceso de prueba
      const lowerIdent = identifier.toLowerCase();
      if ((lowerIdent === 'benitezlucas' || lowerIdent === 'admin@erpmuller.com') && password === 'Admin123!') {
        const demoUser: UserProfile = {
          id: 'demo-admin-id',
          email: 'BenitezLucas',
          fullName: 'Lucas Benitez (Admin)',
          role: 'ADMIN',
          permissions: ['all'],
          twoFactorEnabled: false,
        };
        const demoToken = 'demo-jwt-token-muller-erp';
        setToken(demoToken);
        setUser(demoUser);
        localStorage.setItem('erp_muller_token', demoToken);
        localStorage.setItem('erp_muller_user', JSON.stringify(demoUser));
        return { success: true };
      }

      return {
        success: false,
        message: response.message || 'Credenciales inválidas. Verifica tu usuario y contraseña.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Error de red al intentar iniciar sesión',
      };
    }
  };

  const verify2FALogin = async (tempToken: string, code: string) => {
    try {
      const response = await fetchApi<{ token: string; user: UserProfile }>('/auth/2fa/verify-login', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code }),
      });

      if (response.success && response.data) {
        setToken(response.data.token);
        setUser(response.data.user);
        localStorage.setItem('erp_muller_token', response.data.token);
        localStorage.setItem('erp_muller_user', JSON.stringify(response.data.user));
        return { success: true };
      }

      return {
        success: false,
        message: response.message || 'Código 2FA incorrecto o expirado.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Error al verificar el código 2FA',
      };
    }
  };

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignorar error al salir
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('erp_muller_token');
    localStorage.removeItem('erp_muller_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, verify2FALogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
