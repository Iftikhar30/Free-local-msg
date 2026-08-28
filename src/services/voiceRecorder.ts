import { playRecordStartSound, playRecordStopSound } from "./sound";

export interface RecordingResult {
  blob: Blob;
  duration: number; // in seconds
  mimeType: string;
  waveformData: number[];
}

export class VoiceRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private waveformSamples: number[] = [];
  private sampleInterval: any = null;

  public async startRecording(onVolumeTick?: (volume: number) => void): Promise<boolean> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Audio analysis for real-time waveform
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
        this.sourceNode.connect(this.analyser);

        this.waveformSamples = [];
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        this.sampleInterval = setInterval(() => {
          if (this.analyser) {
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            const normalized = Math.min(100, Math.max(10, Math.round((avg / 255) * 100)));
            this.waveformSamples.push(normalized);
            if (onVolumeTick) {
              onVolumeTick(normalized);
            }
          }
        }, 150);
      } catch (e) {
        console.warn("AudioContext visualizer not supported:", e);
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.audioStream, { mimeType })
        : new MediaRecorder(this.audioStream);

      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      playRecordStartSound();
      return true;
    } catch (err) {
      console.error("Microphone access failed:", err);
      this.cleanup();
      alert("Microphone permission is required to record voice messages.");
      return false;
    }
  }

  public async stopRecording(): Promise<RecordingResult | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        this.cleanup();
        resolve(null);
        return;
      }

      playRecordStopSound();

      this.mediaRecorder.onstop = () => {
        const durationSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.audioChunks, { type: mimeType });

        // Downsample waveform to 24 uniform bars
        const sampledWaveform = this.normalizeWaveform(this.waveformSamples, 24);

        this.cleanup();
        resolve({
          blob,
          duration: durationSec,
          mimeType,
          waveformData: sampledWaveform,
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  public cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanup();
  }

  private normalizeWaveform(raw: number[], targetBars = 24): number[] {
    if (!raw || raw.length === 0) {
      return Array(targetBars).fill(25);
    }

    if (raw.length <= targetBars) {
      const padded = [...raw];
      while (padded.length < targetBars) {
        padded.push(20 + Math.floor(Math.random() * 20));
      }
      return padded;
    }

    const result: number[] = [];
    const step = raw.length / targetBars;
    for (let i = 0; i < targetBars; i++) {
      const idx = Math.floor(i * step);
      result.push(raw[idx] || 25);
    }
    return result;
  }

  private cleanup(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
