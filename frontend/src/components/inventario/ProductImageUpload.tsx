'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  Link as LinkIcon,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';

interface ProductImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
}

/**
 * Comprime y redimensiona una imagen en el navegador del cliente mediante Canvas.
 * Garantiza un tamaño liviano (~50-100 KB en Base64) conservando excelente nitidez visual.
 */
function compressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Exportar como JPEG de alta fidelidad optimizado
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProductImageUpload({
  value,
  onChange,
  helperText = 'Esta imagen se mostrará en tamaño gigante en el panel adaptado para que Gaspar identifique la pieza visualmente.',
}: ProductImageUploadProps) {
  // Determinar pestaña inicial según el valor: si empieza con data: es archivo, si empieza con http es url
  const isDataUrl = value?.startsWith('data:image/');
  const [tab, setTab] = useState<'upload' | 'url'>(value && !isDataUrl ? 'url' : 'upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Procesar archivo seleccionado
  const handleProcessFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP, etc.)');
        return;
      }
      setErrorMessage(null);
      setIsProcessing(true);
      try {
        const compressed = await compressImage(file);
        onChange(compressed);
        setTab('upload');
      } catch (err: any) {
        console.error('Error al procesar la imagen:', err);
        setErrorMessage('No se pudo procesar la imagen. Intente nuevamente.');
      } finally {
        setIsProcessing(false);
      }
    },
    [onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    // Reset input para permitir volver a elegir el mismo archivo si se desea
    if (e.target) e.target.value = '';
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Soporte para pegar con Ctrl+V
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleProcessFile(file);
            return;
          }
        }
      }
    }
  };

  const handleClear = () => {
    onChange('');
    setErrorMessage(null);
  };

  const hasImage = Boolean(value && value.trim().length > 0);

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      {/* Encabezado y Selector de Modo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-sky-400" />
          <span>Foto / Imagen del Producto</span>
        </label>

        {/* Pestañas: Subir vs URL */}
        <div className="flex items-center p-0.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
              tab === 'upload'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Subir Archivo</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all ${
              tab === 'url'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Enlace URL</span>
          </button>
        </div>
      </div>

      {/* Input oculto para selección de archivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Contenido según pestaña */}
      {tab === 'upload' ? (
        <div>
          {hasImage ? (
            /* Vista previa de imagen cargada */
            <div className="p-3 bg-slate-950/80 border border-slate-700 hover:border-slate-600 rounded-xl flex items-center justify-between gap-3 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-700/80 overflow-hidden shrink-0 flex items-center justify-center relative">
                  <img
                    src={value}
                    alt="Vista previa del producto"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                      <Check className="w-3 h-3" />
                      Imagen lista
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isDataUrl ? 'Archivo local optimizado' : 'URL vinculada'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mt-1">
                    Lista para identificación visual y panel adaptado
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-2.5 py-1.5 text-xs font-semibold text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-600 border border-sky-500/20 hover:border-transparent rounded-lg flex items-center gap-1.5 transition-all"
                  title="Seleccionar otra imagen"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Cambiar</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600/80 border border-rose-500/20 hover:border-transparent rounded-lg transition-all"
                  title="Quitar imagen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Zona de Arrastrar y Soltar / Botón de Carga */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                  : 'border-slate-700 hover:border-sky-500/60 bg-slate-900/60 hover:bg-slate-900'
              }`}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
                  <span className="text-xs font-medium text-slate-300">
                    Optimizando imagen...
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 group-hover:bg-sky-500/20 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white group-hover:text-sky-300">
                      Haz clic para subir una foto
                    </span>
                    <span className="text-xs text-slate-400"> o arrastra una imagen aquí</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Soporta JPG, PNG, WebP o captura con cámara (se comprime automáticamente)
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Pestaña URL Web */
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={value}
              onChange={(e) => {
                setErrorMessage(null);
                onChange(e.target.value);
              }}
              placeholder="https://ejemplo.com/fotos/bomba-paleta.jpg"
              className="flex-1 bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-xs"
            />
            {hasImage && (
              <>
                <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={value}
                    alt="Vista previa"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-2 text-rose-400 hover:text-white hover:bg-rose-600/80 border border-rose-500/20 hover:border-transparent rounded-xl transition-all"
                  title="Borrar URL"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de error si hubo problema al procesar el archivo */}
      {errorMessage && (
        <p className="text-xs text-rose-400 font-medium">{errorMessage}</p>
      )}

      {/* Texto de ayuda explicativo */}
      {helperText && (
        <p className="text-[11px] text-slate-400">
          {helperText}
        </p>
      )}
    </div>
  );
}
