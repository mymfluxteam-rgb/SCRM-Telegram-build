/*
 * Shared helpers for the Fast Messages feature.
 *
 * The list used to be a `string[]` of reply texts. It is now a list of
 * { trigger, reply, match } rules so the auto-reply engine can match on a
 * separate keyword. These helpers normalise legacy values and provide the
 * matching logic used by the engine.
 */

import type {FastMessageMatchMode, FastMessageRule} from '@config/state';

const VALID_MODES: ReadonlySet<FastMessageMatchMode> = new Set([
  'exact',
  'contains',
  'startsWith'
]);

/**
 * Coerce any stored value (legacy string, partial object, etc.) into a
 * fully-formed FastMessageRule. Falls back to `contains` on the reply text
 * when no trigger has been provided so legacy entries keep working.
 */
export const normaliseFastMessage = (raw: unknown): FastMessageRule | undefined => {
  if(typeof raw === 'string') {
    const reply = raw;
    if(!reply.trim()) return undefined;
    return {trigger: '', reply, match: 'contains'};
  }
  if(raw && typeof raw === 'object') {
    const r = raw as Partial<FastMessageRule>;
    const reply = typeof r.reply === 'string' ? r.reply : '';
    if(!reply) return undefined;
    const trigger = typeof r.trigger === 'string' ? r.trigger : '';
    const match: FastMessageMatchMode =
      r.match && VALID_MODES.has(r.match) ? r.match : 'contains';
    return {trigger, reply, match};
  }
  return undefined;
};

export const normaliseFastMessages = (raw: unknown): FastMessageRule[] => {
  if(!Array.isArray(raw)) return [];
  const out: FastMessageRule[] = [];
  for(const item of raw) {
    const n = normaliseFastMessage(item);
    if(n) out.push(n);
  }
  return out;
};

const collapse = (s: string) =>
  s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Returns true if `incoming` matches the rule's trigger according to its mode.
 * Falls back to using the reply text as the trigger when the rule has none.
 */
export const ruleMatches = (rule: FastMessageRule, incoming: string): boolean => {
  const haystack = collapse(incoming);
  const needle = collapse(rule.trigger || rule.reply);
  if(!haystack || !needle) return false;
  switch(rule.match) {
    case 'exact':      return haystack === needle;
    case 'startsWith': return haystack.startsWith(needle);
    case 'contains':
    default:           return haystack.includes(needle);
  }
};

/**
 * Find the best rule that matches the incoming text. Longer needles win so a
 * generic short keyword does not shadow a more specific one.
 */
export const findMatchingRule = (
  rules: FastMessageRule[],
  incoming: string
): FastMessageRule | undefined => {
  let best: FastMessageRule | undefined;
  let bestLen = -1;
  for(const rule of rules) {
    if(!ruleMatches(rule, incoming)) continue;
    const len = collapse(rule.trigger || rule.reply).length;
    if(len > bestLen) {
      best = rule;
      bestLen = len;
    }
  }
  return best;
};
