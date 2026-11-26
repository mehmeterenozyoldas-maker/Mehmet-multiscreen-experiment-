import {
  computeLocalSingularityOffset,
  computePeerLinks,
  computeWorldBounds,
  normalizeMinimapNodes,
  pruneStalePeers,
} from '../engine/spatialSync';
import type {
  HandGesture,
  InteractionMode,
  MinimapNode,
  PeerLink,
  SingularityOffset,
  WindowRect,
  WorldBounds,
} from '../engine/types';

const CHANNEL_NAME = 'neural-singularity-spatial-v1';

type SyncMessage =
  | { type: 'STATE'; payload: WindowRect }
  | { type: 'SHOCKWAVE'; payload: { senderId: string; x: number; y: number; energy: number } }
  | { type: 'GOODBYE'; payload: { id: string } };

export interface SpatialSnapshot {
  self: WindowRect;
  peers: Record<string, WindowRect>;
  bounds: WorldBounds;
  offset: SingularityOffset;
  links: PeerLink[];
  minimapNodes: MinimapNode[];
}

export class WindowSyncChannel {
  public readonly id: string;
  private channel: BroadcastChannel | null = null;
  private peers: Record<string, WindowRect> = {};
  private mode: InteractionMode = 'GRAVITY';
  private gesture: HandGesture = 'NONE';
  private pointerX = 0;
  private pointerY = 0;
  private intervalId: number | null = null;
  private onShockwaveCb: ((x: number, y: number, energy: number) => void) | null = null;
  private onChangeCb: ((snapshot: SpatialSnapshot) => void) | null = null;

  constructor() {
    this.id = `node-${Math.random().toString(36).slice(2, 7)}`;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = this.handleMessage;
    }
    window.addEventListener('resize', this.handleWindowEvent);
    window.addEventListener('beforeunload', this.handleUnload);
    this.intervalId = window.setInterval(this.tickBroadcast, 45);
    this.tickBroadcast();
  }

  public onShockwave(cb: (x: number, y: number, energy: number) => void) {
    this.onShockwaveCb = cb;
  }

  public onChange(cb: (snapshot: SpatialSnapshot) => void) {
    this.onChangeCb = cb;
  }

  public setLocalInteraction(mode: InteractionMode, gesture: HandGesture, pointerX: number, pointerY: number) {
    this.mode = mode;
    this.gesture = gesture;
    this.pointerX = pointerX;
    this.pointerY = pointerY;
  }

  public broadcastShockwave(x: number, y: number, energy = 1.0) {
    if (!this.channel) return;
    const msg: SyncMessage = {
      type: 'SHOCKWAVE',
      payload: { senderId: this.id, x, y, energy },
    };
    this.channel.postMessage(msg);
  }

  public getSelfRect(): WindowRect {
    return {
      id: this.id,
      x: typeof window.screenX === 'number' ? window.screenX : 0,
      y: typeof window.screenY === 'number' ? window.screenY : 0,
      w: Math.max(1, window.innerWidth),
      h: Math.max(1, window.innerHeight),
      updatedAt: Date.now(),
      mode: this.mode,
      gesture: this.gesture,
      pointerX: this.pointerX,
      pointerY: this.pointerY,
    };
  }

  public getSnapshot(): SpatialSnapshot {
    const now = Date.now();
    this.peers = pruneStalePeers(this.peers, now);
    const self = this.getSelfRect();
    const bounds = computeWorldBounds(self, this.peers);
    const offset = computeLocalSingularityOffset(self, bounds, 0.0085);
    const links = computePeerLinks(self, this.peers, 0.0085);
    const minimapNodes = normalizeMinimapNodes(self, this.peers, bounds);

    return {
      self,
      peers: this.peers,
      bounds,
      offset,
      links,
      minimapNodes,
    };
  }

  public spawnSiblingWindow(): boolean {
    const w = Math.min(760, Math.max(520, Math.round(window.innerWidth * 0.62)));
    const h = Math.min(640, Math.max(460, Math.round(window.innerHeight * 0.68)));
    const left = Math.round((window.screenX || 80) + 180);
    const top = Math.round((window.screenY || 80) + 90);
    const features = `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
    const child = window.open(window.location.href, `singularity_${Date.now()}`, features);
    return child !== null;
  }

  private handleMessage = (event: MessageEvent<SyncMessage>) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'STATE') {
      if (data.payload.id === this.id) return;
      this.peers[data.payload.id] = data.payload;
      this.onChangeCb?.(this.getSnapshot());
    } else if (data.type === 'SHOCKWAVE') {
      if (data.payload.senderId === this.id) return;
      this.onShockwaveCb?.(data.payload.x, data.payload.y, data.payload.energy);
    } else if (data.type === 'GOODBYE') {
      delete this.peers[data.payload.id];
      this.onChangeCb?.(this.getSnapshot());
    }
  };

  private handleWindowEvent = () => {
    this.tickBroadcast();
  };

  private tickBroadcast = () => {
    const now = Date.now();
    this.peers = pruneStalePeers(this.peers, now);
    const self = this.getSelfRect();
    if (this.channel) {
      const msg: SyncMessage = { type: 'STATE', payload: self };
      this.channel.postMessage(msg);
    }
    this.onChangeCb?.(this.getSnapshot());
  };

  private handleUnload = () => {
    if (this.channel) {
      const msg: SyncMessage = { type: 'GOODBYE', payload: { id: this.id } };
      this.channel.postMessage(msg);
    }
  };

  public dispose() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    window.removeEventListener('resize', this.handleWindowEvent);
    window.removeEventListener('beforeunload', this.handleUnload);
    this.handleUnload();
    this.channel?.close();
    this.channel = null;
  }
}
