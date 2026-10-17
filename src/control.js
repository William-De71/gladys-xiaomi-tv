// -----------------------------------------------------------------------------
// Commands that take more than one request.
//
//   setVolume   the TV has no "set volume" request usable without its
//               private signature: the volume keys are pressed in bursts,
//               the volume read back after each burst, until the target is
//               reached (or passed: a key may move more than one step, the
//               first press tells how many)
//   sendKeys    a sequence of keys with a pause between them (a menu needs
//               time to open)
// -----------------------------------------------------------------------------

import { KEYS, TvError } from './mitv/client.js';

const BURST = 5;
const KEY_SPACING_MS = 120;
const MAX_PRESSES = 150;
const MAX_STALLS = 2;
export const MAX_SEQUENCE = 30;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description Bring the volume to a target with the volume keys.
 * @param {object} client - src/mitv/client.js client.
 * @param {string} host - Address of the TV.
 * @param {number} target - Wanted volume.
 * @param {object} [deps] - `{ sleep, spacingMs }` (tests).
 * @returns {Promise<number>} The volume reached.
 * @throws {Error} When the volume does not move (TV in standby, muted input).
 */
export async function setVolume(
  client,
  host,
  target,
  { sleep = defaultSleep, spacingMs = KEY_SPACING_MS } = {},
) {
  let { volume } = await client.getVolume(host);
  let presses = 0;
  let stalls = 0;
  // Volume change of one press, learnt from the first one (1 or more).
  let step = null;
  const up = target > volume;
  while (volume !== target && presses < MAX_PRESSES) {
    const remaining = Math.abs(target - volume);
    const wanted = step === null ? 1 : Math.max(1, Math.round(remaining / step));
    const burst = Math.min(BURST, wanted, MAX_PRESSES - presses);
    for (let index = 0; index < burst; index += 1) {
      await client.key(host, up ? 'volumeup' : 'volumedown');
      presses += 1;
      await sleep(spacingMs);
    }
    const before = volume;
    ({ volume } = await client.getVolume(host));
    // Passed the target: a key moves more than one step on this TV.
    if (up ? volume >= target : volume <= target) {
      break;
    }
    if (volume !== before && step === null) {
      step = Math.max(1, Math.abs(volume - before) / burst);
    }
    if (volume === before) {
      stalls += 1;
      if (stalls >= MAX_STALLS) {
        throw new TvError('the volume does not change');
      }
    } else {
      stalls = 0;
    }
  }
  return volume;
}

/**
 * @description Parse a key sequence typed in a scene.
 * @param {string} value - `home, down, down, enter`.
 * @returns {string[]} The keys.
 * @throws {RangeError} On an unknown key or a too long sequence.
 */
export function parseKeys(value) {
  const keys = String(value ?? '')
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((key) => key.replace(/[^a-z]/g, ''));
  const unknown = keys.find((key) => !KEYS.includes(key));
  if (unknown !== undefined) {
    throw new RangeError(unknown);
  }
  if (keys.length === 0 || keys.length > MAX_SEQUENCE) {
    throw new RangeError(String(keys.length));
  }
  return keys;
}

/**
 * @description Send keys one after the other.
 * @param {object} client - src/mitv/client.js client.
 * @param {string} host - Address of the TV.
 * @param {string[]} keys - Keys of the TV.
 * @param {number} delayMs - Pause between two keys.
 * @param {object} [deps] - `{ sleep }` (tests).
 * @returns {Promise<number>} Number of keys sent.
 */
export async function sendKeys(client, host, keys, delayMs, { sleep = defaultSleep } = {}) {
  for (const [index, key] of keys.entries()) {
    if (index > 0) {
      await sleep(delayMs);
    }
    await client.key(host, key);
  }
  return keys.length;
}
