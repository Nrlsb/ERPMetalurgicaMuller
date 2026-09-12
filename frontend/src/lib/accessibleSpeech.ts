/**
 * Servicio de Comunicación Aumentativa y Alternativa (CAA / AAC)
 * y Síntesis de Voz (Text-to-Speech) para Tobii Dynavox TD I-16.
 */

export interface AACQuickPhrase {
  id: string;
  label: string;
  text: string;
  category?: string;
  icon?: string;
}

export const WAREHOUSE_AAC_PHRASES: AACQuickPhrase[] = [
  {
    id: 'help_piece',
    label: 'Pedir Ayuda',
    text: 'Por favor, ¿me pueden ayudar con esta pieza?',
    icon: '🙋',
  },
  {
    id: 'not_found',
    label: 'No lo encuentro',
    text: 'No encuentro este producto en la estantería indicada.',
    icon: '🔍',
  },
  {
    id: 'out_of_stock',
    label: 'Falta Stock',
    text: 'Atención: este producto está agotado o falta stock.',
    icon: '⚠️',
  },
  {
    id: 'count_done',
    label: 'Conteo Listo',
    text: 'Ya terminé de auditar y contar este sector.',
    icon: '✅',
  },
  {
    id: 'where_box',
    label: '¿A dónde llevar?',
    text: '¿A qué estante o ubicación debo llevar este material?',
    icon: '📦',
  },
  {
    id: 'one_moment',
    label: 'Un momento',
    text: 'Un momento por favor, estoy verificando.',
    icon: '⏳',
  },
  {
    id: 'confirm_yes',
    label: 'Sí, correcto',
    text: 'Sí, está todo correcto.',
    icon: '👍',
  },
  {
    id: 'confirm_no',
    label: 'No',
    text: 'No, gracias.',
    icon: '👎',
  },
];

class AccessibleSpeechService {
  private isSpeakingState: boolean = false;
  private onStateChangeListeners: ((isSpeaking: boolean) => void)[] = [];

  public subscribeState(listener: (isSpeaking: boolean) => void): () => void {
    this.onStateChangeListeners.push(listener);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
    };
  }

  private notifyState(isSpeaking: boolean): void {
    this.isSpeakingState = isSpeaking;
    this.onStateChangeListeners.forEach((l) => l(isSpeaking));
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  /**
   * Pronuncia un texto en voz alta en español utilizando Web Speech API
   */
  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.warn('Síntesis de voz no disponible en este navegador');
        resolve();
        return;
      }

      if (!text || text.trim() === '') {
        resolve();
        return;
      }

      const synth = window.speechSynthesis;
      synth.cancel(); // Detener cualquier alocución previa

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'es-AR';
      utterance.rate = 0.95; // Velocidad ligeramente pausada para máxima claridad en altavoces
      utterance.pitch = 1.0;

      // Buscar voz en español disponible en el sistema (Windows / Tobii)
      const voices = synth.getVoices();
      const spanishVoice =
        voices.find((v) => v.lang.startsWith('es-AR')) ||
        voices.find((v) => v.lang.startsWith('es-')) ||
        voices.find((v) => v.lang.includes('es') || v.name.toLowerCase().includes('spanish'));

      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onstart = () => {
        this.notifyState(true);
      };

      utterance.onend = () => {
        this.notifyState(false);
        resolve();
      };

      utterance.onerror = () => {
        this.notifyState(false);
        resolve();
      };

      synth.speak(utterance);
    });
  }

  /**
   * Detiene cualquier voz activa inmediatamente
   */
  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.notifyState(false);
    }
  }
}

export const accessibleSpeech = new AccessibleSpeechService();
