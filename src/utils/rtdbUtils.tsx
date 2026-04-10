import { ref, onValue, off, DataSnapshot, set, get } from 'firebase/database';
import { rtdb } from '../config/firebaseConfig';

export interface LocationData {
  latitude: string;
  longitude: string;
  timestamp?: number;
}

/**
 * Attaches a real-time listener to the most recent location of a box.
 * Returns an unsubscribe function.
 */
export const listenToRecentLocation = (
    boxId: string,
    callback: (locationData: LocationData | null) => void
): (() => void) => {
  const boxRef = ref(rtdb, `boxes/data/${boxId}`);

  const handleSnapshot = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    let mostRecent: LocationData | null = null;
    let maxTimestamp = -1;

    snapshot.forEach(child => {
      const data = child.val() as LocationData | null;
      if (data) {
        // Prefer explicit timestamp; fall back to insertion order (last wins)
        const ts = data.timestamp ?? maxTimestamp + 1;
        if (ts >= maxTimestamp) {
          maxTimestamp = ts;
          mostRecent = data;
        }
      }
    });

    callback(mostRecent);
  };

  onValue(boxRef, handleSnapshot, err => {
    console.error('[listenToRecentLocation] RTDB error:', err);
  });

  return () => off(boxRef);
};

/**
 * One-time read of a box's most recent location.
 */
export const getRecentLocation = async (boxId: string): Promise<LocationData | null> => {
  const snap = await get(ref(rtdb, `boxes/data/${boxId}`));
  if (!snap.exists()) return null;

  let mostRecent: LocationData | null = null;
  let maxTs = -1;

  snap.forEach(child => {
    const data = child.val() as LocationData | null;
    if (data) {
      const ts = data.timestamp ?? maxTs + 1;
      if (ts >= maxTs) { maxTs = ts; mostRecent = data; }
    }
  });

  return mostRecent;
};

/**
 * Update the open/closed status of a box.
 * `status = true`  → open
 * `status = false` → closed
 */
export const updateBoxStatus = (boxId: string, status: boolean): void => {
  if (!boxId) return;
  const statusRef = ref(rtdb, `statuses/${boxId}/status`);
  set(statusRef, status)
      .then(() => console.log(`[RTDB] Box ${boxId} status → ${status}`))
      .catch(err => console.error('[updateBoxStatus] Error:', err));
};

/**
 * Attaches a real-time listener to a box's open/closed status.
 * Returns an unsubscribe function.
 */
export const listenToBoxStatus = (
    boxId: string,
    callback: (status: boolean | null) => void
): (() => void) => {
  if (!boxId) {
    callback(null);
    return () => {};
  }
  const statusRef = ref(rtdb, `statuses/${boxId}/status`);
  onValue(statusRef, snap => {
    callback(snap.exists() ? (snap.val() as boolean) : null);
  });
  return () => off(statusRef);
};