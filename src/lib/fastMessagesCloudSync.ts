/*
 * Fast Messages Cloud Sync
 *
 * Persists the user's Fast Messages list as a hidden pinned message inside
 * the user's own "Saved Messages" chat so that the list follows them across
 * devices.
 *
 * On startup, after the app has authenticated, we read the pinned messages of
 * Saved Messages and look for a marker text that we wrote ourselves. If we
 * find it, we hydrate the local store with the cloud copy. Whenever the local
 * list changes after that we (debounced) write a fresh marker message, pin it
 * silently, and delete any older marker messages so that only one copy lives
 * in the chat at a time.
 */

import {createEffect, createRoot, on} from 'solid-js';
import {unwrap} from 'solid-js/store';
import rootScope from '@lib/rootScope';
import {useAppSettings} from '@stores/appSettings';
import type {Message} from '@layer';
import type {FastMessageRule} from '@config/state';
import {normaliseFastMessages} from './fastMessagesUtils';

const MARKER_PREFIX_V1 = '[TWEB_FAST_MSG_SYNC_v1]';
const MARKER_PREFIX_V2 = '[TWEB_FAST_MSG_SYNC_v2]';
const MARKER_HEADER = '🔒 TWeb Fast Messages Sync (do not edit)';
const SAVE_DEBOUNCE_MS = 3000;
const MAX_PINNED_TO_SCAN = 50;

type CloudPayload = {
  v: 2;
  updatedAt: number;
  messages: FastMessageRule[];
};

let initialized = false;
let applyingRemoteUpdate = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveInFlight: Promise<void> | undefined;
let lastSyncedJson: string | undefined;

const log = (...args: any[]) => {
  // Keep logs quiet but available when debugging from the console.
  // eslint-disable-next-line no-console
  console.debug('[fast-messages-sync]', ...args);
};

const buildMarkerText = (messages: FastMessageRule[]): string => {
  const payload: CloudPayload = {
    v: 2,
    updatedAt: Date.now(),
    messages
  };
  return `${MARKER_HEADER}\n${MARKER_PREFIX_V2}\n${JSON.stringify(payload)}`;
};

const tryParseMarker = (text: string | undefined | null): CloudPayload | undefined => {
  if(!text) return undefined;

  // Newest format: v2 (Trigger / Reply / Match objects).
  let idx = text.indexOf(MARKER_PREFIX_V2);
  if(idx !== -1) {
    const jsonPart = text.slice(idx + MARKER_PREFIX_V2.length).trim();
    if(!jsonPart) return undefined;
    try {
      const parsed = JSON.parse(jsonPart);
      const messages = normaliseFastMessages(parsed?.messages);
      return {
        v: 2,
        updatedAt: Number(parsed?.updatedAt) || 0,
        messages
      };
    } catch(err) {
      log('failed to parse v2 marker payload', err);
    }
    return undefined;
  }

  // Legacy v1 (string[] of replies) — coerce into rule objects.
  idx = text.indexOf(MARKER_PREFIX_V1);
  if(idx !== -1) {
    const jsonPart = text.slice(idx + MARKER_PREFIX_V1.length).trim();
    if(!jsonPart) return undefined;
    try {
      const parsed = JSON.parse(jsonPart);
      const messages = normaliseFastMessages(parsed?.messages);
      return {
        v: 2,
        updatedAt: Number(parsed?.updatedAt) || 0,
        messages
      };
    } catch(err) {
      log('failed to parse v1 marker payload', err);
    }
  }
  return undefined;
};

const rulesEqual = (a: FastMessageRule[], b: FastMessageRule[]): boolean => {
  if(a === b) return true;
  if(a.length !== b.length) return false;
  for(let i = 0; i < a.length; i++) {
    if(a[i].trigger !== b[i].trigger) return false;
    if(a[i].reply !== b[i].reply) return false;
    if(a[i].match !== b[i].match) return false;
  }
  return true;
};

const findMarkerMessagesInSaved = async(myPeerId: PeerId): Promise<{
  markers: {mid: number, payload: CloudPayload}[],
  pinnedMids: number[]
}> => {
  const result: any = await rootScope.managers.appMessagesManager.getHistory({
    peerId: myPeerId,
    inputFilter: {_: 'inputMessagesFilterPinned'},
    offsetId: 0,
    limit: MAX_PINNED_TO_SCAN
  }).catch((err: unknown): undefined => {
    log('failed to fetch pinned history', err);
    return undefined;
  });

  const markers: {mid: number, payload: CloudPayload}[] = [];
  const pinnedMids: number[] = [];

  if(!result?.history?.length) {
    return {markers, pinnedMids};
  }

  for(const mid of result.history as number[]) {
    pinnedMids.push(mid);
    const message = await rootScope.managers.appMessagesManager
      .getMessageByPeer(myPeerId, mid)
      .catch((): undefined => undefined);
    const text = (message as Message.message | undefined)?.message;
    const payload = tryParseMarker(text);
    if(payload) {
      markers.push({mid, payload});
    }
  }

  return {markers, pinnedMids};
};

/**
 * Pull the latest fast messages from the cloud (if any) and apply them locally.
 * Returns true if cloud data was applied.
 */
