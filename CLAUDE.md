# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Xiaomi TVs running MIUI TV /
PatchWall: a Node.js service (Node 22+, ESM, no build step, no dependency but
the SDK) in its own sandboxed Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and to the TVs **on the local network only** (`transports: ["local"]`).

A **device integration** (`type: "device"`, Gladys 5.3.0+: the "Open an app"
widget button has a form (5.2.0), the catalog `keywords` need 5.3.0). The TVs expose an undocumented HTTP API on port
6095 (the one of the Mi Remote app), implemented in `src/mitv/` from the
community documentation: [pymitv](https://github.com/simse/pymitv) (MIT, used
by the Home Assistant `xiaomi_tv` integration) and
[mireco](https://github.com/spocky/mireco) (GPL: reference only, never copy
its code). Android TV / Google TV models do not have this port.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
node --test --test-name-pattern "volume"  # tests whose name matches
UPDATE_BASELINE=1 npm test                # rewrite test/fixtures/discovery.baseline.json (on purpose only)
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check
docs/illustrations/render.sh              # widget illustrations (Chrome, ImageMagick, Pillow)
scripts/build-cover.sh                    # cover.jpg from cover.svg (Inkscape, ImageMagick)
```

## Architecture

```
index.js                     SDK wiring only: createApp(gladys) + connect + start
src/app.js                   every handler: discovery, poll, assumed power, commands, scenes, widget
src/config.js                config_schema -> { hosts, pollMs, rescanMs, language }
src/devices.js               entry -> Gladys device (features), values, remote keys
src/control.js               closed-loop volume with the keys, key sequences
src/states.js                state publication: created devices only, coalesced, 240/min, 429 pause
src/scenes.js                scene action keys and their outputs
src/widgets.js               the `television` widget (pure, reused by docs/illustrations)
src/i18n.js                  runtime texts in en / fr / de / es
src/storage.js               JSON files in /data (tvs.json: MAC -> address, name, max volume)
src/mitv/client.js           port 6095 client: isalive, getVolum, keyevent, startapp, changesource, apps, icons
src/mitv/discovery.js        mediated SSDP scan (candidates + MAC), isalive probes, typed addresses
.github/scripts/release.mjs  version, changelog, version files, PR title checks
```

## Rules

- **External ids are forever**: `ext:{selector}:device:{MAC}` (12 lowercase
  hex digits; `ip-a-b-c-d` for a typed address whose MAC Gladys cannot see)
  and `…:<feature key>` (`power`, `volume`, `volume_up`, `volume_down`,
  `volume_mute`, `up`, `down`, `left`, `right`, `enter`, `menu`, `back`).
  Config, action, field, widget, setting and output keys too.
- **Feature fields** compared by the Discover tab "Update" (category, type,
  unit, min, max, step, features added or removed): changing them forces users
  to delete and recreate their devices. `test/fixtures/discovery.baseline.json`
  pins them; update it only on purpose, with a migration note. `min`, `max`,
  `read_only` and `has_feedback` on EVERY feature. The volume `max` is read
  from the TV once (`maxVolum`, 100 without it) and never changes afterwards.
- **Television category only**: every type but `binary`, `volume` and
  `channel` is a push button on the dashboard (front `consts.js`). A new key
  must be an existing `DEVICE_FEATURE_TYPES.TELEVISION` type labeled by the
  front (test/devices.test.js).
- **Power is assumed**: the power key toggles on / standby and a TV in
  standby still answers `isalive`. Never send the power key to "turn on" a
  TV already assumed on. Off when unreachable twice in a row, on when it
  answers again. Wake-on-LAN (`network_wake`) only when the TV does not
  answer and its MAC is known.
- **No direct volume**: `setVolum` needs a signature whose salt is not
  public. The volume is reached with `volumeup` / `volumedown` in bursts,
  read back after each one (src/control.js); mute = volume 0 and back.
- **States**: only for the devices the user created, through
  `src/states.js`. Republish everything known in `onDeviceCreated`.
- **No scene trigger**: the TV pushes nothing; on / off and volume are device
  states, already covered by the Gladys "device state change" trigger.
- **The container rootfs is read-only**: the only writable folder is /data.
- **Widget content**: after any change, run `docs/illustrations/render.sh` and
  look at the four images. Respect the SDK text bounds (caption 80 but one
  line in the card, button label 24, list of 8 cards). The app list uses the
  `list` display: the `grid` one crops images to 2:3 posters.
- **Icons** are downloaded from the TV only (same host, http), checked as
  PNG / JPEG / WebP, and their image key is a hash of the bytes.
- **User-facing text** exists in en, fr, de and es: manifest, `src/i18n.js`,
  `docs/*.md`, `README*.md`. `test/i18n.test.js` checks it. Use the words of
  the Gladys UI (Discover / Découverte / Entdecken / Descubrir, the
  television feature labels of `front/src/config/i18n`).
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, `package-lock.json` or the manifest, nor the `docker_image`
  tag.
- **Changelog**: Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (fake TVs behind a fake `fetch`
  in test/helpers.js).

## Pitfalls

- The container is behind the Docker bridge: multicast from it never reaches
  the LAN. Discovery goes through `scanNetwork('ssdp')` (`st: ssdp:all`,
  declared in `network_discovery`); unicast HTTP from the container does
  cross the bridge.
- The core adds `source_mac` to an SSDP answer only when its ARP table knows
  the responder. Asking the TV on port 6095 (forwarded by the host) fills it:
  a TV found without MAC is searched a second time.
- Answers come in two shapes: `{ status: 0, msg, data }` and, on older
  firmware, `{ request_result: 200, msg, data }`; `data` is sometimes a JSON
  string (`getVolum` always). `readAnswer` handles both.
- The TV name (`devicename`) is a label the user can change on the TV: never
  an id.
- Gladys does not send the user's language with a scan or a command: feature
  names and scene errors use the `language` setting.
