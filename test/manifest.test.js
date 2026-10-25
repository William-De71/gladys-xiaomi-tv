// The manifest and the code agree: every declared action, widget and
// configuration key has its code, every version says the same thing, and the
// manifest respects what the store and the Gladys core expect.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ACTIONS } from '../src/app.js';
import { DEFAULTS, LANGUAGES, POLL_INTERVALS, RESCAN_INTERVALS } from '../src/config.js';
import { MAX_SEQUENCE } from '../src/control.js';
import { SOURCES } from '../src/mitv/client.js';
import { SSDP_TARGET } from '../src/mitv/discovery.js';
import { SCENE_ACTION_OUTPUTS, SCENE_ACTIONS } from '../src/scenes.js';
import { WIDGETS } from '../src/widgets.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('gladys-assistant-integration.json'));
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const byKey = (list) => Object.fromEntries(list.map((item) => [item.key, item]));

test('one version everywhere, image of this repository', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-xiaomi-tv:${pkg.version}`);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.match(
    manifest.cover_image,
    /^https:\/\/raw\.githubusercontent\.com\/William-De71\/gladys-xiaomi-tv\/main\/cover\.jpg$/,
  );
});

test('store rules: type, Gladys version, transports, categories, permissions', () => {
  assert.equal(manifest.type, 'device');
  // widgets and scene_actions need 5.1.0, the form of the "Open an app"
  // button 5.2.0, the catalog keywords 5.3.0.
  assert.equal(manifest.gladys_version, '>=5.3.0');
  // Everything stays on the local network: no cloud channel.
  assert.deepEqual(manifest.transports, ['local']);
  assert.deepEqual(manifest.categories, ['multimedia']);
  assert.equal(manifest.name, 'Xiaomi TV');
  // The mediated SSDP search, and Wake-on-LAN to switch on a TV that does not answer.
  assert.deepEqual(manifest.network_discovery, [{ type: 'ssdp', st: SSDP_TARGET }]);
  assert.equal(manifest.network_wake, true);
  for (const key of ['location', 'containers', 'webhooks', 'scene_triggers']) {
    assert.equal(manifest[key], undefined, key);
  }
});

test('catalog keywords, worldwide (Gladys 5.3.0)', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  for (const keyword of keywords) {
    assert.ok(keyword.trim().length >= 2 && keyword.trim().length <= 30, keyword);
  }
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length);
  assert.ok(!normalized.includes(manifest.name.toLowerCase()));
  // Local network only: usable wherever the TV is.
  assert.equal(manifest.countries, undefined);
});

test('configuration: keys, defaults and choices of the code', () => {
  const fields = byKey(manifest.config_schema);
  const values = (field) => field.options.map((option) => option.value);
  assert.deepEqual(values(fields.language), LANGUAGES);
  assert.deepEqual(values(fields.poll_interval), POLL_INTERVALS.map(String));
  assert.deepEqual(values(fields.rescan_interval), RESCAN_INTERVALS.map(String));
  for (const [key, value] of Object.entries(DEFAULTS)) {
    assert.equal(fields[key].default, value, key);
  }
  // `text` / `password` are refused by the store; no secret is needed.
  for (const field of manifest.config_schema) {
    assert.ok(['string', 'select', 'section'].includes(field.type), field.key);
  }
  assert.equal(fields.GLADYS_PREFER_LOCAL, undefined, 'one transport: no local preference');
});

test('configuration buttons: the keys of the code', () => {
  assert.deepEqual(
    manifest.actions.map((action) => action.key).sort(),
    Object.values(ACTIONS).sort(),
  );
});

test('scene actions: keys, fields, options and outputs of the code', () => {
  const actions = byKey(manifest.scene_actions);
  assert.deepEqual(Object.keys(actions).sort(), Object.values(SCENE_ACTIONS).sort());
  for (const action of manifest.scene_actions) {
    const device = action.fields.find((field) => field.key === 'device');
    assert.equal(device.source, 'devices');
    assert.equal(device.required, true);
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120);
    assert.deepEqual(
      (action.outputs ?? []).map((output) => output.key),
      SCENE_ACTION_OUTPUTS[action.key],
      action.key,
    );
  }
  assert.deepEqual(
    byKey(actions.change_source.fields).source.options.map((option) => option.value),
    SOURCES,
  );
  const keys = byKey(actions.send_keys.fields);
  assert.match(keys.keys.description.en, new RegExp(`^Up to ${MAX_SEQUENCE} keys`));
  assert.deepEqual([keys.delay_ms.min, keys.delay_ms.max, keys.delay_ms.default], [200, 3000, 700]);
  // 30 keys with the longest pause stay within the timeout.
  assert.ok(actions.send_keys.timeout_seconds >= (MAX_SEQUENCE * 3000) / 1000);
});

test('widgets: the keys of the code, settings without secrets', () => {
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key),
    Object.values(WIDGETS),
  );
  const tv = byKey(manifest.widgets).television;
  assert.equal(byKey(tv.settings).device.source, 'devices');
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
});
