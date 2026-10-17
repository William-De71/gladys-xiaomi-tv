// -----------------------------------------------------------------------------
// The local HTTP API of Xiaomi TVs (MIUI TV / PatchWall), port 6095.
//
// The TV answers plain GET requests on the local network, without any
// account or pairing. Xiaomi does not document this API: the requests below
// are the ones the Mi Remote app sends, as documented by the community
// (pymitv, used by the Home Assistant `xiaomi_tv` integration, and mireco).
// Nothing is copied from them.
//
//   /request?action=isalive                      name, platform, build
//   /general?action=getVolum                     current volume (and maximum)
//   /controller?action=keyevent&keycode=<key>    a key of the remote
//   /controller?action=startapp&type=packagename&packagename=<package>
//   /controller?action=changesource&source=<hdmi1|hdmi2|hdmi3>
//   /controller?action=getinstalledapp&count=999&changeIcon=1
//   /request?action=getResource&name=<icon>      an application icon (PNG)
//
// Answers are JSON with `status: 0` (or `request_result: 200` on older
// firmware) and `msg: "success"`; `data` is sometimes an object, sometimes
// a JSON string. Setting the volume directly needs a signature whose secret
// is not public: the volume is reached with the volume keys instead
// (src/control.js).
// -----------------------------------------------------------------------------

export const PORT = 6095;
export const KEYS = [
  'power',
  'up',
  'down',
  'left',
  'right',
  'enter',
  'home',
  'back',
  'menu',
  'volumeup',
  'volumedown',
];
export const SOURCES = ['hdmi1', 'hdmi2', 'hdmi3'];

const TIMEOUT_MS = 3000;
const MAX_ICON_BYTES = 256 * 1024;

/** The TV refused or did not understand a request. */
export class TvError extends Error {}

const parseData = (data) => {
  if (typeof data !== 'string') {
    return data ?? null;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

/**
 * @description Read an answer of the TV.
 * @param {object} body - Parsed JSON.
 * @returns {any} Its `data`, parsed.
 * @throws {TvError} When the TV reports a failure.
 */
export function readAnswer(body) {
  if (!body || typeof body !== 'object') {
    throw new TvError('unexpected answer');
  }
  const ok =
    body.status === 0 ||
    body.request_result === 200 ||
    (body.status === undefined &&
      body.request_result === undefined &&
      String(body.msg).toLowerCase() === 'success');
  if (!ok) {
    throw new TvError(`refused: ${String(body.msg ?? body.status ?? body.request_result)}`);
  }
  return parseData(body.data);
}

/**
 * @description Read the `isalive` answer.
 * @param {any} data - Its data.
 * @returns {{ name: string, platform: string, build: string, version: string }} The TV.
 */
export function parseIsAlive(data) {
  const info = data && typeof data === 'object' ? data : {};
  const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
  return {
    name: text(info.devicename ?? info.deviceName).slice(0, 60),
    platform: text(info.platform),
    build: text(info.build),
    version: text(info.version),
  };
}

/**
 * @description Read the `getVolum` answer.
 * @param {any} data - Its data (`{ volum, maxVolum }`).
 * @returns {{ volume: number, max: number|null }} The volume.
 * @throws {TvError} Without a volume.
 */
export function parseVolume(data) {
  const volume = Number(data?.volum ?? data?.volume);
  if (!Number.isFinite(volume) || volume < 0) {
    throw new TvError('no volume in the answer');
  }
  const max = Number(data?.maxVolum ?? data?.maxVolume);
  return {
    volume: Math.round(volume),
    max: Number.isFinite(max) && max > 0 ? Math.round(max) : null,
  };
}

/**
 * @description Read the `getinstalledapp` answer.
 * @param {any} data - Its data (`{ AppInfo: [...] }`).
 * @returns {Array<{ package: string, name: string, icon: string, order: number }>}
 * The applications, in the order of the TV.
 */
export function parseApps(data) {
  const list = Array.isArray(data?.AppInfo) ? data.AppInfo : Array.isArray(data) ? data : [];
  const apps = new Map();
  list.forEach((app, index) => {
    const pkg = String(app?.PackageName ?? '').trim();
    if (!/^[A-Za-z0-9_.]{1,200}$/.test(pkg) || apps.has(pkg)) {
      return;
    }
    const order = Number(app?.Order);
    apps.set(pkg, {
      package: pkg,
      name:
        String(app?.AppName ?? '')
          .trim()
          .slice(0, 60) || pkg,
      icon: typeof app?.IconURL === 'string' ? app.IconURL : '',
      order: Number.isFinite(order) ? order : 1000 + index,
    });
  });
  return [...apps.values()].sort((a, b) => a.order - b.order);
}

/**
 * @description Create the client.
 * @param {object} [deps] - Dependencies.
 * @param {Function} [deps.fetch] - `fetch` (tests).
 * @param {number} [deps.timeoutMs] - Timeout of a request.
 * @returns {object} The client: every method takes the address of the TV.
 */
export function createTvClient({ fetch: doFetch = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const url = (host, path, query) =>
    `http://${host}:${PORT}/${path}?${new URLSearchParams(query).toString()}`;

  const get = async (host, path, query, timeout = timeoutMs) => {
    const response = await doFetch(url(host, path, query), {
      signal: AbortSignal.timeout(timeout),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new TvError(`HTTP ${response.status}`);
    }
    let body;
    try {
      body = JSON.parse(await response.text());
    } catch {
      throw new TvError('not a Xiaomi TV answer');
    }
    return readAnswer(body);
  };

  return {
    url,

    /** @returns {Promise<object>} parseIsAlive() of the TV. */
    async isAlive(host, timeout) {
      return parseIsAlive(await get(host, 'request', { action: 'isalive' }, timeout));
    },

    /** @returns {Promise<{ volume: number, max: number|null }>} The volume. */
    async getVolume(host) {
      return parseVolume(await get(host, 'general', { action: 'getVolum' }));
    },

    async key(host, keycode) {
      if (!KEYS.includes(keycode)) {
        throw new RangeError(`unknown key ${keycode}`);
      }
      await get(host, 'controller', { action: 'keyevent', keycode });
    },

    async startApp(host, pkg) {
      await get(host, 'controller', {
        action: 'startapp',
        type: 'packagename',
        packagename: pkg,
      });
    },

    async changeSource(host, source) {
      if (!SOURCES.includes(source)) {
        throw new RangeError(`unknown source ${source}`);
      }
      await get(host, 'controller', { action: 'changesource', source });
    },

    /** @returns {Promise<Array>} parseApps() of the TV. */
    async apps(host) {
      return parseApps(
        await get(host, 'controller', { action: 'getinstalledapp', count: 999, changeIcon: 1 }),
      );
    },

    /**
     * @description Download an application icon, only from the TV itself.
     * @param {string} host - Address of the TV.
     * @param {string} iconUrl - `IconURL` of the application.
     * @returns {Promise<Buffer|null>} PNG / JPEG / WebP bytes, null otherwise.
     */
    async icon(host, iconUrl) {
      let target;
      try {
        target = new URL(iconUrl);
      } catch {
        return null;
      }
      // The URL comes from the TV: never follow it anywhere else.
      if (target.protocol !== 'http:' || target.hostname !== host) {
        return null;
      }
      const response = await doFetch(target.href, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        return null;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return bytes.length > 0 && bytes.length <= MAX_ICON_BYTES ? bytes : null;
    },
  };
}
