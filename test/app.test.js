// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`) and fake Xiaomi TVs
// (test/helpers.js): discovery, states, assumed power, commands, scene
// actions, widget, address changes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { createTvClient } from '../src/mitv/client.js';
import { SCENE_ACTION_OUTPUTS } from '../src/scenes.js';
import { memoryStorage } from '../src/storage.js';
import { FakeTv, fakeTvNetwork, noSleep, silentLogger } from './helpers.js';

const CONFIG = { language: 'fr', hosts: '10.0.0.2' };
const id = (key) => `ext:test-integration:device:${key}`;
const SALON = id('009ec8a1b2c3');
const BEDROOM = id('ip-10-0-0-2');

const tvs = () => [
  new FakeTv({ host: '192.168.1.50', mac: '00:9e:c8:a1:b2:c3', name: 'Salon', volume: 20 }),
  // On another subnet, typed in the configuration: no SSDP answer, no MAC.
  new FakeTv({ host: '10.0.0.2', name: '', volume: 5, maxVolume: null, oldFirmware: true }),
];

/**
 * @description An integration wired to the fake Gladys and fake TVs.
 * @param {object} [options] - `{ config, create, network, storage }`.
 * @returns {Promise<object>} `{ gladys, fake, app, network, storage }`.
 */
async function setup({
  config = CONFIG,
  create = true,
  network = fakeTvNetwork(tvs()),
  storage = memoryStorage(),
} = {}) {
  const gladys = createFakeGladys({ config: structuredClone(config) });
  const subnet = (results) => results.filter((result) => result.source_ip.startsWith('192.168.'));
  // The core runs the M-SEARCH on its own LAN only.
  gladys.scanNetwork = async () => subnet(network.ssdp());
  const app = createApp(gladys, {
    client: createTvClient({ fetch: network.fetch }),
    storage,
    logger: silentLogger,
    sleep: noSleep,
  });
  await gladys.connect();
  await app.start();
  if (create) {
    for (const device of gladys.fake.discoveredDevices) {
      await gladys.fake.deviceCreated(structuredClone(device));
    }
    await app.flushStates();
  }
  return { gladys, fake: gladys.fake, app, network, storage };
}

const ok = (ack) => {
  assert.equal(ack.success, true, ack.error);
  return ack.data;
};
const deviceOf = (fake, externalId) =>
  structuredClone(fake.discoveredDevices.find((device) => device.external_id === externalId));
