// The port 6095 client, the multi-request commands and the discovery helpers,
// against fake TVs (test/helpers.js): no socket is ever opened.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import {
  createTvClient,
  parseApps,
  parseIsAlive,
  parseVolume,
  readAnswer,
  TvError,
} from '../src/mitv/client.js';
import { parseKeys, sendKeys, setVolume } from '../src/control.js';
import {
  normalizeMac,
  parseHosts,
  probeHosts,
  ssdpCandidates,
  ssdpScan,
} from '../src/mitv/discovery.js';
import { FakeTv, fakeTvNetwork, noSleep, PNG, silentLogger } from './helpers.js';

const setup = (options = {}) => {
  const tv = new FakeTv({ host: '192.168.1.50', ...options });
  const network = fakeTvNetwork([tv]);
  return { tv, network, client: createTvClient({ fetch: network.fetch }) };
};

test('answers: both firmware formats, refusals, data as a JSON string', () => {
  assert.deepEqual(readAnswer({ status: 0, msg: 'success', data: { a: 1 } }), { a: 1 });
  assert.deepEqual(readAnswer({ request_result: 200, msg: 'success', data: '{"volum":3}' }), {
    volum: 3,
  });
  assert.equal(readAnswer({ msg: 'success' }), null);
  assert.throws(() => readAnswer({ status: 1, msg: 'unknown action' }), TvError);
  assert.throws(() => readAnswer({ request_result: 500 }), TvError);
  assert.throws(() => readAnswer('<html>'), TvError);
});

test('isalive, volume and applications are read leniently', () => {
  assert.deepEqual(parseIsAlive({ devicename: ' 客厅的小米电视 ', platform: 630, build: 1267 }), {
    name: '客厅的小米电视',
    platform: '630',
    build: '1267',
    version: '',
  });
  assert.deepEqual(parseVolume({ volum: 7, maxVolum: 15 }), { volume: 7, max: 15 });
  assert.deepEqual(parseVolume({ volum: '12' }), { volume: 12, max: null });
  assert.throws(() => parseVolume({}), TvError);
  const apps = parseApps({
    AppInfo: [
      { PackageName: 'com.b', AppName: 'B', Order: 2 },
      { PackageName: 'com.a', AppName: 'A', Order: 1 },
      { PackageName: 'com.a', AppName: 'A again', Order: 3 },
      { PackageName: 'bad package!', AppName: 'X' },
      { PackageName: 'com.c' },
    ],
  });
  assert.deepEqual(
    apps.map((app) => [app.package, app.name]),
    [
      ['com.a', 'A'],
      ['com.b', 'B'],
      ['com.c', 'com.c'],
    ],
  );
});

test('client: the requests of the Mi Remote app, on port 6095', async () => {
  const { client, network, tv } = setup({ oldFirmware: true });
  assert.equal((await client.isAlive(tv.host)).name, 'Living room TV');
  assert.deepEqual(await client.getVolume(tv.host), { volume: 20, max: 100 });
  await client.key(tv.host, 'home');
  await client.startApp(tv.host, 'com.netflix.ninja');
  await client.changeSource(tv.host, 'hdmi2');
  assert.deepEqual(tv.keys, ['home']);
  assert.deepEqual(tv.launched, ['com.netflix.ninja']);
  assert.deepEqual(tv.sources, ['hdmi2']);
  assert.deepEqual(
    network.requests.map((href) => new URL(href).pathname + new URL(href).search),
    [
      '/request?action=isalive',
      '/general?action=getVolum',
      '/controller?action=keyevent&keycode=home',
      '/controller?action=startapp&type=packagename&packagename=com.netflix.ninja',
      '/controller?action=changesource&source=hdmi2',
    ],
  );
  await assert.rejects(client.key(tv.host, 'reboot'), RangeError);
  await assert.rejects(client.changeSource(tv.host, 'vga'), RangeError);
  await assert.rejects(client.isAlive('192.168.1.99'), TypeError);
});

test('client: icons only from the TV itself', async () => {
  const { client, tv } = setup();
  const apps = await client.apps(tv.host);
  assert.equal(apps[0].name, 'YouTube');
  assert.deepEqual(await client.icon(tv.host, apps[0].icon), PNG);
  assert.equal(await client.icon(tv.host, 'http://evil.example/x.png'), null);
  assert.equal(await client.icon(tv.host, 'https://192.168.1.50/x.png'), null);
  assert.equal(await client.icon(tv.host, 'not a url'), null);
});

