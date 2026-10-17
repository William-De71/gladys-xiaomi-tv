// TVs -> Gladys devices. The Discover tab pitfalls of the Gladys core are
// checked here: a single invalid feature makes the whole discovery list
// refused, a missing min / max / read_only / has_feedback only fails when the
// user clicks "Add", and a category/type pair the front does not label shows
// "Device (undefined)".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

import { normalizeConfig } from '../src/config.js';
import {
  buildDevice,
  deviceName,
  FEATURE_KEYS,
  featureValues,
  platformId,
  REMOTE_KEYS,
} from '../src/devices.js';
import { KEYS } from '../src/mitv/client.js';
import { createStatePublisher } from '../src/states.js';
import { fakeClock, silentLogger } from './helpers.js';

// Television types labeled by the Gladys front (deviceFeatureCategory.television
// in front/src/config/i18n/en.json, checked on v5.2.0 and v5.2.1).
const LABELED_TYPES = new Set([
  'binary',
  'volume',
  'volume-up',
  'volume-down',
  'volume-mute',
  'up',
  'down',
  'left',
  'right',
  'enter',
  'menu',
  'return',
]);
// Shown as a value control by the dashboard; every other television type is a
// push button (front/src/utils/consts.js, TelevisionContinuousControlFeatureTypes).
const CONTINUOUS = new Set(['binary', 'volume', 'channel']);

const sample = (overrides = {}) => ({
  id: '009ec8a1b2c3',
  host: '192.168.1.50',
  mac: '009ec8a1b2c3',
  tvName: 'Living room TV',
  platform: '630',
  maxVolume: 100,
  ...overrides,
});

test('every feature: labeled pair, bounds, read_only, has_feedback, history', () => {
  const gladys = createFakeGladys();
  const device = buildDevice(gladys, sample(), 'en');
  assert.equal(device.should_poll, false, 'the integration polls the TVs itself');
  assert.equal(device.poll_frequency, undefined);
  assert.equal(device.features.length, Object.keys(FEATURE_KEYS).length);
  for (const feature of device.features) {
    const where = feature.external_id;
    assert.equal(feature.category, 'television', where);
    assert.ok(LABELED_TYPES.has(feature.type), where);
    for (const field of ['min', 'max', 'read_only', 'has_feedback', 'keep_history']) {
      assert.notEqual(feature[field], undefined, `${where} ${field}`);
    }
    assert.ok(feature.min < feature.max, where);
    assert.equal(feature.read_only, false, where);
    assert.equal(feature.unit, undefined, where);
    assert.match(feature.name, /^Xiaomi TV Living room TV - .+$/);
    if (!CONTINUOUS.has(feature.type)) {
      assert.deepEqual([feature.min, feature.max, feature.has_feedback], [0, 1, false], where);
    }
  }
  assert.deepEqual(
    device.params.map((param) => param.name),
    ['XIAOMI_TV_HOST', 'XIAOMI_TV_MAC', 'XIAOMI_TV_PLATFORM'],
  );
});

test('remote keys: an existing SDK type and a key the TV knows', () => {
  const types = new Set(Object.values(DEVICE_FEATURE_TYPES.TELEVISION));
  for (const [key, { type, keycode }] of Object.entries(REMOTE_KEYS)) {
    assert.ok(types.has(type), key);
    assert.ok(keycode === null || KEYS.includes(keycode), key);
  }
});

test('the maximum volume of the TV bounds the volume feature', () => {
  const gladys = createFakeGladys();
  const volume = (entry) =>
    buildDevice(gladys, entry, 'en').features.find((feature) => feature.type === 'volume');
  assert.equal(volume(sample({ maxVolume: 15 })).max, 15);
  assert.equal(volume(sample({ maxVolume: null })).max, 100, 'default');
});

test('the whole discovery list is accepted by the fake Gladys, in every language', async () => {
  const gladys = createFakeGladys();
  await gladys.connect();
  for (const language of ['en', 'fr', 'de', 'es']) {
    const devices = [
      buildDevice(gladys, sample(), language),
      buildDevice(gladys, sample({ id: 'ip-10-0-0-2', host: '10.0.0.2', mac: '' }), language),
    ];
    const result = await gladys.publishDiscoveredDevices(devices);
    assert.equal(result.count, devices.length);
  }
});

