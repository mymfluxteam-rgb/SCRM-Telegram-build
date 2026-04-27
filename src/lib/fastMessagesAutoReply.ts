/*
 * Fast Messages — Quick Auto Reply
 *
 * When the "Quick Auto Reply" toggle in the Fast Messages sidebar is on, this
 * module listens for incoming messages and, if the message text contains one
 * of the user's saved Fast Messages (case-insensitive), automatically replies
 * with that same Fast Message.
 *
 * Loop prevention:
 *   - Outgoing messages (`pFlags.out`) are ignored.
 *   - Service messages and messages without text are ignored.
 *   - Messages from the current user (Saved Messages, other devices) are
 *     ignored so the sync marker / our own auto-reply cannot retrigger it.
 *   - Each peer is throttled (one auto-reply per `THROTTLE_MS` window).
 *   - Messages we just auto-replied with are remembered for a short window so
 *     that an echo from the other side does not fire again.
 */

import type {Message} from '../layer';
import rootScope from './rootScope';
import {appSettings} from '@stores/appSettings';

const THROTTLE_MS = 30_000;
const RECENT_REPLY_TTL_MS = 60_000;

let initialized = false;

const lastReplyAt = new Map<PeerId, number>();
const recentReplies = new Map<string, number>(); // normalised text -> timestamp

const now = () => Date.now();

const normalise = (text: string) =>
  text.toLowerCase().replace(/\s+/g, ' ').trim();

const pruneRecentReplies = () => {
  const cutoff = now() - RECENT_REPLY_TTL_MS;
  for(const [text, ts] of recentReplies) {
    if(ts < cutoff) recentReplies.delete(text);
  }
};

const findMatch = (incoming: string): string | undefined => {
  const list = appSettings.fastMessages ?? [];
  if(!list.length) return undefined;

  const haystack = normalise(incoming);
  if(!haystack) return undefined;

  // Prefer the longest matching phrase so a generic short phrase does not
  // shadow a more specific one.
  let best: string | undefined;
  let bestLen = 0;
  for(const phrase of list) {
    const needle = normalise(phrase);
    if(!needle) continue;
    if(haystack === needle || haystack.includes(needle)) {
      if(needle.length > bestLen) {
        best = phrase;
        bestLen = needle.length;
      }
    }
  }
  return best;
};

const handleIncoming = async(message: Message.message | Message.messageService) => {
  if(!appSettings.autoReply) return;
  if(message._ !== 'message') return;
  if(message.pFlags?.out) return;

  const text = message.message;
  if(!text || typeof text !== 'string') return;

  const peerId = message.peerId;
  if(!peerId) return;

  // Never auto-reply in our own Saved Messages chat — that is where the
  // cloud-sync marker lives, and we should not talk to ourselves.
  if(peerId === rootScope.myId) return;

  // Ignore messages we apparently sent from another device (defensive).
  if(message.fromId === rootScope.myId) return;

  // Throttle per peer.
  const last = lastReplyAt.get(peerId) ?? 0;
  if(now() - last < THROTTLE_MS) return;

  pruneRecentReplies();

  // If this incoming text is something we recently auto-sent (i.e. the other
  // side echoed our reply back), skip to break any potential loop.
  const incomingNorm = normalise(text);
  if(recentReplies.has(incomingNorm)) return;

  const reply = findMatch(text);
  if(!reply) return;

  lastReplyAt.set(peerId, now());
  recentReplies.set(normalise(reply), now());

  try {
    await rootScope.managers.appMessagesManager.sendText({
      peerId,
      text: reply
    });
  } catch(err) {
    // Swallow errors so a single failed send cannot break the listener.
    console.warn('[fastMessagesAutoReply] sendText failed', err);
  }
};

export const initFastMessagesAutoReply = () => {
  if(initialized) return;
  initialized = true;

  rootScope.addEventListener('history_multiappend', (message) => {
    // Run asynchronously so the event dispatch is never blocked.
    void handleIncoming(message as Message.message | Message.messageService);
  });
};

export default initFastMessagesAutoReply;