test('volume: reached with the keys, read back after each burst', async () => {
  const { client, tv } = setup({ volume: 20 });
  assert.equal(await setVolume(client, tv.host, 32, { sleep: noSleep }), 32);
  assert.equal(tv.volume, 32);
  assert.equal(tv.keys.filter((key) => key === 'volumeup').length, 12);
  assert.equal(await setVolume(client, tv.host, 30, { sleep: noSleep }), 30);
  assert.equal(await setVolume(client, tv.host, 30, { sleep: noSleep }), 30, 'nothing to do');
  assert.equal(tv.keys.length, 14);
  assert.equal(await setVolume(client, tv.host, 0, { sleep: noSleep }), 0);
});

test('volume: a TV whose key moves 2 steps stops past the target', async () => {
  const { client, tv } = setup({ volume: 10, step: 2 });
  assert.equal(await setVolume(client, tv.host, 15, { sleep: noSleep }), 16);
  assert.deepEqual(tv.keys, ['volumeup', 'volumeup', 'volumeup'], 'one press, then two');
});

test('volume: a volume that never moves is an error, not an endless loop', async () => {
  const { client, tv } = setup({ volume: 10, step: 0 });
  await assert.rejects(setVolume(client, tv.host, 40, { sleep: noSleep }), TvError);
  assert.equal(tv.keys.length, 2, 'two presses without effect');
});

test('key sequences', async () => {
  assert.deepEqual(parseKeys('Home, down;down  enter'), ['home', 'down', 'down', 'enter']);
  assert.throws(() => parseKeys('home, reboot'), RangeError);
  assert.throws(() => parseKeys(''), RangeError);
  assert.throws(() => parseKeys(Array(31).fill('up').join(',')), RangeError);
  const { client, tv } = setup();
  const pauses = [];
  const sent = await sendKeys(client, tv.host, ['home', 'right', 'enter'], 500, {
    sleep: async (ms) => pauses.push(ms),
  });
  assert.equal(sent, 3);
  assert.deepEqual(tv.keys, ['home', 'right', 'enter']);
  assert.deepEqual(pauses, [500, 500]);
});

test('discovery helpers: SSDP answers, MAC addresses, typed addresses', async () => {
  assert.equal(normalizeMac('00:9E:C8:A1:B2:C3'), '009ec8a1b2c3');
  assert.equal(normalizeMac('00:00:00:00:00:00'), '');
  assert.equal(normalizeMac('nope'), '');
  const candidates = ssdpCandidates([
    { source_ip: '192.168.1.50', headers: '' },
    { source_ip: '192.168.1.50', source_mac: '00:9e:c8:a1:b2:c3', headers: '' },
    { source_ip: '192.168.1.1', headers: '' },
    { source_ip: 'fe80::1', headers: '' },
    null,
  ]);
  assert.deepEqual(
    [...candidates],
    [
      ['192.168.1.50', '009ec8a1b2c3'],
      ['192.168.1.1', ''],
    ],
  );
  assert.deepEqual(parseHosts('192.168.1.50, 192.168.1.50;10.0.0.300 tv.local 10.0.0.2'), [
    '192.168.1.50',
    '10.0.0.2',
  ]);
  const { client } = setup();
  const found = await probeHosts(client, ['192.168.1.1', '192.168.1.50', '192.168.1.60']);
  assert.deepEqual([...found.keys()], ['192.168.1.50']);
});

test('discovery: the mediated SSDP scan and its refusals', async () => {
  const gladys = createFakeGladys({
    scanResults: { ssdp: [{ source_ip: '192.168.1.50', headers: '' }] },
  });
  await gladys.connect();
  const ok = await ssdpScan(gladys, { logger: silentLogger });
  assert.equal(ok.error, null);
  assert.deepEqual([...ok.candidates.keys()], ['192.168.1.50']);
  assert.deepEqual(gladys.fake.scans.at(-1), { type: 'ssdp', timeout_seconds: 4 });
  for (const [status, error] of [
    [403, 'forbidden'],
    [429, 'busy'],
    [500, 'failed'],
  ]) {
    gladys.scanNetwork = async () => {
      throw Object.assign(new Error('refused'), { status });
    };
    assert.equal((await ssdpScan(gladys, { logger: silentLogger })).error, error);
  }
});