test('discovery baseline (0.1.0): external ids and compared fields never change', () => {
  // Changing a feature key, category, type, unit, min, max or step forces
  // users to delete and recreate their devices: update the baseline only on
  // purpose (UPDATE_BASELINE=1 npm test), with a migration note in the docs.
  const file = new URL('./fixtures/discovery.baseline.json', import.meta.url);
  const gladys = createFakeGladys();
  const device = buildDevice(gladys, sample(), 'en');
  const current = {
    external_id: device.external_id,
    should_poll: device.should_poll,
    features: device.features.map((feature) => ({
      external_id: feature.external_id,
      category: feature.category,
      type: feature.type,
      unit: feature.unit ?? null,
      min: feature.min,
      max: feature.max,
      step: feature.step ?? null,
      read_only: feature.read_only,
    })),
  };
  if (process.env.UPDATE_BASELINE) {
    writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
  }
  assert.deepEqual(current, JSON.parse(readFileSync(file, 'utf8')));
});

test('ids and names', () => {
  assert.equal(platformId('009ec8a1b2c3', '192.168.1.50'), '009ec8a1b2c3');
  assert.equal(platformId('', '192.168.100.200'), 'ip-192-168-100-200');
  assert.equal(deviceName({ id: '009ec8a1b2c3', tvName: 'Salon' }), 'Xiaomi TV Salon');
  assert.equal(deviceName({ id: '009ec8a1b2c3', tvName: 'Mi TV 4S' }), 'Mi TV 4S');
  assert.equal(deviceName({ id: '009ec8a1b2c3', tvName: '客厅的小米电视' }), '客厅的小米电视');
  assert.equal(deviceName({ id: '009ec8a1b2c3', tvName: '' }), 'Xiaomi TV B2C3');
  assert.equal(deviceName({ id: 'ip-10-0-0-2', tvName: '' }), 'Xiaomi TV 10-0-0-2');
  const gladys = createFakeGladys();
  assert.equal(
    buildDevice(gladys, sample(), 'de').features[1].name,
    'Xiaomi TV Living room TV - Lautstärke',
  );
});

test('values: assumed power and volume, nothing for the keys', () => {
  assert.deepEqual(featureValues({ on: true, volume: 12 }), [
    ['power', 1],
    ['volume', 12],
  ]);
  assert.deepEqual(featureValues({ on: false }), [['power', 0]]);
  assert.deepEqual(featureValues({}), []);
});

test('configuration: defaults and bounds', () => {
  assert.deepEqual(normalizeConfig({}), {
    hosts: [],
    pollMs: 10000,
    rescanMs: 3600000,
    language: 'en',
  });
  const config = normalizeConfig({
    hosts: '192.168.1.50, 192.168.1.51',
    poll_interval: '30',
    rescan_interval: '0',
    language: 'es',
  });
  assert.deepEqual(config.hosts, ['192.168.1.50', '192.168.1.51']);
  assert.equal(config.pollMs, 30000);
  assert.equal(config.rescanMs, 0);
  assert.equal(normalizeConfig({ poll_interval: '7' }).pollMs, 10000);
});

test('state publication: coalesced, only created devices, paused on a 429', async () => {
  const gladys = createFakeGladys();
  await gladys.connect();
  const clock = fakeClock();
  const device = 'ext:test-integration:device:a1';
  const created = new Set([device]);
  const states = createStatePublisher(gladys, {
    logger: silentLogger,
    now: clock.now,
    isCreated: (id) => created.has(id),
  });
  states.push(`${device}:volume`, 20);
  states.push(`${device}:volume`, 19);
  states.push(`${device}:power`, 1);
  states.push('ext:test-integration:device:a2:power', 1);
  assert.equal(states.pendingCount(), 2, 'newest value only, created devices only');
  assert.equal(await states.flush(), 2);
  assert.equal(gladys.fake.lastState(`${device}:volume`), 19);

  const original = gladys.publishChangedStates.bind(gladys);
  gladys.publishChangedStates = async () => {
    const error = new Error('Too many requests');
    error.status = 429;
    throw error;
  };
  states.push(`${device}:volume`, 18);
  assert.equal(await states.flush(), 0);
  gladys.publishChangedStates = original;
  assert.equal(await states.flush(), 0, 'paused');
  clock.advance(31000);
  assert.equal(await states.flush(), 1, 'sent after the pause');

  created.add('ext:test-integration:device:a2');
  states.republish('ext:test-integration:device:a2');
  assert.equal(await states.flush(), 1, 'the value known before the creation');
  states.stop();
});
