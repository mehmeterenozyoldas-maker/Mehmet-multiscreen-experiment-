import type {
  MinimapNode,
  PeerLink,
  SingularityOffset,
  WindowRect,
  WorldBounds,
} from './types';

export const PEER_STALE_MS = 2400;

export function pruneStalePeers(
  peers: Record<string, WindowRect>,
  now: number,
  staleMs = PEER_STALE_MS
): Record<string, WindowRect> {
  const active: Record<string, WindowRect> = {};
  for (const [id, peer] of Object.entries(peers)) {
    if (now - peer.updatedAt <= staleMs) {
      active[id] = peer;
    }
  }
  return active;
}

export function computeWorldBounds(
  self: WindowRect,
  peers: Record<string, WindowRect>
): WorldBounds {
  const all = [self, ...Object.values(peers)];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const win of all) {
    minX = Math.min(minX, win.x);
    minY = Math.min(minY, win.y);
    maxX = Math.max(maxX, win.x + win.w);
    maxY = Math.max(maxY, win.y + win.h);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width * 0.5,
    centerY: minY + height * 0.5,
    nodeCount: all.length,
  };
}

/**
 * Computes the offset in world-space units from the local window center
 * to the global multi-window singularity centroid.
 */
export function computeLocalSingularityOffset(
  self: WindowRect,
  bounds: WorldBounds,
  worldScalePerPixel = 0.012
): SingularityOffset {
  const selfCenterX = self.x + self.w * 0.5;
  const selfCenterY = self.y + self.h * 0.5;

  const pxDx = bounds.centerX - selfCenterX;
  const pxDy = bounds.centerY - selfCenterY;

  return {
    // Three.js Y is up, screen Y is down
    x: pxDx * worldScalePerPixel || 0,
    y: -pxDy * worldScalePerPixel || 0,
    normX: pxDx / Math.max(1, self.w) || 0,
    normY: -pxDy / Math.max(1, self.h) || 0,
  };
}

/**
 * Computes silk energy filament target vectors from the local window center
 * to each remote peer window center in Three.js world space.
 */
export function computePeerLinks(
  self: WindowRect,
  peers: Record<string, WindowRect>,
  worldScalePerPixel = 0.012
): PeerLink[] {
  const selfCenterX = self.x + self.w * 0.5;
  const selfCenterY = self.y + self.h * 0.5;

  return Object.values(peers).map((peer) => {
    const peerCenterX = peer.x + peer.w * 0.5;
    const peerCenterY = peer.y + peer.h * 0.5;
    const dx = (peerCenterX - selfCenterX) * worldScalePerPixel || 0;
    const dy = -(peerCenterY - selfCenterY) * worldScalePerPixel || 0;
    return {
      peerId: peer.id,
      dx,
      dy,
      distance: Math.hypot(dx, dy),
      gesture: peer.gesture,
    };
  });
}

/**
 * Normalizes all windows into percentage coordinates (0..100) for the Topology Minimap.
 */
export function normalizeMinimapNodes(
  self: WindowRect,
  peers: Record<string, WindowRect>,
  bounds: WorldBounds
): MinimapNode[] {
  const all = [self, ...Object.values(peers)];
  const padX = bounds.width * 0.08;
  const padY = bounds.height * 0.08;
  const spanX = bounds.width + padX * 2;
  const spanY = bounds.height + padY * 2;

  return all.map((win) => ({
    id: win.id,
    isSelf: win.id === self.id,
    leftPct: ((win.x - bounds.minX + padX) / spanX) * 100,
    topPct: ((win.y - bounds.minY + padY) / spanY) * 100,
    widthPct: Math.max(6, (win.w / spanX) * 100),
    heightPct: Math.max(6, (win.h / spanY) * 100),
    screenX: Math.round(win.x),
    screenY: Math.round(win.y),
    screenW: Math.round(win.w),
    screenH: Math.round(win.h),
    mode: win.mode,
  }));
}