const featureOf = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`));
const last = (fake, externalId, key) => fake.lastState(`${externalId}:${key}`);
const setValue = (fake, externalId, key, value) => {
  const device = deviceOf(fake, externalId);
  return fake.setValue(device, featureOf(device, key), value);
};

test('discovery: TVs found by SSDP and by typed address, nothing else', async () => {
  const { fake, network, storage } = await setup({ create: false });
  const ids = fake.discoveredDevices.map((device) => device.external_id).sort();
  assert.deepEqual(ids, [SALON, BEDROOM].sort());
  const salon = deviceOf(fake, SALON);
  assert.equal(salon.name, 'Xiaomi TV Salon');
  assert.equal(featureOf(salon, 'power').name, 'Xiaomi TV Salon - Marche/veille');
  assert.equal(featureOf(salon, 'volume').max, 100);
  assert.deepEqual(
    salon.params.find((param) => param.name === 'XIAOMI_TV_MAC'),
    { name: 'XIAOMI_TV_MAC', value: '009ec8a1b2c3' },
  );
  assert.equal(deviceOf(fake, BEDROOM).name, 'Xiaomi TV 10-0-0-2');
  // The router answered SSDP, never port 6095 twice.
  assert.ok(network.requests.some((href) => href.startsWith('http://192.168.1.1:6095/')));
  assert.equal(fake.connectionStatus.connected, true);
  assert.match(fake.connectionStatus.message.fr, /^2 téléviseur\(s\) Xiaomi sur 2 répondent/);
  assert.deepEqual(Object.keys(storage.files['tvs.json']).sort(), ['009ec8a1b2c3', 'ip-10-0-0-2']);
  assert.equal(storage.files['tvs.json']['009ec8a1b2c3'].maxVolume, 100);
  // No state for TVs not created yet: Gladys would throw them away.
  assert.equal(fake.states.length, 0);
});

test('discovery: a TV first seen without MAC gets it from the second search', async () => {
  const network = fakeTvNetwork([new FakeTv({ host: '192.168.1.60', mac: '00:9e:c8:00:00:01' })]);
  const gladys = createFakeGladys({ config: {} });
  let calls = 0;
  gladys.scanNetwork = async () => {
    calls += 1;
    // The host only knows the MAC once the integration asked the TV.
    return network.ssdp(calls > 1);
  };
  const app = createApp(gladys, {
    client: createTvClient({ fetch: network.fetch }),
    storage: memoryStorage(),
    logger: silentLogger,
  });
  await gladys.connect();
  await app.start();
  assert.equal(calls, 2);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.external_id),
    [id('009ec8000001')],
  );
  await app.stop();
});

test('created TVs: states republished, local badge, maximum volume kept', async () => {
  const { fake, app } = await setup();
  assert.equal(last(fake, SALON, 'power'), 1);
  assert.equal(last(fake, SALON, 'volume'), 20);
  assert.equal(last(fake, BEDROOM, 'volume'), 5);
  assert.equal(featureOf(deviceOf(fake, BEDROOM), 'volume').max, 100, 'no maxVolum: 100');
  assert.deepEqual(fake.transports.filter((entry) => entry.device_external_id === SALON).at(-1), {
    device_external_id: SALON,
    transport: 'local',
  });
  assert.ok(fake.widgetRefreshes.includes('television'));
  await app.stop();
});

test('assumed power: off when it stops answering, on when it answers again', async () => {
  const { fake, app, network } = await setup();
  const tv = network.tvs.get('192.168.1.50');
  tv.unplugged = true;
  await app.poll();
  await app.flushStates();
  assert.equal(last(fake, SALON, 'power'), 1, 'one failure is not enough');
  await app.poll();
  await app.flushStates();
  assert.equal(last(fake, SALON, 'power'), 0);
  assert.equal(
    fake.transports.filter((entry) => entry.device_external_id === SALON).at(-1).transport,
    'unreachable',
  );
  tv.unplugged = false;
  tv.volume = 33;
  await app.poll();
  await app.flushStates();
  assert.equal(last(fake, SALON, 'power'), 1);
  assert.equal(last(fake, SALON, 'volume'), 33);
  await app.stop();
});

test('power: the power key toggles standby, Wake-on-LAN when it does not answer', async () => {
  const { fake, app, network } = await setup();
  const tv = network.tvs.get('192.168.1.50');
  ok(await setValue(fake, SALON, 'power', 1));
  assert.deepEqual(tv.keys, [], 'already on: no key (it would put it in standby)');
  ok(await setValue(fake, SALON, 'power', 0));
  assert.deepEqual(tv.keys, ['power']);
  await app.flushStates();
  assert.equal(last(fake, SALON, 'power'), 0);
  ok(await setValue(fake, SALON, 'power', 0));
  assert.deepEqual(tv.keys, ['power'], 'already in standby');
  ok(await setValue(fake, SALON, 'power', 1));
  assert.deepEqual(tv.keys, ['power', 'power']);
  // Switched off at the wall.
  tv.unplugged = true;
  await app.poll();
  await app.poll();
  ok(await setValue(fake, SALON, 'power', 1));
  assert.deepEqual(fake.bodies('POST', '/network/wake').at(-1)?.mac, '00:9e:c8:a1:b2:c3');
  // The TV on another subnet has no known MAC: no Wake-on-LAN possible.
  network.tvs.get('10.0.0.2').unplugged = true;
  await app.poll();
  await app.poll();
  const refused = await setValue(fake, BEDROOM, 'power', 1);
  assert.equal(refused.success, false);
  assert.match(refused.error, /adresse MAC est inconnue/);
  await app.stop();
});

test('volume: slider, mute and restore, volume keys', async () => {
  const { fake, app, network } = await setup();
  const tv = network.tvs.get('192.168.1.50');
  ok(await setValue(fake, SALON, 'volume', 27));
  assert.equal(tv.volume, 27);
  ok(await setValue(fake, SALON, 'volume', 500));
  assert.equal(tv.volume, 100, 'bounded by the maximum');
  ok(await setValue(fake, SALON, 'volume', 12));
  ok(await setValue(fake, SALON, 'volume_mute', 1));
  assert.equal(tv.volume, 0);
  await app.flushStates();
  assert.equal(last(fake, SALON, 'volume'), 0);
  ok(await setValue(fake, SALON, 'volume_mute', 1));
  assert.equal(tv.volume, 12, 'back to the volume before');
  ok(await setValue(fake, SALON, 'volume_up', 1));
  assert.equal(tv.volume, 13);
  await app.flushStates();
  assert.equal(last(fake, SALON, 'volume'), 13);
  ok(await setValue(fake, SALON, 'back', 1));
  ok(await setValue(fake, SALON, 'enter', 1));
  assert.deepEqual(tv.keys.slice(-2), ['back', 'enter']);
  await app.stop();
});

test('commands on a TV that does not answer: a clear error', async () => {
  const { fake, app, network } = await setup();
  network.tvs.get('192.168.1.50').unplugged = true;
  await app.poll();
  await app.poll();
  const refused = await setValue(fake, SALON, 'volume', 10);
  assert.equal(refused.success, false);
  assert.equal(refused.error, 'Xiaomi TV Salon ne répond pas : allumez-le d’abord.');
  await app.stop();
});

test('scene actions: open an app, send keys, change input', async () => {
  const { fake, app, network } = await setup();
  const tv = network.tvs.get('192.168.1.50');
  const launched = ok(await fake.sceneAction('launch_app', { device: SALON, app: 'netflix' }));
  assert.deepEqual(launched.outputs, { app_name: 'Netflix', package: 'com.netflix.ninja' });
  ok(await fake.sceneAction('launch_app', { device: SALON, app: 'meteo' }));
  ok(await fake.sceneAction('launch_app', { device: SALON, app: 'com.example.unlisted' }));
  assert.deepEqual(tv.launched, [
    'com.netflix.ninja',
    'com.xiaomi.tweather',
    'com.example.unlisted',
  ]);
  const unknown = await fake.sceneAction('launch_app', { device: SALON, app: 'Disney' });
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /Aucune application « Disney »/);

  const keys = ok(
    await fake.sceneAction('send_keys', {
      device: SALON,
      keys: 'home, down, enter',
      delay_ms: 300,
    }),
  );
  assert.deepEqual(keys.outputs, { keys_sent: 3 });
  assert.deepEqual(tv.keys, ['home', 'down', 'enter']);
  const bad = await fake.sceneAction('send_keys', { device: SALON, keys: 'home, reboot' });
  assert.equal(bad.success, false);

  ok(await fake.sceneAction('change_source', { device: SALON, source: 'hdmi2' }));
  assert.deepEqual(tv.sources, ['hdmi2']);
  assert.equal(
    (await fake.sceneAction('change_source', { device: SALON, source: 'vga' })).success,
    false,
  );
  assert.equal(
    (await fake.sceneAction('send_keys', { device: id('nope'), keys: 'home' })).success,
    false,
  );

  // Only the declared outputs.
  for (const [key, outputs] of [
    ['launch_app', launched.outputs],
    ['send_keys', keys.outputs],
  ]) {
    assert.deepEqual(Object.keys(outputs).sort(), [...SCENE_ACTION_OUTPUTS[key]].sort());
    for (const value of Object.values(outputs)) {
      assert.ok(['string', 'number'].includes(typeof value));
    }
  }
  await app.stop();
});

test('widget: state, volume, applications with icons, four buttons', async () => {
  const { fake, app, network } = await setup();
  const content = ok(
    await fake.widgetGet('television', { settings: { device: SALON }, language: 'fr' }),
  ).content;
  assert.deepEqual(validateWidgetContent(content), []);
  const types = content.components.map((component) => component.type);
  assert.deepEqual(types, [
    'text',
    'status',
    'gauge',
    'card-list',
    'button',
    'button',
    'button',
    'button',
  ]);
  const list = content.components.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => item.title),
    ['YouTube', 'Netflix', 'PatchWall', 'Météo'],
  );
  const image = ok(await fake.widgetGetImage(list.items[0].image)).image;
  assert.deepEqual(validateWidgetImage(image), []);
  const buttons = content.components.filter((component) => component.type === 'button');
  assert.deepEqual(
    buttons.map((button) => button.action.key),
    ['power_off', 'home', 'mute', 'launch_app'],
  );
  assert.deepEqual(
    buttons[3].action.fields[0].options.map((option) => option.value),
    [
      'com.google.android.youtube.tv',
      'com.netflix.ninja',
      'com.mitv.tvhome',
      'com.xiaomi.tweather',
    ],
  );

  const tv = network.tvs.get('192.168.1.50');
  const settings = { settings: { device: SALON } };
  const opened = ok(
    await fake.widgetAction(
      'television',
      'launch_app',
      { device: SALON },
      {
        ...settings,
        values: { app: 'com.netflix.ninja' },
      },
    ),
  );
  assert.equal(opened.message.fr, 'Netflix s’ouvre.');
  assert.deepEqual(tv.launched, ['com.netflix.ninja']);
  const muted = ok(await fake.widgetAction('television', 'mute', { device: SALON }, settings));
  assert.equal(muted.message.en, 'Sound muted.');
  ok(await fake.widgetAction('television', 'home', { device: SALON }, settings));
  const standby = ok(
    await fake.widgetAction('television', 'power_off', { device: SALON }, settings),
  );
  assert.equal(standby.message.de, 'Der Fernseher geht in den Standby.');
  assert.deepEqual(tv.keys.slice(-2), ['home', 'power']);

  const off = ok(await fake.widgetGet('television', { settings: { device: SALON } })).content;
  assert.deepEqual(validateWidgetContent(off), []);
  assert.deepEqual(
    off.components.filter((component) => component.type === 'button').map((b) => b.action.key),
    ['power_on'],
  );

  // A TV that does not answer, and a widget without a TV.
  network.tvs.get('10.0.0.2').unplugged = true;
  await app.poll();
  await app.poll();
  const bedroom = ok(await fake.widgetGet('television', { settings: { device: BEDROOM } })).content;
  assert.deepEqual(validateWidgetContent(bedroom), []);
  assert.equal(bedroom.components.filter((component) => component.type === 'button').length, 0);
  const none = ok(await fake.widgetGet('television', { settings: {} })).content;
  assert.deepEqual(validateWidgetContent(none), []);
  await app.stop();
});

test('configuration button: every TV with its address and MAC', async () => {
  const { fake, app } = await setup({ create: false });
  const message = ok(await fake.action('test_connection')).message;
  assert.equal(
    message.fr,
    '2 téléviseur(s) trouvé(s) : Xiaomi TV Salon (192.168.1.50, 00:9e:c8:a1:b2:c3) ; ' +
      'Xiaomi TV 10-0-0-2 (10.0.0.2, MAC inconnue, pas de Wake-on-LAN).',
  );
  await app.stop();

  const empty = await setup({ create: false, network: fakeTvNetwork([]), config: {} });
  const none = ok(await empty.fake.action('test_connection')).message;
  assert.match(none.en, /^No Xiaomi TV answered on port 6095/);
  assert.equal(empty.fake.connectionStatus.connected, false);
  await empty.app.stop();
});

test('a TV that changed address is found again by its MAC', async () => {
  const { fake, app, network } = await setup();
  const tv = network.tvs.get('192.168.1.50');
  network.tvs.delete(tv.host);
  tv.host = '192.168.1.77';
  network.add(tv);
  await app.scan();
  ok(await setValue(fake, SALON, 'enter', 1));
  assert.deepEqual(tv.keys, ['enter']);
  assert.equal(app.entries.get('009ec8a1b2c3').host, '192.168.1.77');
  await app.stop();
});

test('restart: the TVs of /data are polled before any search', async () => {
  const first = await setup();
  await first.app.stop();
  const network = fakeTvNetwork(tvs());
  const gladys = createFakeGladys({
    config: CONFIG,
    devices: structuredClone(first.fake.discoveredDevices),
  });
  // The search finds nothing: the states can only come from the TVs of /data.
  let scanned = false;
  gladys.scanNetwork = async () => {
    scanned = true;
    return [];
  };
  const app = createApp(gladys, {
    client: createTvClient({ fetch: network.fetch }),
    storage: first.storage,
    logger: silentLogger,
  });
  await gladys.connect();
  await app.start();
  await app.flushStates();
  assert.ok(scanned);
  assert.equal(gladys.fake.lastState(`${SALON}:volume`), 20);
  assert.equal(gladys.fake.lastState(`${BEDROOM}:volume`), 5, 'typed address, polled too');
  await app.stop();
});
