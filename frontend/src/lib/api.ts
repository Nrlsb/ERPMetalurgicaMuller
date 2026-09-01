export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    let url = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/+$/, '');
    // Si la URL no termina en /api/v1, agregarlo automáticamente para evitar errores
    if (!url.endsWith('/api/v1')) {
      url = `${url}/api/v1`;
    }
    return url;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocal) {
      // En producción (ej. Vercel), no consultar localhost para evitar bloqueos de red privada de Chrome
      return '';
    }
  }

  return 'http://localhost:4000/api/v1';
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; errors?: any[]; requires2FA?: boolean; tempToken?: string }> {
  const baseUrl = getApiBaseUrl();

  // Si estamos en producción en Vercel y no se configuró NEXT_PUBLIC_API_URL remota
  if (typeof window !== 'undefined' && !baseUrl && !process.env.NEXT_PUBLIC_API_URL) {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      console.warn(`[API] NEXT_PUBLIC_API_URL no configurada en Vercel para ${endpoint}.`);
      return {
        success: false,
        message: 'Servidor backend en producción no configurado en Vercel.',
      };
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('erp_muller_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const fullUrl = baseUrl ? `${baseUrl}${endpoint}` : endpoint;
    const res = await fetch(fullUrl, {
      credentials: 'include', // Enviar y recibir cookies HttpOnly automáticamente
      ...options,
      headers,
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.warn(`[API] Fallback / Error de conexión para ${endpoint}:`, error.message);
    return {
      success: false,
      message: 'No se pudo conectar con el servidor backend.',
    };
  }
}
