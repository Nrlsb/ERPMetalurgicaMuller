const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; errors?: any[]; requires2FA?: boolean; tempToken?: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('erp_muller_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
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
      message: 'No se pudo conectar con el servidor backend en ' + API_URL,
    };
  }
}