const pullFromCloud = async(): Promise<boolean> => {
  const myPeerId = rootScope.myId;
  if(!myPeerId) return false;

  const {markers} = await findMarkerMessagesInSaved(myPeerId);
  if(!markers.length) return false;

  // Pick the freshest marker by `updatedAt`.
  markers.sort((a, b) => (b.payload.updatedAt ?? 0) - (a.payload.updatedAt ?? 0));
  const winner = markers[0];

  const [appSettings, setAppSettings] = useAppSettings();
  const local = normaliseFastMessages(appSettings.fastMessages);
  const remote = winner.payload.messages;

  if(rulesEqual(local, remote)) {
    lastSyncedJson = JSON.stringify(remote);
    return true;
  }

  applyingRemoteUpdate = true;
  try {
    setAppSettings('fastMessages', remote);
  } finally {
    // The createEffect runs synchronously after setStore, so the flag will be
    // observed during the resulting effect run and then we reset it.
    queueMicrotask(() => { applyingRemoteUpdate = false; });
  }

  lastSyncedJson = JSON.stringify(remote);
  log('applied cloud fast messages', remote.length);
  return true;
};

const performSave = async(messages: FastMessageRule[]): Promise<void> => {
  const myPeerId = rootScope.myId;
  if(!myPeerId) return;

  const json = JSON.stringify(messages);
  if(json === lastSyncedJson) return;

  const text = buildMarkerText(messages);

  // Snapshot existing markers first so we can clean them up after pinning the
  // new one.
  const before = await findMarkerMessagesInSaved(myPeerId)
    .catch((): undefined => undefined);
  const existingMarkerMids = before?.markers.map((m: {mid: number}) => m.mid) ?? [];

  // Send the new marker to Saved Messages silently.
  await rootScope.managers.appMessagesManager.sendText({
    peerId: myPeerId,
    text,
    silent: true
  });

  // sendText resolves before the message has a server id; poll briefly for our
  // freshly-sent marker to appear in the pinned/recent history.
  const newMid = await waitForOurMarker(myPeerId, json, existingMarkerMids);
  if(!newMid) {
    log('could not locate freshly-sent marker; skipping pin/cleanup');
    lastSyncedJson = json; // avoid hammering the API on repeat failures
    return;
  }

  // Pin the new marker silently so it does not trigger a notification.
  await rootScope.managers.appMessagesManager
    .updatePinnedMessage(myPeerId, newMid, false, true)
    .catch((err: unknown): void => log('pin failed', err));

  // Remove the older markers entirely so only one copy lives in the chat.
  if(existingMarkerMids.length) {
    await rootScope.managers.appMessagesManager
      .deleteMessages(myPeerId, existingMarkerMids, true)
      .catch((err: unknown): void => log('cleanup of old markers failed', err));
  }

  lastSyncedJson = json;
  log('saved fast messages to cloud', messages.length, 'mid', newMid);
};

const waitForOurMarker = async(
  myPeerId: PeerId,
  expectedJson: string,
  excludeMids: number[]
): Promise<number | undefined> => {
  const exclude = new Set(excludeMids);
  for(let attempt = 0; attempt < 6; attempt++) {
    // Wait a bit for the server round-trip; first wait is short.
    await new Promise((r) => setTimeout(r, attempt === 0 ? 300 : 700));

    // Look in recent history (cheaper than re-running the pinned filter).
    const recent: any = await rootScope.managers.appMessagesManager.getHistory({
      peerId: myPeerId,
      offsetId: 0,
      limit: 20
    }).catch((): undefined => undefined);

    const mids: number[] = recent?.history ?? [];
    for(const mid of mids) {
      if(exclude.has(mid)) continue;
      const message = await rootScope.managers.appMessagesManager
        .getMessageByPeer(myPeerId, mid)
        .catch((): undefined => undefined);
      const payload = tryParseMarker((message as Message.message | undefined)?.message);
      if(!payload) continue;
      if(JSON.stringify(payload.messages) === expectedJson) {
        return mid;
      }
    }
  }
  return undefined;
};

const scheduleSave = (messages: FastMessageRule[]) => {
  if(saveTimer) clearTimeout(saveTimer);
  const snapshot = messages.map((m) => ({...m}));
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    // Serialise saves so concurrent updates don't race.
    saveInFlight = (saveInFlight ?? Promise.resolve())
      .then(() => performSave(snapshot))
      .catch((err) => log('save failed', err));
  }, SAVE_DEBOUNCE_MS);
};

/**
 * Wire the cloud sync to the appSettings store. Safe to call multiple times.
 */
export const initFastMessagesCloudSync = () => {
  if(initialized) return;
  initialized = true;

  const [appSettings] = useAppSettings();

  // Kick off an initial pull. We don't block any UI on this; if it fails we
  // simply keep the local copy.
  pullFromCloud().catch((err) => log('initial pull failed', err));

  // Watch for local changes and push them to the cloud (debounced). Skip the
  // emission triggered by our own remote-apply.
  createRoot(() => {
    createEffect(on(() => unwrap(appSettings.fastMessages), (messages) => {
      if(!Array.isArray(messages)) return;
      if(applyingRemoteUpdate) return;
      const normalised = normaliseFastMessages(messages);
      const json = JSON.stringify(normalised);
      if(json === lastSyncedJson) return;
      scheduleSave(normalised);
    }, {defer: true}));
  });
};

export default initFastMessagesCloudSync;
