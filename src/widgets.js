// -----------------------------------------------------------------------------
// Dashboard widget.
//
//   television   one TV (setting `device`): state, volume, the first six
//                applications with their icons, and four buttons: on /
//                standby, Home, mute and "Open an app" (a form listing every
//                application)
//
// Pure: the build function turns a snapshot into a content, so the tests and
// docs/illustrations/gen.mjs use the exact code Gladys gets. Every text is
// multi-language: Gladys caches the content per language.
// -----------------------------------------------------------------------------

import { LANGUAGES, t, truncate } from './i18n.js';

export const WIDGETS = { TV: 'television' };
export const WIDGET_ACTIONS = {
  POWER_ON: 'power_on',
  POWER_OFF: 'power_off',
  HOME: 'home',
  MUTE: 'mute',
  LAUNCH_APP: 'launch_app',
};
export const MAX_APPS_SHOWN = 6;
const MAX_FORM_OPTIONS = 100;
export const TTL_SECONDS = 60;

/**
 * @typedef {object} TvView
 * @property {string} deviceId - Gladys external id.
 * @property {string} name - Device name in Gladys.
 * @property {string} host - IP address.
 * @property {boolean} reachable - Answers on port 6095.
 * @property {boolean} on - Assumed on.
 * @property {boolean} canWake - MAC address known (Wake-on-LAN).
 * @property {number|null} volume - Current volume.
 * @property {number} maxVolume - Maximum volume.
 * @property {boolean} muted - Muted by the integration.
 */

const state = (view) => {
  if (!view.reachable) {
    return { key: 'widgetUnreachable', color: 'danger' };
  }
  return view.on
    ? { key: 'widgetOn', color: 'success' }
    : { key: 'widgetStandby', color: 'neutral' };
};

/**
 * @description The `television` widget.
 * @param {TvView|null} view - The TV, null when the setting points nowhere.
 * @param {Array<{ package: string, name: string, image?: string }>} apps - Its
 * applications in the order of the TV (the first ones with an icon key).
 * @returns {object} The widget content.
 */
export function buildTvWidget(view, apps = []) {
  if (!view) {
    return {
      version: 1,
      ttl_seconds: TTL_SECONDS,
      components: [{ type: 'text', text: t('widgetChooseDevice'), variant: 'caption' }],
    };
  }
  const current = state(view);
  const items = [{ label: t('widgetState'), value: t(current.key), color: current.color }];
  items.push({ label: t('widgetAddress'), value: view.host, color: 'neutral' });
  const components = [
    { type: 'text', text: truncate(view.name, 40), variant: 'heading' },
    { type: 'status', items },
  ];
  const active = view.reachable && view.on;
  if (active && view.volume !== null) {
    components.push({
      type: 'gauge',
      value: view.volume,
      min: 0,
      max: view.maxVolume,
      label: view.muted ? t('widgetMutedLabel') : t('widgetVolume'),
      color: view.muted ? 'warning' : 'primary',
    });
  }
  if (active && apps.length > 0) {
    components.push({
      type: 'card-list',
      // Square thumbnails: the grid display crops images to 2:3 posters.
      display: 'list',
      items: apps.slice(0, MAX_APPS_SHOWN).map((app) => ({
        title: truncate(app.name, 60),
        // The package name is what the "Open an app" scene action also accepts.
        subtitle: truncate(app.package, 60),
        ...(app.image ? { image: app.image } : {}),
      })),
    });
  } else if (!view.reachable) {
    components.push({
      type: 'text',
      text: view.canWake ? t('widgetOffWake') : t('widgetOffNoWake'),
      variant: 'caption',
    });
  }
  const device = { device: view.deviceId };
  if (view.reachable || view.canWake) {
    components.push({
      type: 'button',
      label: active ? t('widgetPowerOff') : t('widgetPowerOn'),
      icon: 'power',
      style: active ? 'secondary' : 'primary',
      action: { key: active ? WIDGET_ACTIONS.POWER_OFF : WIDGET_ACTIONS.POWER_ON, params: device },
    });
  }
  if (active) {
    components.push({
      type: 'button',
      label: t('widgetHomeButton'),
      icon: 'home',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.HOME, params: device },
    });
    components.push({
      type: 'button',
      label: view.muted ? t('widgetUnmute') : t('widgetMute'),
      icon: view.muted ? 'volume-2' : 'volume-x',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.MUTE, params: device },
    });
    if (apps.length > 0) {
      const options = apps.slice(0, MAX_FORM_OPTIONS).map((app) => ({
        value: app.package,
        // A form label is always multi-language; an application name is not translated.
        label: Object.fromEntries(LANGUAGES.map((language) => [language, truncate(app.name, 40)])),
      }));
      components.push({
        type: 'button',
        label: t('widgetOpenApp'),
        icon: 'play',
        style: 'primary',
        action: {
          key: WIDGET_ACTIONS.LAUNCH_APP,
          params: device,
          fields: [
            {
              key: 'app',
              type: 'select',
              label: t('widgetAppField'),
              required: true,
              default: options[0].value,
              options,
            },
          ],
        },
      });
    }
  }
  return { version: 1, ttl_seconds: TTL_SECONDS, components: components.slice(0, 8) };
}
