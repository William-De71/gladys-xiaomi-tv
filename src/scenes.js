// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`).
//
//   launch_app      open an application of the TV, by name or package name
//                   (outputs: app_name, package)
//   send_keys       a sequence of remote keys with a pause between them, to
//                   reach a menu entry (output: keys_sent)
//   change_source   switch to an HDMI input
//
// No scene trigger: the TV pushes no event, and what the integration
// observes (on / off, volume) are device states, which the Gladys "device
// state" trigger already covers.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  LAUNCH_APP: 'launch_app',
  SEND_KEYS: 'send_keys',
  CHANGE_SOURCE: 'change_source',
};

// The outputs each action returns, as declared in the manifest.
export const SCENE_ACTION_OUTPUTS = {
  [SCENE_ACTIONS.LAUNCH_APP]: ['app_name', 'package'],
  [SCENE_ACTIONS.SEND_KEYS]: ['keys_sent'],
  [SCENE_ACTIONS.CHANGE_SOURCE]: [],
};
