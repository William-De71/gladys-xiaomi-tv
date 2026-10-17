// Test helpers: fake Xiaomi TVs behind a fake network (no socket is ever
// opened), a fake `fetch` speaking the port 6095 API, a clock, a silent
// logger.
//
// A FakeTv keeps a volume, an assumed screen state and its applications,
// and records every key it receives. `fakeTvNetwork().fetch` answers the
// HTTP requests of src/mitv/client.js the way a real TV does (JSON bodies of
// the community documentation), so the app runs its real client.

/** A small valid PNG (1 × 1, transparent). */
export const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

export const APPS = [
  { PackageName: 'com.netflix.ninja', AppName: 'Netflix', Order: 2 },
  { PackageName: 'com.google.android.youtube.tv', AppName: 'YouTube', Order: 1 },
  { PackageName: 'com.mitv.tvhome', AppName: 'PatchWall', Order: 3 },
  { PackageName: 'com.xiaomi.tweather', AppName: 'Météo', Order: 4 },
];

export class FakeTv {
  /**
   * @param {object} options - Options.
   * @param {string} options.host - IP address.
   * @param {string} [options.mac] - MAC address (for the SSDP answers).
   * @param {string} [options.name] - `devicename` of `isalive`.
   * @param {number} [options.volume] - Current volume.
   * @param {number|null} [options.maxVolume] - `maxVolum`, null to omit it.
   * @param {number} [options.step] - Volume change of one key press.
   * @param {boolean} [options.oldFirmware] - Answers `request_result: 200` and data as a string.
   */
  constructor({
    host,
    mac = '',
    name = 'Living room TV',
    volume = 20,
    maxVolume = 100,
    step = 1,
    oldFirmware = false,
  }) {
    Object.assign(this, { host, mac, name, volume, maxVolume, step, oldFirmware });
    this.keys = [];
    this.launched = [];
    this.sources = [];
    this.screenOn = true;
    this.unplugged = false;
    this.apps = APPS.map((app) => ({
      ...app,
      IconURL: `http://${host}:6095/request?action=getResource&name=${app.PackageName}0.png`,
    }));
  }

  answer(data) {
    return this.oldFirmware
      ? { request_result: 200, msg: 'success', data: JSON.stringify(data) }
      : { status: 0, msg: 'success', data };
  }

  /** The JSON body (or bytes) the TV answers to a request URL. */
  handle(url) {
    const action = url.searchParams.get('action');
    const path = url.pathname;
    if (path === '/request' && action === 'isalive') {
      return this.answer({
        devicename: this.name,
        ip: `${this.host}:6095`,
        feature: ['power'],
        platform: 630,
        build: 1267,
        version: 16777510,
      });
    }
    if (path === '/request' && action === 'getResource') {
      return PNG;
    }
    if (path === '/general' && action === 'getVolum') {
      const data = { volum: this.volume };
      if (this.maxVolume !== null) {
        data.maxVolum = this.maxVolume;
      }
      // Real TVs send this one as a JSON string, even on recent firmware.
      return { request_result: 200, msg: 'success', data: JSON.stringify(data) };
    }
    if (path === '/controller' && action === 'keyevent') {
      const key = url.searchParams.get('keycode');
      this.keys.push(key);
      const max = this.maxVolume ?? 100;
      if (key === 'volumeup') {
        this.volume = Math.min(max, this.volume + this.step);
      } else if (key === 'volumedown') {
        this.volume = Math.max(0, this.volume - this.step);
      } else if (key === 'power') {
        this.screenOn = !this.screenOn;
      }
      return this.answer({});
    }
    if (path === '/controller' && action === 'startapp') {
      this.launched.push(url.searchParams.get('packagename'));
      return this.answer(null);
    }
    if (path === '/controller' && action === 'changesource') {
      this.sources.push(url.searchParams.get('source'));
      return this.answer(null);
    }
    if (path === '/controller' && action === 'getinstalledapp') {
      return this.answer({ AppInfo: this.apps });
    }
    return { status: 1, msg: 'unknown action' };
  }

  /** The answer of the TV to the M-SEARCH of Gladys. */
  ssdpReply(withMac = true) {
    return {
      source_ip: this.host,
      source_port: 49152,
      ...(withMac && this.mac ? { source_mac: this.mac } : {}),
      headers: `HTTP/1.1 200 OK\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\nUSN: uuid:${this.host}\r\n\r\n`,
    };
  }
}

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return Buffer.isBuffer(body) ? body.toString('latin1') : JSON.stringify(body);
  },
  async arrayBuffer() {
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
  },
});

/**
 * @description A network of fake TVs and other devices answering SSDP.
 * @param {FakeTv[]} tvs - The TVs.
 * @returns {object} `{ tvs, add, fetch, requests, ssdp }`.
 */
export function fakeTvNetwork(tvs = []) {
  const network = {
    tvs: new Map(tvs.map((tv) => [tv.host, tv])),
    requests: [],
    /** Other SSDP devices (a router, a speaker): they never answer on 6095. */
    others: ['192.168.1.1'],
    add(tv) {
      network.tvs.set(tv.host, tv);
    },
    async fetch(href) {
      const url = new URL(href);
      network.requests.push(href);
      const tv = network.tvs.get(url.hostname);
      if (!tv || tv.unplugged || url.port !== '6095') {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: { code: 'ECONNREFUSED' },
        });
      }
      return response(200, tv.handle(url));
    },
    /** The scan results of Gladys: every TV plugged in, plus the other devices. */
    ssdp(withMac = true) {
      return [
        ...[...network.tvs.values()]
          .filter((tv) => !tv.unplugged)
          .map((tv) => tv.ssdpReply(withMac)),
        ...network.others.map((ip) => ({
          source_ip: ip,
          source_port: 1900,
          headers: 'HTTP/1.1 200 OK\r\n\r\n',
        })),
      ];
    },
  };
  return network;
}

export function fakeClock(start = Date.parse('2026-10-18T18:00:00Z')) {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
    },
  };
}

export const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export const flush = () => new Promise((resolve) => setImmediate(resolve));
export const noSleep = async () => {};
