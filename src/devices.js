// -----------------------------------------------------------------------------
// Gladys side of a TV: the device published in the Discover tab and the
// values of its features.
//
//   power         television/binary: standby or on (assumed, see app.js)
//   volume        television/volume: 0 to the maximum of the TV
//   volume_up, volume_down, volume_mute, up, down, left, right, enter, menu,
//   back          remote keys: push buttons on the dashboard (Gladys shows
//                 every television feature but binary, volume and channel
//                 as a push button)
//
// The maximum volume is read from the TV when it is discovered, then kept:
// the Discover "Update" compares `max`, so it never changes afterwards.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { featureName } from './i18n.js';

export const DEFAULT_MAX_VOLUME = 100;

export const FEATURE_KEYS = {
  POWER: 'power',
  VOLUME: 'volume',
  VOLUME_UP: 'volume_up',
  VOLUME_DOWN: 'volume_down',
  VOLUME_MUTE: 'volume_mute',
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  ENTER: 'enter',
  MENU: 'menu',
  BACK: 'back',
};

// Feature key -> Gladys type and, for a plain key, the keycode of the TV.
export const REMOTE_KEYS = {
  [FEATURE_KEYS.VOLUME_UP]: { type: TYPES.TELEVISION.VOLUME_UP, keycode: 'volumeup' },
  [FEATURE_KEYS.VOLUME_DOWN]: { type: TYPES.TELEVISION.VOLUME_DOWN, keycode: 'volumedown' },
  // No mute key on the TV: the integration lowers the volume to 0 and back.
  [FEATURE_KEYS.VOLUME_MUTE]: { type: TYPES.TELEVISION.VOLUME_MUTE, keycode: null },
  [FEATURE_KEYS.UP]: { type: TYPES.TELEVISION.UP, keycode: 'up' },
  [FEATURE_KEYS.DOWN]: { type: TYPES.TELEVISION.DOWN, keycode: 'down' },
  [FEATURE_KEYS.LEFT]: { type: TYPES.TELEVISION.LEFT, keycode: 'left' },
  [FEATURE_KEYS.RIGHT]: { type: TYPES.TELEVISION.RIGHT, keycode: 'right' },
  [FEATURE_KEYS.ENTER]: { type: TYPES.TELEVISION.ENTER, keycode: 'enter' },
  [FEATURE_KEYS.MENU]: { type: TYPES.TELEVISION.MENU, keycode: 'menu' },
  [FEATURE_KEYS.BACK]: { type: TYPES.TELEVISION.RETURN, keycode: 'back' },
};

/**
 * @description The platform id of a TV: its MAC address, or its address when
 * Gladys could not tell its MAC (a TV typed in the configuration on another
 * subnet).
 * @param {string} mac - MAC address (12 hex digits) or empty.
 * @param {string} host - IP address.
 * @returns {string} `009ec8a1b2c3` or `ip-192-168-1-20`.
 */
export function platformId(mac, host) {
  return /^[0-9a-f]{12}$/.test(mac ?? '') ? mac : `ip-${String(host).replace(/\./g, '-')}`;
}

/**
 * @description Default name of a TV: the name set on the TV, else the end of
 * its MAC address (the dashboard shows the device name when a feature is
 * alone of its type).
 * @param {object} entry - `{ tvName, id }`.
 * @returns {string} `Xiaomi TV Living room` or `Xiaomi TV B2C3`.
 */
export function deviceName(entry) {
  const name = String(entry.tvName ?? '').trim();
  if (name) {
    return /xiaomi|mi\s?tv|小米/i.test(name) ? name : `Xiaomi TV ${name}`;
  }
  const suffix = entry.id.startsWith('ip-') ? entry.id.slice(3) : entry.id.slice(-4).toUpperCase();
  return `Xiaomi TV ${suffix}`;
}

const featureOf = (key, maxVolume) => {
  if (key === FEATURE_KEYS.POWER) {
    return {
      category: CATEGORIES.TELEVISION,
      type: TYPES.TELEVISION.BINARY,
      min: 0,
      max: 1,
      // Assumed: the TV does not tell standby from on (app.js).
      has_feedback: false,
      keep_history: true,
    };
  }
  if (key === FEATURE_KEYS.VOLUME) {
    return {
      category: CATEGORIES.TELEVISION,
      type: TYPES.TELEVISION.VOLUME,
      min: 0,
      max: maxVolume,
      has_feedback: true,
      keep_history: false,
    };
  }
  return {
    category: CATEGORIES.TELEVISION,
    type: REMOTE_KEYS[key].type,
    min: 0,
    max: 1,
    has_feedback: false,
    keep_history: false,
  };
};

/**
 * @description The device of the Discover tab.
 * @param {object} gladys - SDK client (externalIds).
 * @param {object} entry - TV entry (app.js).
 * @param {string} language - Language of the feature names.
 * @returns {object} The Gladys device.
 */
export function buildDevice(gladys, entry, language) {
  const ids = gladys.externalIds('device', entry.id);
  const name = deviceName(entry);
  const maxVolume = entry.maxVolume || DEFAULT_MAX_VOLUME;
  return {
    name,
    external_id: ids.device,
    // The integration asks the TVs itself on its own timer.
    should_poll: false,
    features: Object.values(FEATURE_KEYS).map((key) => ({
      name: `${name} - ${featureName(key, language)}`,
      external_id: ids.feature(key),
      ...featureOf(key, maxVolume),
      read_only: false,
    })),
    params: [
      { name: 'XIAOMI_TV_HOST', value: entry.host },
      { name: 'XIAOMI_TV_MAC', value: entry.mac || '' },
      { name: 'XIAOMI_TV_PLATFORM', value: entry.platform || '' },
    ],
  };
}

/**
 * @description The values of the features.
 * @param {object} entry - TV entry: `{ on, volume }`.
 * @returns {Array<[string, number]>} `[featureKey, value]`.
 */
export function featureValues(entry) {
  const values = [];
  if (typeof entry.on === 'boolean') {
    values.push([FEATURE_KEYS.POWER, entry.on ? 1 : 0]);
  }
  if (Number.isFinite(entry.volume)) {
    values.push([FEATURE_KEYS.VOLUME, entry.volume]);
  }
  return values;
}
