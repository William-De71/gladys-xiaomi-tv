// Widget contents for the generated illustrations, built by the real code of
// the integration: the app itself (src/app.js) wired to the fake Gladys of the
// SDK and the fake Xiaomi TVs of the tests, on a made-up evening: the living
// room TV is on with its applications, the bedroom TV is switched off at the
// wall (Wake-on-LAN possible).
// The application icons are drawn here (a coloured square and an initial):
// they stand for the PNG icons a real TV serves.
// Written as JSON for render.js: node gen.mjs <repo> <out.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(join(repo, file)).href);
const { createApp } = await load('src/app.js');
const { createTvClient } = await load('src/mitv/client.js');
const { LANGUAGES } = await load('src/i18n.js');
const { memoryStorage } = await load('src/storage.js');
const { createFakeGladys } = await import(
  pathToFileURL(join(repo, 'node_modules/@gladysassistant/integration-sdk/lib/testing.js')).href
);
const { FakeTv, fakeTvNetwork, noSleep } = await load('test/helpers.js');

const manifest = JSON.parse(readFileSync(join(repo, 'gladys-assistant-integration.json'), 'utf8'));
const silent = { debug() {}, info() {}, warn() {}, error() {}, child: () => silent };

const APPS = [
  ['com.google.android.youtube.tv', 'YouTube', '#e62117', 'Y'],
  ['com.netflix.ninja', 'Netflix', '#141414', 'N'],
  ['com.amazon.amazonvideo.livingroom', 'Prime Video', '#1a98ff', 'P'],
  ['com.spotify.tv.android', 'Spotify', '#1db954', 'S'],
  ['com.mitv.tvhome', 'PatchWall', '#ff6900', 'M'],
  [
    'com.xiaomi.tweather',
    { en: 'Weather', fr: 'Météo', de: 'Wetter', es: 'Tiempo' },
    '#2f80ed',
    'W',
  ],
  [
    'com.mitv.mediaexplorer',
    { en: 'Media', fr: 'Médias', de: 'Medien', es: 'Medios' },
    '#7b61ff',
    'M',
  ],
];

const NAMES = {
  salon: { en: 'Living room TV', fr: 'TV salon', de: 'Wohnzimmer-TV', es: 'TV salón' },
  bedroom: { en: 'Bedroom TV', fr: 'TV chambre', de: 'Schlafzimmer-TV', es: 'TV dormitorio' },
};

const iconSvg = (color, letter) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="${color}"/>` +
      `<text x="48" y="64" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`,
  ).toString('base64')}`;

/**
 * @description One language: the living room TV on, the bedroom TV off.
 * @param {string} language - Language.
 * @returns {Promise<{ contents: object, images: object }>} The widget contents and their images.
 */
async function contents(language) {
  const salon = new FakeTv({ host: '192.168.1.50', mac: '00:9e:c8:a1:b2:c3', volume: 18 });
  salon.apps = APPS.map(([pkg, name], index) => ({
    PackageName: pkg,
    AppName: typeof name === 'string' ? name : name[language],
    Order: index + 1,
    IconURL: `http://192.168.1.50:6095/request?action=getResource&name=${pkg}0.png`,
  }));
  const bedroom = new FakeTv({ host: '192.168.1.51', mac: '00:9e:c8:a1:b2:d4' });
  const network = fakeTvNetwork([salon, bedroom]);
  const gladys = createFakeGladys({ config: { language } });
  gladys.scanNetwork = async () => network.ssdp();
  const app = createApp(gladys, {
    client: createTvClient({ fetch: network.fetch }),
    storage: memoryStorage(),
    logger: silent,
    sleep: noSleep,
  });
  await gladys.connect();
  await app.start();
  for (const device of gladys.fake.discoveredDevices) {
    const key = device.external_id.endsWith('d4') ? 'bedroom' : 'salon';
    await gladys.fake.deviceCreated({ ...structuredClone(device), name: NAMES[key][language] });
  }
  bedroom.unplugged = true;
  await app.poll();
  await app.poll();

  const get = async (device) =>
    (await gladys.fake.widgetGet('television', { settings: { device }, language })).data.content;
  const on = await get('ext:test-integration:device:009ec8a1b2c3');
  const off = await get('ext:test-integration:device:009ec8a1b2d4');
  await app.stop();

  // The icon keys hash the served bytes (identical in the fake TV): draw one
  // icon per application instead, in the order of the list.
  const images = {};
  const list = on.components.find((component) => component.type === 'card-list');
  list.items.forEach((item, index) => {
    const [, , color, letter] = APPS[index];
    item.image = `illustration-${index}`;
    images[item.image] = iconSvg(color, letter);
  });
  return { contents: { television: on, television_off: off }, images };
}

const all = {};
const images = {};
for (const language of LANGUAGES) {
  const result = await contents(language);
  all[language] = result.contents;
  Object.assign(images, result.images);
}

const widget = manifest.widgets.find((item) => item.key === 'television');
const card = { icon: widget.icon, label: widget.label };
writeFileSync(
  out,
  JSON.stringify({ contents: all, images, cards: { television: card, television_off: card } }),
);
