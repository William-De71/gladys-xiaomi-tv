# Xiaomi TV

## Overview

This integration brings your **Xiaomi TV** into Gladys: switch it on or to standby, set its volume, press the keys of its remote, open its applications and switch its HDMI input, from the dashboard and from your scenes.

It works with Xiaomi TVs running **MIUI TV / PatchWall**, which answer on port 6095 of the local network (the API the Mi Remote app uses). Everything stays on your **local network**: no account, no pairing, no cloud. **Android TV and Google TV models** (Mi TV P1, Q1, Q2, Xiaomi TV A / A Pro…) **do not have this port**: this integration cannot control them.

## Requirements

- Gladys Assistant 5.3.0 or later.
- A Xiaomi TV running MIUI TV / PatchWall, switched on and connected to the **same network as Gladys**. To check: open `http://<TV address>:6095/request?action=isalive` in a browser; the TV answers with its name.
- On the install screen, accept the **network discovery** (SSDP), which lets Gladys find the TVs, and **Wake-on-LAN**, which lets the integration switch on a TV that no longer answers.

## Configuration

### Search

Nothing to fill in for most homes: switch the TV on and press **Search and test the TVs**. The message lists every TV found with its address, its MAC address and whether it answers.

A TV the search does not find (another subnet, a network that filters multicast): type its address in **IP addresses**, separated by commas, then save.

Give the TV a **fixed IP address** in your router: the integration finds a TV whose address changed again (by its MAC address), but sooner with a fixed one.

### Refresh and language

- **State refresh**: each TV is asked whether it answers and what its volume is every 10 seconds (default), 30 seconds or 1 minute.
- **Automatic search**: the network is searched again every hour (default), every 15 minutes, or never; a TV that stops answering triggers a search anyway.
- **Language of the device texts**: the feature names in the Discover tab and the error messages of the scenes are written in this language, because Gladys does not send yours with them.

## Usage

### Devices

Open the **Discover** tab of the integration: every TV found is listed. Add it, and rename it as you like. A TV has these features:

- **On/Standby**: the power key of the remote.
- **Volume**: a slider from 0 to the maximum of the TV.
- **Volume up**, **Volume down**, **Mute**, **Up**, **Down**, **Left**, **Right**, **OK**, **Menu**, **Back**: buttons of the remote.

The TV badge shows **local**, or **unreachable** when the TV does not answer.

**The power state is assumed.** The power key toggles the TV between on and standby, and a TV in standby still answers on the network: the integration cannot tell them apart. So the state is the last command sent from Gladys, **on** when the TV starts answering again, **off** when it stops answering. If you put the TV in standby with its own remote, Gladys still shows it on: press the button twice to resynchronise. Turning on a TV that does not answer sends **Wake-on-LAN** when its MAC address is known.

The TV has no mute key: **Mute** lowers the volume to 0, and pressing it again restores the volume from before. The volume is reached with the volume keys (the direct volume request of the TV needs a signature that is not public), so a big change takes a few seconds.

### Widgets

![The “Xiaomi TV” widget: the living room TV on, volume 18, its first six applications with their package names and four buttons; the bedroom TV not answering with its Switch on button (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-xiaomi-tv/main/docs/assets/widgets.en.png)

**Xiaomi TV**: one TV chosen in the settings, with its state, its address, its volume, its first six applications (icon, name and package name) and four buttons: **Standby** / **Switch on**, **Home**, **Mute** / **Sound on** and **Open an app**, which opens a form listing every application of the TV. When the TV does not answer, only **Switch on** is left (if Wake-on-LAN is possible).

### Scene actions

- **Open an app on a Xiaomi TV**: the name of the application as shown on the TV (`Netflix`, `YouTube`; case and accents do not matter) or its package name (`com.netflix.ninja`, listed by the widget). Gives `app_name` and `package` to the next actions.
- **Press keys on a Xiaomi TV**: up to 30 keys separated by commas (`home, down, down, enter`) among `power`, `up`, `down`, `left`, `right`, `enter`, `home`, `back`, `menu`, `volumeup`, `volumedown`, with a pause between them (700 ms by default). Gives `keys_sent`.
- **Switch a Xiaomi TV input**: HDMI 1, HDMI 2 or HDMI 3.

The integration has no scene trigger: the TV sends no event. To start a scene when the TV is switched on, use the Gladys trigger “Device state change” on its **On/Standby** feature.

### Scene examples

- Every evening at 8:30 pm, if someone is at home → **Open an app on a Xiaomi TV** `Netflix`, then set the living room lights to 20 %.
- **The On/Standby state of the TV becomes 1** → close the living room shutters and dim the lights.
- When the game console is switched on → **Switch a Xiaomi TV input** to HDMI 2, then set the volume to 30.

## Troubleshooting

- **No TV found**: check that the TV is on, on the same network as Gladys (not a guest network) and that `http://<TV address>:6095/request?action=isalive` answers in a browser. If it does not, your model does not have this API (Android TV and Google TV models). Otherwise type its address in the configuration.
- **“Gladys refused the network search”**: reinstall the integration and accept its network discovery on the install screen, or type the address of the TV.
- **The TV shows on while it is in standby** (or the opposite): the state is assumed, see above. Press On/Standby twice.
- **The TV does not switch on from standby or from off**: in deep standby, some TVs ignore Wake-on-LAN; switch it on with its remote. A TV found only by its typed address has no known MAC address: no Wake-on-LAN.
- **The volume does not change**: the TV may be playing through an external audio device (HDMI ARC, optical) whose volume the TV does not control.
- **An application does not open**: check its name in the widget, or use its package name.
- Logs: the Logs tab of the integration; add `DEBUG=gladys-integration-sdk` to the container for the details. Report a problem on [GitHub](https://github.com/William-De71/gladys-xiaomi-tv/issues) with your Gladys version, the integration version, the model of the TV and the logs.
