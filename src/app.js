// -----------------------------------------------------------------------------
// The integration: every Gladys handler, registered before connect().
//
//   discovery   mediated SSDP scan through Gladys + the addresses of the
//               configuration, then `isalive` on port 6095 of every address
//   states      each created TV is asked every 10 to 60 s: does it answer,
//               what is its volume
//   commands    Gladys features, scene actions, widget buttons -> HTTP
//               requests to the TV (src/mitv/client.js, src/control.js)
//
// Power is ASSUMED. The power key toggles the TV between on and standby,
// and a TV in standby still answers on port 6095: the API cannot tell them
// apart. So the state is the last command sent from Gladys, "on" when the
// TV starts answering again, "off" when it stops answering. Turning on a TV
// that does not answer sends Wake-on-LAN when its MAC address is known.
//
// A TV is identified by its MAC address: when its address changes (DHCP),
// the next scan finds it again. The TVs seen are kept in /data so a restart
// polls them at once, without waiting for a scan.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { DEVICE_TRANSPORTS, logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { MAX_SEQUENCE, parseKeys, sendKeys, setVolume } from './control.js';
import {
  buildDevice,
  DEFAULT_MAX_VOLUME,
  deviceName,
  FEATURE_KEYS,
  featureValues,
  platformId,
  REMOTE_KEYS,
} from './devices.js';
import { t, text, truncate, truncateAll } from './i18n.js';
import { createTvClient, SOURCES, TvError } from './mitv/client.js';
import { normalizeMac, probeHosts, ssdpScan } from './mitv/discovery.js';
import { SCENE_ACTIONS } from './scenes.js';
import { createStatePublisher } from './states.js';
import { createStorage } from './storage.js';
import { buildTvWidget, MAX_APPS_SHOWN, WIDGET_ACTIONS, WIDGETS } from './widgets.js';

export const ACTIONS = { TEST: 'test_connection' };

const MINUTE = 60 * 1000;
const FAILURES_BEFORE_UNREACHABLE = 2;
const RESCAN_SPACING_MS = 5 * MINUTE;
const ALIVE_TIMEOUT_MS = 2000;
const WIDGET_REFRESH_SPACING_MS = 11 * 1000;
const APPS_TTL_MS = 10 * MINUTE;
const ICON_TTL_MS = 24 * 60 * MINUTE;
const DEFAULT_KEY_DELAY_MS = 700;
const MAX_MESSAGE = 1800;

const formatMac = (mac) => mac.match(/../g).join(':');

/**
 * @description Wire the integration.
 * @param {object} gladys - SDK client (or the fake one of the tests).
 * @param {object} [deps] - Dependencies.
 * @param {object} [deps.client] - src/mitv/client.js client (tests: a fake TV network).
 * @param {object} [deps.storage] - src/storage.js storage.
 * @param {object} [deps.logger] - Logger.
 * @param {Function} [deps.now] - Clock (ms).
 * @param {Function} [deps.sleep] - Pause between keys (tests: immediate).
 * @returns {object} `{ start, stop, poll, scan, … }`.
 */
