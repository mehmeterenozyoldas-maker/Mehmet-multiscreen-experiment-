import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandGesture, InteractionMode, VisionState } from '../engine/types';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class UnifiedVisionTracker {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private activeMode: InteractionMode = 'GRAVITY';
  private rafId: number | null = null;
  private lastInferTime = 0;
  private isDisposed = false;
  private state: VisionState = {
    status: 'idle',
    errorMessage: null,
    emitterX: 0,
    emitterY: 0,
    blowStrength: 0,
    handGesture: 'NONE',
    handEnergy: 0,
    detectedHands: 0,
  };
  private onStateCb: ((state: VisionState) => void) | null = null;

  public onStateChange(cb: (state: VisionState) => void) {
    this.onStateCb = cb;
  }

  public getState(): VisionState {
    return this.state;
  }

  public async setMode(mode: InteractionMode): Promise<void> {
    this.activeMode = mode;

    if (mode === 'GRAVITY') {
      this.stopLoop();
      this.releaseStream();
      this.updateState({
        status: 'idle',
        errorMessage: null,
        blowStrength: 0,
        handGesture: 'NONE',
        handEnergy: 0,
        detectedHands: 0,
      });
      return;
    }

    await this.ensureStreamAndModel(mode);
  }

  private async ensureStreamAndModel(mode: 'WIND' | 'HAND') {
    if (this.isDisposed) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.updateState({
        status: 'unavailable',
        errorMessage: 'Camera API is unavailable in this browser context. Using mouse gravity.',
      });
      return;
    }

    this.updateState({ status: 'starting', errorMessage: null });

    try {
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      }

      if (!this.video) {
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        video.srcObject = this.stream;
        await video.play();
        this.video = video;
      }

      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);

      if (mode === 'WIND' && !this.faceLandmarker) {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      }

      if (mode === 'HAND' && !this.handLandmarker) {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }

      if (this.isDisposed || this.activeMode === 'GRAVITY') return;

      this.updateState({ status: 'active', errorMessage: null });
      this.startLoop();
    } catch (err) {
      const msg =
        err instanceof Error && /Permission|NotAllowed/i.test(err.message)
          ? 'Camera access denied. Allow webcam permission or switch back to Gravity mode.'
          : 'Camera stream or vision model unavailable here. Mouse Gravity remains active.';
      this.releaseStream();
      this.updateState({
        status: err instanceof Error && /Permission|NotAllowed/i.test(err.message) ? 'denied' : 'unavailable',
        errorMessage: msg,
        blowStrength: 0,
        handGesture: 'NONE',
      });
    }
  }

  private startLoop() {
    if (this.rafId !== null) return;
    const step = (now: number) => {
      if (this.isDisposed || this.activeMode === 'GRAVITY') {
        this.rafId = null;
        return;
      }

      // Adaptive ~24Hz scheduler to keep 3D GPU render loop smooth
      if (now - this.lastInferTime >= 42 && this.video && this.video.readyState >= 2) {
        this.lastInferTime = now;
        this.runInference(now);
      }

      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private runInference(nowMs: number) {
    if (!this.video) return;

    if (this.activeMode === 'WIND' && this.faceLandmarker) {
      try {
        const res = this.faceLandmarker.detectForVideo(this.video, nowMs);
        const face = res.faceLandmarks?.[0];
        if (face && face.length > 291) {
          const nose = face[1];
          const upperLip = face[13];
          const lowerLip = face[14];
          const leftCorner = face[61];
          const rightCorner = face[291];

          const mouthOpen = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);
          const mouthWidth = Math.max(0.01, Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y));
          // Pucker / blow signature: moderate aperture with narrowed mouth width
          const aspect = mouthOpen / mouthWidth;
          const blowStrength = Math.min(1, Math.max(0, (aspect - 0.14) * 2.4));

          this.updateState({
            emitterX: (0.5 - nose.x) * 2,
            emitterY: (0.5 - nose.y) * 2,
            blowStrength,
            handGesture: 'NONE',
            handEnergy: blowStrength,
          });
        } else {
          this.updateState({ blowStrength: this.state.blowStrength * 0.85 });
        }
      } catch {
        // Ignore transient frame decode issues
      }
    } else if (this.activeMode === 'HAND' && this.handLandmarker) {
      try {
        const res = this.handLandmarker.detectForVideo(this.video, nowMs);
        const hands = res.landmarks ?? [];
        if (hands.length === 0) {
          this.updateState({
            handGesture: 'NONE',
            handEnergy: this.state.handEnergy * 0.85,
            detectedHands: 0,
          });
          return;
        }

        const primary = hands[0];
        const wrist = primary[0];
        const middleMcp = primary[9];
        const thumbTip = primary[4];
        const indexTip = primary[8];
        const pinkyTip = primary[20];

        const palmScale = Math.max(0.04, Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y));
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) / palmScale;
        const spreadDist = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y) / palmScale;

        let gesture: HandGesture = 'PALM';
        let energy = 0.55;

        if (hands.length >= 2) {
          const second = hands[1];
          const twoHandGap = Math.hypot(primary[9].x - second[9].x, primary[9].y - second[9].y);
          if (twoHandGap > 0.42) {
            gesture = 'SPREAD';
            energy = Math.min(1, (twoHandGap - 0.3) * 2.2);
          }
        }

        if (gesture !== 'SPREAD') {
          if (pinchDist < 0.38) {
            gesture = 'PINCH';
            energy = Math.min(1, 0.7 + (0.38 - pinchDist) * 1.2);
          } else if (spreadDist > 1.1) {
            gesture = 'PALM';
            energy = Math.min(1, spreadDist * 0.55);
          }
        }

        this.updateState({
          emitterX: (0.5 - middleMcp.x) * 2,
          emitterY: (0.5 - middleMcp.y) * 2,
          handGesture: gesture,
          handEnergy: energy,
          detectedHands: hands.length,
          blowStrength: 0,
        });
      } catch {
        // Ignore transient frame decode issues
      }
    }
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private releaseStream() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private updateState(patch: Partial<VisionState>) {
    this.state = { ...this.state, ...patch };
    this.onStateCb?.(this.state);
  }

  public dispose() {
    this.isDisposed = true;
    this.stopLoop();
    this.releaseStream();
    this.faceLandmarker?.close();
    this.handLandmarker?.close();
    this.faceLandmarker = null;
    this.handLandmarker = null;
  }
}
