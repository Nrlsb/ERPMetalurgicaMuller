'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, Zap, ZapOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isBarcodeDetectorSupported, setIsBarcodeDetectorSupported] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Reproducir sonido beep al detectar código con éxito
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880; // La (A5)
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Ignorar si el audio está bloqueado por permisos del navegador
    }
  }, []);

  const handleDetectedCode = useCallback(
    (code: string) => {
      if (scannedResult) return;
      setScannedResult(code);
      playBeep();
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      setTimeout(() => {
        onScan(code);
        onClose();
      }, 500);
    },
    [onScan, onClose, playBeep, scannedResult]
  );

  // Iniciar flujo de video de la cámara
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScannedResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador o dispositivo no soporta acceso a la cámara.');
      }

      // Detener cualquier stream anterior
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Priorizar cámara trasera para celulares (environment)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Comprobar soporte de linterna / flash
      const track = stream.getVideoTracks()[0];
      const capabilities = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
      if (capabilities.torch) {
        setTorchSupported(true);
      }
    } catch (err: any) {
      console.error('Error al iniciar cámara:', err);
      setHasCamera(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Permiso denegado. Permite el acceso a la cámara en los ajustes del navegador.');
      } else {
        setCameraError(err.message || 'No se pudo iniciar la cámara del dispositivo.');
      }
    }
  }, []);

  // Detener cámara al cerrar
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  }, []);

  // Toggle linterna
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.error('Error al cambiar estado de la linterna:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const hasDetector = 'BarcodeDetector' in window;
      setIsBarcodeDetectorSupported(hasDetector);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Bucle de detección de códigos de barras
  useEffect(() => {
    if (!isOpen || !isBarcodeDetectorSupported) return;

    let isScanning = true;
    let detector: any = null;

    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      detector = new BarcodeDetectorClass({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });
    } catch (err) {
      console.warn('BarcodeDetector no se pudo inicializar con formatos específicos:', err);
      try {
        detector = new (window as any).BarcodeDetector();
      } catch (e) {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!isScanning || !videoRef.current || !detector || scannedResult) return;

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue.trim() !== '') {
              handleDetectedCode(rawValue.trim());
              return;
            }
          }
        } catch (err) {
          // Ignorar errores temporales por fotograma borroso
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, isBarcodeDetectorSupported, handleDetectedCode, scannedResult]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Escanear Código de Barras</h3>
              <p className="text-xs text-slate-400">Apunta con la cámara del celular al código</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Cámara */}
        <div className="relative bg-black aspect-[4/3] sm:aspect-square flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-xs space-y-3">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
              <p className="text-sm font-semibold text-white">No se pudo acceder a la cámara</p>
              <p className="text-xs text-slate-400">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Marco visor de escaneo */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="relative w-64 h-44 rounded-2xl border-2 border-dashed border-sky-400/80 bg-sky-500/5 flex items-center justify-center shadow-[0_0_50px_rgba(56,189,248,0.15)]">
                  {/* Esquinas destacadas */}
                  <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-sky-400 rounded-tl-lg" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-sky-400 rounded-tr-lg" />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-sky-400 rounded-bl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-sky-400 rounded-br-lg" />

                  {/* Línea láser de escaneo animada */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-pulse" />

                  {scannedResult && (
                    <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-400">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-scale" />
                      <span className="mt-1 text-xs font-mono font-bold text-white bg-emerald-600/80 px-2 py-0.5 rounded">
                        {scannedResult}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón de Linterna Flotante */}
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`absolute top-4 right-4 p-3 rounded-2xl backdrop-blur-md transition-all ${
                    torchOn
                      ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                      : 'bg-black/60 text-white hover:bg-black/80'
                  }`}
                  title={torchOn ? 'Apagar Linterna' : 'Encender Linterna'}
                >
                  {torchOn ? <Zap className="w-5 h-5 fill-slate-950" /> : <ZapOff className="w-5 h-5" />}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer con Ingreso Manual / Alternativo */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="O ingresa el código manualmente..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) {
                  e.preventDefault();
                  handleDetectedCode(manualCode.trim());
                }
              }}
            />
            <button
              type="button"
              disabled={!manualCode.trim()}
              onClick={() => handleDetectedCode(manualCode.trim())}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
            >
              Aplicar
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            Soporta EAN-13, EAN-8, CODE-128, QR y lectores físicos USB / Bluetooth.
          </p>
        </div>
      </div>
    </div>
  );
};