export function createApp(
  gladys,
  {
    client = createTvClient(),
    storage = createStorage(),
    logger = sdkLogger,
    now = Date.now,
    sleep,
  } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  let pollTimer = null;
  let rescanTimer = null;
  let stopped = false;
  let polling = null;
  let scanning = null;
  let lastScanAt = 0;
  let scanError = null;
  let statusKey = '';
  const entries = new Map(); // platform id -> entry
  const created = new Set(); // device external ids
  const transports = new Map();
  const widgetRefresh = new Map();
  const icons = new Map(); // package -> { key, bytes, at }
  const images = new Map(); // image key -> base64

  const states = createStatePublisher(gladys, {
    logger,
    now,
    isCreated: (externalId) => created.has(externalId),
  });

  const safely = (task, what) =>
    Promise.resolve()
      .then(task)
      .catch((error) => logger.warn(`Xiaomi TV: ${what} failed: ${error?.message ?? error}`));

  // --- Widgets, transports, status ---------------------------------------------------

  const refreshWidget = (key) => {
    const slot = widgetRefresh.get(key) ?? { at: 0, timer: null };
    widgetRefresh.set(key, slot);
    const wait = slot.at + WIDGET_REFRESH_SPACING_MS - now();
    if (wait <= 0) {
      slot.at = now();
      safely(() => gladys.requestWidgetRefresh(key), 'widget refresh');
    } else if (!slot.timer) {
      slot.timer = setTimeout(() => {
        slot.timer = null;
        refreshWidget(key);
      }, wait);
      slot.timer.unref?.();
    }
  };
  const refreshWidgets = () => Object.values(WIDGETS).forEach(refreshWidget);

  const publishTransport = (entry, force = false) => {
    if (!created.has(entry.deviceId)) {
      return;
    }
    const transport = entry.reachable ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.UNREACHABLE;
    if (!force && transports.get(entry.deviceId) === transport) {
      return;
    }
    transports.set(entry.deviceId, transport);
    safely(
      () => gladys.publishTransports([{ external_id: entry.deviceId, transport }]),
      'transport badge',
    );
  };

  const nameOf = (entry) => entry.gladysName || deviceName(entry);

  const publishStatus = () => {
    // The created TVs once there are some, every TV found before.
    const identified = [...entries.values()].filter((entry) => entry.identified);
    const mine = identified.filter((entry) => created.has(entry.deviceId));
    const known = mine.length > 0 ? mine : identified;
    const answering = known.filter((entry) => entry.reachable);
    let key;
    let connected;
    let message;
    if (scanError === 'forbidden' && known.length === 0) {
      [key, connected, message] = ['forbidden', false, t('statusScanForbidden')];
    } else if (known.length === 0) {
      [key, connected, message] = ['none', false, t('statusNoTv')];
    } else if (answering.length === 0) {
      // A TV switched off at the wall is not a failure of the integration.
      key = `off:${known.length}`;
      [connected, message] = [true, t('statusAllOff', { count: known.length })];
    } else {
      key = `ok:${answering.length}:${known.length}`;
      connected = true;
      message = t('statusConnected', { count: answering.length, total: known.length });
    }
    if (key !== statusKey) {
      statusKey = key;
      safely(() => gladys.setConnectionStatus(connected, message), 'status');
    }
  };

  // --- Entries -------------------------------------------------------------------------

  const persist = () =>
    safely(
      () =>
        storage.write(
          'tvs.json',
          Object.fromEntries(
            [...entries.values()]
              .filter((entry) => entry.identified)
              .map((entry) => [
                entry.id,
                {
                  host: entry.host,
                  mac: entry.mac,
                  tvName: entry.tvName,
                  platform: entry.platform,
                  build: entry.build,
                  maxVolume: entry.maxVolume,
                },
              ]),
          ),
        ),
      'saving the TVs',
    );

  const pushStates = (entry) => {
    const ids = gladys.externalIds('device', entry.id);
    for (const [key, value] of featureValues(entry)) {
      states.push(ids.feature(key), value);
    }
  };

  const entryOf = ({ id, host, mac = '' }) => {
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        id,
        deviceId: gladys.externalIds('device', id).device,
        host,
        mac,
        tvName: '',
        platform: '',
        build: '',
        maxVolume: null,
        identified: false,
        reachable: null,
        failures: 0,
        on: undefined,
        volume: undefined,
        mutedVolume: null,
        apps: null,
        appsAt: 0,
        gladysName: '',
      };
      entries.set(id, entry);
    } else {
      if (host && entry.host !== host) {
        logger.info(`Xiaomi TV: ${id} moved from ${entry.host} to ${host}`);
        entry.host = host;
      }
      entry.mac ||= mac;
    }
    return entry;
  };

  const setReachable = (entry, reachable) => {
    if (entry.reachable === reachable) {
      return;
    }
    entry.reachable = reachable;
    // Power is assumed (see the top of this file): answering again means it
    // was switched on, not answering means it is off.
    entry.on = reachable;
    pushStates(entry);
    publishTransport(entry);
    publishStatus();
    refreshWidgets();
  };

  const markFailure = (entry, error) => {
    if (stopped) {
      return;
    }
    entry.failures += 1;
    logger.debug?.(
      `Xiaomi TV: ${entry.host} failed (${entry.failures}): ${error?.message ?? error}`,
    );
    if (entry.failures >= FAILURES_BEFORE_UNREACHABLE || entry.reachable === null) {
      setReachable(entry, false);
      requestRescan();
    }
  };

  const learnVolume = (entry, { volume, max }) => {
    let changed = false;
    // The maximum is fixed once known: the Discover "Update" compares it.
    if (!entry.maxVolume) {
      entry.maxVolume = max ?? DEFAULT_MAX_VOLUME;
      changed = true;
    }
    const clamped = Math.min(entry.maxVolume, Math.max(0, volume));
    if (clamped !== entry.volume) {
      entry.volume = clamped;
      if (clamped > 0) {
        entry.mutedVolume = null;
      }
      refreshWidgets();
    }
    return changed;
  };

  /** Ask a TV whether it answers, then its volume. */
  const readEntry = async (entry) => {
    try {
      const info = await client.isAlive(entry.host, ALIVE_TIMEOUT_MS);
      entry.failures = 0;
      if (info.name && info.name !== entry.tvName) {
        entry.tvName = info.name;
      }
      setReachable(entry, true);
    } catch (error) {
      markFailure(entry, error);
      return false;
    }
    try {
      if (learnVolume(entry, await client.getVolume(entry.host))) {
        persist();
      }
    } catch (error) {
      logger.debug?.(`Xiaomi TV: no volume from ${entry.host}: ${error?.message ?? error}`);
    }
    pushStates(entry);
    return true;
  };

  // --- Discovery -------------------------------------------------------------------------

  const discovered = () =>
    [...entries.values()]
      .filter((entry) => entry.identified)
      .map((entry) => buildDevice(gladys, entry, config.language));

  const publishDiscovered = () =>
    safely(() => gladys.publishDiscoveredDevices(discovered()), 'discovery');

  const macKnownFor = (host) =>
    [...entries.values()].find((entry) => entry.host === host && entry.mac)?.mac ?? '';

  const scanOnce = async () => {
    lastScanAt = now();
    const first = await ssdpScan(gladys, { logger });
    scanError = first.error;
    const candidates = first.candidates;
    for (const host of config.hosts) {
      if (!candidates.has(host)) {
        candidates.set(host, '');
      }
    }
    const tvs = await probeHosts(client, [...candidates.keys()]);
    // Asking the TV made the host learn its MAC address: search once more
    // for the TVs Gladys could not name yet.
    const missing = [...tvs.keys()].filter((host) => !candidates.get(host) && !macKnownFor(host));
    if (missing.length > 0 && !first.error) {
      const second = await ssdpScan(gladys, { logger, timeoutSeconds: 2 });
      for (const host of missing) {
        candidates.set(host, second.candidates.get(host) ?? '');
      }
    }
    const touched = [];
    for (const [host, info] of tvs) {
      const mac = normalizeMac(candidates.get(host)) || macKnownFor(host);
      const id = platformId(mac, host);
      if (mac) {
        // The same TV was known by its address only: keep that identity if
        // the user created it, drop it otherwise, never both.
        const byAddress = entries.get(platformId('', host));
        if (byAddress && created.has(byAddress.deviceId)) {
          byAddress.mac ||= mac;
          Object.assign(byAddress, { tvName: info.name || byAddress.tvName, identified: true });
          touched.push(byAddress);
          continue;
        }
        if (byAddress) {
          entries.delete(byAddress.id);
        }
      }
      const entry = entryOf({ id, host, mac });
      Object.assign(entry, {
        tvName: info.name || entry.tvName,
        platform: info.platform || entry.platform,
        build: info.build || entry.build,
        identified: true,
      });
      touched.push(entry);
    }
    await Promise.all(touched.map((entry) => readEntry(entry)));
    persist();
    await publishDiscovered();
    publishStatus();
    return touched;
  };

  /** Run a scan, or join the one running. */
  const scan = () => {
    if (!scanning) {
      scanning = scanOnce().finally(() => {
        scanning = null;
      });
    }
    return scanning;
  };

  function requestRescan() {
    if (stopped || scanning || now() - lastScanAt < RESCAN_SPACING_MS) {
      return;
    }
    safely(() => scan(), 'scan');
  }

  // --- Polling ---------------------------------------------------------------------------

  const pollOnce = async () => {
    const targets = [...entries.values()].filter((entry) => created.has(entry.deviceId));
    await Promise.all(targets.map((entry) => readEntry(entry)));
    publishStatus();
  };

  const poll = () => {
    if (!polling) {
      polling = pollOnce().finally(() => {
        polling = null;
      });
    }
    return polling;
  };

  const schedule = () => {
    clearInterval(pollTimer);
    clearInterval(rescanTimer);
    pollTimer = null;
    rescanTimer = null;
    if (stopped) {
      return;
    }
    pollTimer = setInterval(() => safely(() => poll(), 'poll'), config.pollMs);
    pollTimer.unref?.();
    if (config.rescanMs > 0) {
      rescanTimer = setInterval(() => safely(() => scan(), 'scan'), config.rescanMs);
      rescanTimer.unref?.();
    }
  };

  // --- Commands ----------------------------------------------------------------------------

  const userError = (key, vars = {}) => new Error(text(key, config.language, vars));

  const entryFor = (externalId) => {
    const deviceId = String(externalId ?? '');
    const entry = [...entries.values()].find(
      (candidate) =>
        candidate.deviceId === deviceId || deviceId.startsWith(`${candidate.deviceId}:`),
    );
    if (!entry) {
      throw userError('errorUnknownDevice');
    }
    return entry;
  };

  /** Run requests on a TV that answers, mapping errors to user texts. */
  const command = async (entry, task) => {
    if (entry.reachable === false) {
      throw userError('errorOff', { name: nameOf(entry) });
    }
    try {
      const result = await task();
      entry.failures = 0;
      setReachable(entry, true);
      return result;
    } catch (error) {
      if (error instanceof RangeError) {
        throw error;
      }
      if (!(error instanceof TvError)) {
        markFailure(entry, error);
      }
      throw userError('errorUnreachable', {
        name: nameOf(entry),
        error: truncate(error?.message ?? error, 200),
      });
    }
  };

  /**
   * Switch a TV on. Answering and assumed off: the power key. Not answering:
   * Wake-on-LAN, when its MAC address is known.
   * @returns {Promise<string>} `key`, `wake` or `already`.
   */
  const powerOn = async (entry) => {
    if (entry.reachable === false) {
      if (!entry.mac) {
        throw userError('errorNoWake', { name: nameOf(entry) });
      }
      await gladys.wakeOnLan(formatMac(entry.mac));
      return 'wake';
    }
    if (entry.on === true) {
      return 'already';
    }
    await command(entry, () => client.key(entry.host, 'power'));
    entry.on = true;
    pushStates(entry);
    refreshWidgets();
    return 'key';
  };

  const powerOff = async (entry) => {
    if (entry.reachable === false || entry.on === false) {
      return 'already';
    }
    await command(entry, () => client.key(entry.host, 'power'));
    entry.on = false;
    pushStates(entry);
    refreshWidgets();
    return 'key';
  };

  const changeVolume = async (entry, target) => {
    const max = entry.maxVolume || DEFAULT_MAX_VOLUME;
    const wanted = Math.min(max, Math.max(0, Math.round(Number(target))));
    if (!Number.isFinite(wanted)) {
      throw new RangeError(String(target));
    }
    const reached = await command(entry, () =>
      setVolume(client, entry.host, wanted, sleep ? { sleep } : {}),
    );
    learnVolume(entry, { volume: reached, max: null });
    pushStates(entry);
    return reached;
  };

  /** No mute key on the TV: down to 0, and back to the volume before. */
  const toggleMute = async (entry) => {
    if ((entry.volume ?? 0) > 0) {
      const before = entry.volume;
      await changeVolume(entry, 0);
      entry.mutedVolume = before;
      return 'muted';
    }
    const restore = entry.mutedVolume ?? Math.round((entry.maxVolume || DEFAULT_MAX_VOLUME) / 5);
    entry.mutedVolume = null;
    await changeVolume(entry, restore);
    return 'unmuted';
  };

  const pressKey = (entry, keycode) => command(entry, () => client.key(entry.host, keycode));

  gladys.onSetValue(async (device, feature, value) => {
    const entry = entryFor(device.external_id);
    const key = String(feature.external_id).split(':').pop();
    if (key === FEATURE_KEYS.POWER) {
      await (Number(value) === 1 ? powerOn(entry) : powerOff(entry));
      return;
    }
    if (key === FEATURE_KEYS.VOLUME) {
      await changeVolume(entry, value);
      return;
    }
    if (key === FEATURE_KEYS.VOLUME_MUTE) {
      await toggleMute(entry);
      return;
    }
    const remote = REMOTE_KEYS[key];
    if (!remote) {
      throw userError('errorUnknownFeature', { key });
    }
    await pressKey(entry, remote.keycode);
    if (key === FEATURE_KEYS.VOLUME_UP || key === FEATURE_KEYS.VOLUME_DOWN) {
      await safely(async () => {
        learnVolume(entry, await client.getVolume(entry.host));
        pushStates(entry);
      }, 'volume read');
    }
  });

  // --- Device events ---------------------------------------------------------------------------

  const trackCreated = (device) => {
    if (!device?.external_id) {
      return null;
    }
    created.add(device.external_id);
    const id = String(device.external_id).split(':').pop();
    const param = (name) => device.params?.find?.((item) => item.name === name)?.value;
    const host = entries.get(id)?.host ?? param('XIAOMI_TV_HOST');
    if (!host) {
      return null;
    }
    const entry = entryOf({ id, host, mac: normalizeMac(param('XIAOMI_TV_MAC')) });
    entry.identified = true;
    entry.gladysName = device.name ?? entry.gladysName;
    const volume = device.features?.find?.((feature) =>
      String(feature.external_id ?? '').endsWith(`:${FEATURE_KEYS.VOLUME}`),
    );
    if (!entry.maxVolume && Number(volume?.max) > 0) {
      entry.maxVolume = Number(volume.max);
    }
    return entry;
  };

  gladys.onDeviceCreated(async (device) => {
    const entry = trackCreated(device);
    if (entry) {
      // States published before the creation were thrown away by Gladys.
      states.republish(entry.deviceId);
      await readEntry(entry);
      pushStates(entry);
      publishTransport(entry, true);
    }
    refreshWidgets();
  });

  gladys.onDeviceUpdated(async (device) => {
    const entry = trackCreated(device);
    if (entry) {
      states.republish(entry.deviceId);
    }
    refreshWidgets();
  });

  gladys.onDeviceDeleted(async (device) => {
    if (device?.external_id) {
      created.delete(device.external_id);
      transports.delete(device.external_id);
      states.forget(device.external_id);
    }
    refreshWidgets();
  });

  gladys.onScanRequest(async () => {
    await scan();
  });

  gladys.onConfigUpdated(async (raw) => {
    const previous = config;
    config = normalizeConfig(raw ?? {});
    if (previous.language !== config.language) {
      await publishDiscovered();
    }
    if (previous.pollMs !== config.pollMs || previous.rescanMs !== config.rescanMs) {
      schedule();
    }
    if (previous.hosts.join(',') !== config.hosts.join(',')) {
      await scan();
    }
  });

  // --- Configuration button ------------------------------------------------------------------------

  gladys.onAction(ACTIONS.TEST, async () => {
    const touched = await scan();
    const known = [...new Set([...touched, ...entries.values()])].filter(
      (entry) => entry.identified,
    );
    if (known.length === 0) {
      return scanError === 'forbidden' ? t('statusScanForbidden') : t('testNone');
    }
    const message = {};
    for (const language of ['en', 'fr', 'de', 'es']) {
      const list = known
        .map((entry) => {
          const details = [entry.host];
          details.push(entry.mac ? formatMac(entry.mac) : text('testNoMac', language));
          if (!entry.reachable) {
            details.push(text('testUnreachable', language));
          }
          return `${nameOf(entry)} (${details.join(', ')})`;
        })
        .join(' ; ');
      message[language] = text('testOk', language, { count: known.length, list });
    }
    return truncateAll(message, MAX_MESSAGE);
  });

  // --- Applications ----------------------------------------------------------------------------------

  /** The applications of a TV, kept 10 minutes. */
  const appsOf = async (entry, force = false) => {
    if (!force && entry.apps && now() - entry.appsAt < APPS_TTL_MS) {
      return entry.apps;
    }
    const apps = await command(entry, () => client.apps(entry.host));
    entry.apps = apps;
    entry.appsAt = now();
    return apps;
  };

  /** Find an application by package name or by name (case and accents ignored). */
  const findApp = (apps, wanted) => {
    const fold = (value) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
    const target = fold(wanted);
    return (
      apps.find((app) => app.package.toLowerCase() === target) ??
      apps.find((app) => fold(app.name) === target) ??
      apps.find((app) => fold(app.name).startsWith(target))
    );
  };

  /** The image key of an application icon: it changes with the bytes. */
  const iconKey = async (entry, app) => {
    const cached = icons.get(app.package);
    if (cached && now() - cached.at < ICON_TTL_MS) {
      return cached.key;
    }
    if (!app.icon) {
      return undefined;
    }
    const bytes = await client.icon(entry.host, app.icon).catch(() => null);
    const isImage =
      bytes &&
      (bytes.subarray(0, 4).toString('hex') === '89504e47' ||
        bytes.subarray(0, 3).toString('hex') === 'ffd8ff' ||
        bytes.subarray(8, 12).toString('latin1') === 'WEBP');
    if (!isImage) {
      icons.set(app.package, { key: undefined, at: now() });
      return undefined;
    }
    const key = `app-${createHash('sha1').update(bytes).digest('hex').slice(0, 20)}`;
    if (cached?.key && cached.key !== key) {
      images.delete(cached.key);
    }
    images.set(key, bytes.toString('base64'));
    icons.set(app.package, { key, at: now() });
    return key;
  };

  const launchApp = async (entry, wanted) => {
    const apps = await appsOf(entry).catch(() => []);
    const app = findApp(apps, wanted);
    const pkg = app?.package ?? String(wanted ?? '').trim();
    if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(pkg)) {
      throw userError('errorUnknownApp', { app: truncate(wanted, 60) });
    }
    await command(entry, () => client.startApp(entry.host, pkg));
    return { app_name: app?.name ?? pkg, package: pkg };
  };

  // --- Scene actions -----------------------------------------------------------------------------------

  gladys.onSceneAction(SCENE_ACTIONS.LAUNCH_APP, async (fields = {}) =>
    launchApp(entryFor(fields.device), fields.app),
  );

  gladys.onSceneAction(SCENE_ACTIONS.SEND_KEYS, async (fields = {}) => {
    const entry = entryFor(fields.device);
    let keys;
    try {
      keys = parseKeys(fields.keys);
    } catch {
      throw userError('errorKeys', { max: MAX_SEQUENCE });
    }
    const typed = Number(fields.delay_ms);
    const delay =
      fields.delay_ms === undefined || fields.delay_ms === null || !Number.isFinite(typed)
        ? DEFAULT_KEY_DELAY_MS
        : Math.min(3000, Math.max(200, Math.round(typed)));
    const sent = await command(entry, () =>
      sendKeys(client, entry.host, keys, delay, sleep ? { sleep } : {}),
    );
    return { keys_sent: sent };
  });

  gladys.onSceneAction(SCENE_ACTIONS.CHANGE_SOURCE, async (fields = {}) => {
    const entry = entryFor(fields.device);
    const source = String(fields.source ?? '');
    if (!SOURCES.includes(source)) {
      throw userError('errorSource', { source: truncate(source, 20) });
    }
    await command(entry, () => client.changeSource(entry.host, source));
  });

  // --- Widget --------------------------------------------------------------------------------------

  const createdEntries = () => [...entries.values()].filter((entry) => created.has(entry.deviceId));

  const viewOf = (entry) => ({
    deviceId: entry.deviceId,
    name: nameOf(entry),
    host: entry.host,
    reachable: Boolean(entry.reachable),
    on: entry.on === true,
    canWake: Boolean(entry.mac),
    volume: Number.isFinite(entry.volume) ? entry.volume : null,
    maxVolume: entry.maxVolume || DEFAULT_MAX_VOLUME,
    muted: entry.mutedVolume !== null && entry.volume === 0,
  });

  gladys.onWidgetGet(WIDGETS.TV, async ({ settings } = {}) => {
    const entry = createdEntries().find((candidate) => candidate.deviceId === settings?.device);
    if (!entry) {
      return buildTvWidget(null, []);
    }
    let apps = [];
    if (entry.reachable && entry.on) {
      const list = await appsOf(entry).catch(() => []);
      apps = await Promise.all(
        list.slice(0, MAX_APPS_SHOWN).map(async (app) => ({
          ...app,
          image: await iconKey(entry, app),
        })),
      );
      // The form lists every application, not only the ones shown.
      apps.push(...list.slice(MAX_APPS_SHOWN));
    }
    return buildTvWidget(viewOf(entry), apps);
  });

  gladys.onWidgetGetImage(async (imageKey) => images.get(imageKey) ?? '');

  const toast = (error) =>
    truncateAll(
      { en: error.message, fr: error.message, de: error.message, es: error.message },
      200,
    );

  gladys.onWidgetAction(WIDGETS.TV, async (actionKey, params = {}, { settings, values } = {}) => {
    let entry;
    try {
      entry = entryFor(settings?.device ?? params.device);
    } catch (error) {
      return toast(error);
    }
    try {
      let done;
      if (actionKey === WIDGET_ACTIONS.POWER_ON) {
        const how = await powerOn(entry);
        done = how === 'wake' ? t('widgetWakeSent') : t('widgetPoweredOn');
      } else if (actionKey === WIDGET_ACTIONS.POWER_OFF) {
        await powerOff(entry);
        done = t('widgetPoweredOff');
      } else if (actionKey === WIDGET_ACTIONS.HOME) {
        await pressKey(entry, 'home');
        done = t('widgetHome');
      } else if (actionKey === WIDGET_ACTIONS.MUTE) {
        const how = await toggleMute(entry);
        done = how === 'muted' ? t('widgetMuted') : t('widgetUnmuted');
      } else if (actionKey === WIDGET_ACTIONS.LAUNCH_APP) {
        const result = await launchApp(entry, values?.app);
        done = t('widgetLaunched', { app: truncate(result.app_name, 60) });
      } else {
        return undefined;
      }
      refreshWidgets();
      return truncateAll(done, 200);
    } catch (error) {
      return toast(error);
    }
  });

  // --- Lifecycle -------------------------------------------------------------------------------------

  return {
    /** Restore the known TVs, ask them, then scan. */
    async start() {
      stopped = false;
      config = normalizeConfig(gladys.config ?? {});
      created.clear();
      const saved = (await storage.read('tvs.json')) ?? {};
      for (const [id, info] of Object.entries(saved)) {
        if (typeof info?.host === 'string') {
          const entry = entryOf({ id, host: info.host, mac: normalizeMac(info.mac) });
          Object.assign(entry, {
            tvName: String(info.tvName ?? ''),
            platform: String(info.platform ?? ''),
            build: String(info.build ?? ''),
            maxVolume: Number(info.maxVolume) > 0 ? Number(info.maxVolume) : null,
            identified: true,
          });
        }
      }
      (gladys.devices ?? []).forEach((device) => trackCreated(device));
      await poll();
      schedule();
      await scan();
    },

    async stop() {
      stopped = true;
      clearInterval(pollTimer);
      clearInterval(rescanTimer);
      widgetRefresh.forEach((slot) => clearTimeout(slot.timer));
      states.stop();
      await Promise.allSettled([polling, scanning]);
    },

    poll,
    scan,
    flushStates: () => states.flush(),
    entries,
  };
}
