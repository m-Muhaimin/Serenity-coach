/**
 * Utility for PCM audio processing for Gemini Live API
 */

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private sampleRate: number = 16000) {}

  async start(onAudioData: (base64Data: string) => void) {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Using ScriptProcessorNode for simplicity in this environment, 
    // though AudioWorklet is preferred in modern apps.
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.floatTo16BitPCM(inputData);
      const base64Data = this.arrayBufferToBase64(pcmData);
      onAudioData(base64Data);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;

  constructor(private sampleRate: number = 24000) {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
  }

  playChunk(base64Data: string) {
    if (!this.audioContext) return;

    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, floatData.length, this.sampleRate);
    buffer.getChannelData(0).set(floatData);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  stop() {
    this.audioContext?.close();
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.nextStartTime = 0;
  }
}
