// -----------------------------------------------------------------------------
// Runtime texts, in the four languages of the Gladys UI.
//
// `t(key, vars)` returns a multi-language object `{ en, fr, de, es }`
// (configuration button, widget, connection status); `text(key, language,
// vars)` returns one string (feature names, scene action errors: Gladys does
// not send the language of the user with a scan, a command or a scene
// action, see `language` in config.js).
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

const MESSAGES = {
  // --- Feature names (`<device name> - <feature>`) ---------------------------
  power: { en: 'On/Standby', fr: 'Marche/veille', de: 'Ein/Standby', es: 'Encendido/espera' },
  volume: { en: 'Volume', fr: 'Volume', de: 'Lautstärke', es: 'Volumen' },
  volume_up: {
    en: 'Volume up',
    fr: 'Augmenter volume',
    de: 'Lautstärke höher',
    es: 'Subir volumen',
  },
  volume_down: {
    en: 'Volume down',
    fr: 'Diminuer volume',
    de: 'Lautstärke niedriger',
    es: 'Bajar volumen',
  },
  volume_mute: { en: 'Mute', fr: 'Muet', de: 'Stumm', es: 'Silenciar' },
  up: { en: 'Up', fr: 'Haut', de: 'Hoch', es: 'Arriba' },
  down: { en: 'Down', fr: 'Bas', de: 'Runter', es: 'Abajo' },
  left: { en: 'Left', fr: 'Gauche', de: 'Links', es: 'Izquierda' },
  right: { en: 'Right', fr: 'Droite', de: 'Rechts', es: 'Derecha' },
  enter: { en: 'OK', fr: 'OK', de: 'Bestätigen', es: 'Aceptar' },
  menu: { en: 'Menu', fr: 'Menu', de: 'Menü', es: 'Menú' },
  back: { en: 'Back', fr: 'Retour', de: 'Zurück', es: 'Volver' },

  // --- Connection status (Integrations page) ---------------------------------
  statusConnected: {
    en: '{count} of {total} Xiaomi TV(s) answering on the local network.',
    fr: '{count} téléviseur(s) Xiaomi sur {total} répondent sur le réseau local.',
    de: '{count} von {total} Xiaomi-Fernseher(n) antworten im lokalen Netzwerk.',
    es: '{count} de {total} televisor(es) Xiaomi responden en la red local.',
  },
  statusAllOff: {
    en: '{count} Xiaomi TV(s) known, none answering right now (switched off?).',
    fr: '{count} téléviseur(s) Xiaomi connu(s), aucun ne répond pour l’instant (éteint ?).',
    de: '{count} Xiaomi-Fernseher bekannt, derzeit antwortet keiner (ausgeschaltet?).',
    es: '{count} televisor(es) Xiaomi conocido(s), ninguno responde ahora (¿apagado?).',
  },
  statusNoTv: {
    en: 'No Xiaomi TV found yet. Switch the TV on, then use “Search and test the TVs”.',
    fr: 'Aucun téléviseur Xiaomi trouvé pour l’instant. Allumez-le, puis utilisez « Rechercher et tester les téléviseurs ».',
    de: 'Noch kein Xiaomi-Fernseher gefunden. Schalten Sie ihn ein und nutzen Sie „Fernseher suchen und testen“.',
    es: 'Aún no se ha encontrado ningún televisor Xiaomi. Enciéndalo y use «Buscar y probar los televisores».',
  },
  statusScanForbidden: {
    en: 'Gladys refused the network search: reinstall the integration and accept its network discovery, or type the address of the TV.',
    fr: 'Gladys a refusé la recherche réseau : réinstallez l’intégration en acceptant sa découverte réseau, ou saisissez l’adresse du téléviseur.',
    de: 'Gladys hat die Netzwerksuche abgelehnt: Installieren Sie die Integration neu und erlauben Sie die Netzwerkerkennung, oder geben Sie die Adresse des Fernsehers ein.',
    es: 'Gladys rechazó la búsqueda en la red: reinstale la integración aceptando su detección de red, o escriba la dirección del televisor.',
  },

  // --- Configuration button --------------------------------------------------
  testOk: {
    en: '{count} TV(s) found: {list}.',
    fr: '{count} téléviseur(s) trouvé(s) : {list}.',
    de: '{count} Fernseher gefunden: {list}.',
    es: '{count} televisor(es) encontrado(s): {list}.',
  },
  testNone: {
    en: 'No Xiaomi TV answered on port 6095. Check that the TV is on and on the same network, or type its address. Only MIUI TV / PatchWall models have this port: Android TV and Google TV models do not.',
    fr: 'Aucun téléviseur Xiaomi n’a répondu sur le port 6095. Vérifiez qu’il est allumé et sur le même réseau, ou saisissez son adresse. Seuls les modèles MIUI TV / PatchWall ont ce port : pas les modèles Android TV et Google TV.',
    de: 'Kein Xiaomi-Fernseher hat auf Port 6095 geantwortet. Prüfen Sie, ob er eingeschaltet und im selben Netzwerk ist, oder geben Sie seine Adresse ein. Nur Modelle mit MIUI TV / PatchWall haben diesen Port, Android-TV- und Google-TV-Modelle nicht.',
    es: 'Ningún televisor Xiaomi respondió en el puerto 6095. Compruebe que está encendido y en la misma red, o escriba su dirección. Solo los modelos MIUI TV / PatchWall tienen este puerto: los modelos Android TV y Google TV no.',
  },
  testNoMac: {
    en: 'MAC unknown, no Wake-on-LAN',
    fr: 'MAC inconnue, pas de Wake-on-LAN',
    de: 'MAC unbekannt, kein Wake-on-LAN',
    es: 'MAC desconocida, sin Wake-on-LAN',
  },
  testUnreachable: {
    en: 'not answering',
    fr: 'ne répond pas',
    de: 'antwortet nicht',
    es: 'no responde',
  },

  // --- Errors (scene actions, commands) --------------------------------------
  errorUnknownDevice: {
    en: 'This TV is not known to the Xiaomi TV integration: run a search in the Discover tab.',
    fr: 'Ce téléviseur est inconnu de l’intégration Xiaomi TV : lancez une recherche dans l’onglet Découverte.',
    de: 'Dieser Fernseher ist der Xiaomi-TV-Integration unbekannt: Starten Sie eine Suche im Tab Entdecken.',
    es: 'La integración Xiaomi TV no conoce este televisor: lance una búsqueda en la pestaña Descubrir.',
  },
  errorOff: {
    en: '{name} is not answering: switch it on first.',
    fr: '{name} ne répond pas : allumez-le d’abord.',
    de: '{name} antwortet nicht: Schalten Sie ihn zuerst ein.',
    es: '{name} no responde: enciéndalo primero.',
  },
  errorUnreachable: {
    en: '{name} did not carry out the command ({error}).',
    fr: '{name} n’a pas exécuté la commande ({error}).',
    de: '{name} hat den Befehl nicht ausgeführt ({error}).',
    es: '{name} no ejecutó la orden ({error}).',
  },
  errorNoWake: {
    en: '{name} is not answering and its MAC address is unknown: it cannot be woken over the network. Switch it on with its remote.',
    fr: '{name} ne répond pas et son adresse MAC est inconnue : impossible de le réveiller par le réseau. Allumez-le avec sa télécommande.',
    de: '{name} antwortet nicht und seine MAC-Adresse ist unbekannt: Er lässt sich nicht über das Netzwerk wecken. Schalten Sie ihn mit der Fernbedienung ein.',
    es: '{name} no responde y su dirección MAC es desconocida: no se puede despertar por la red. Enciéndalo con su mando.',
  },
  errorUnknownFeature: {
    en: 'Unknown feature {key}.',
    fr: 'Fonctionnalité inconnue : {key}.',
    de: 'Unbekannte Funktion: {key}.',
    es: 'Función desconocida: {key}.',
  },
  errorUnknownApp: {
    en: 'No application “{app}” on this TV. Type its name as shown on the TV, or its package name (com.netflix.ninja).',
    fr: 'Aucune application « {app} » sur ce téléviseur. Saisissez son nom tel qu’affiché sur le téléviseur, ou son nom de paquet (com.netflix.ninja).',
    de: 'Keine App „{app}“ auf diesem Fernseher. Geben Sie ihren Namen wie auf dem Fernseher angezeigt ein, oder ihren Paketnamen (com.netflix.ninja).',
    es: 'No hay ninguna aplicación «{app}» en este televisor. Escriba su nombre tal como aparece en el televisor, o su nombre de paquete (com.netflix.ninja).',
  },
  errorKeys: {
    en: 'Invalid key sequence: 1 to {max} keys among power, up, down, left, right, enter, home, back, menu, volumeup, volumedown, separated by commas.',
    fr: 'Séquence de touches invalide : 1 à {max} touches parmi power, up, down, left, right, enter, home, back, menu, volumeup, volumedown, séparées par des virgules.',
    de: 'Ungültige Tastenfolge: 1 bis {max} Tasten aus power, up, down, left, right, enter, home, back, menu, volumeup, volumedown, durch Kommas getrennt.',
    es: 'Secuencia de teclas no válida: de 1 a {max} teclas entre power, up, down, left, right, enter, home, back, menu, volumeup, volumedown, separadas por comas.',
  },
  errorSource: {
    en: 'Unknown input {source}: HDMI 1, HDMI 2 or HDMI 3.',
    fr: 'Entrée inconnue {source} : HDMI 1, HDMI 2 ou HDMI 3.',
    de: 'Unbekannter Eingang {source}: HDMI 1, HDMI 2 oder HDMI 3.',
    es: 'Entrada desconocida {source}: HDMI 1, HDMI 2 o HDMI 3.',
  },

  // --- Widget ----------------------------------------------------------------
  widgetChooseDevice: {
    en: 'Choose a Xiaomi TV in the settings of this widget.',
    fr: 'Choisissez un téléviseur Xiaomi dans les réglages de ce widget.',
    de: 'Wählen Sie in den Einstellungen dieses Widgets einen Xiaomi-Fernseher.',
    es: 'Elija un televisor Xiaomi en los ajustes de este widget.',
  },
  widgetState: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  widgetAddress: { en: 'Address', fr: 'Adresse', de: 'Adresse', es: 'Dirección' },
  widgetOn: { en: 'On', fr: 'Allumé', de: 'Ein', es: 'Encendido' },
  widgetStandby: { en: 'Standby', fr: 'En veille', de: 'Standby', es: 'En espera' },
  widgetUnreachable: { en: 'Off', fr: 'Éteint', de: 'Aus', es: 'Apagado' },
  widgetVolume: { en: 'Volume', fr: 'Volume', de: 'Lautstärke', es: 'Volumen' },
  widgetMutedLabel: {
    en: 'Volume (muted)',
    fr: 'Volume (sourdine)',
    de: 'Lautstärke (stumm)',
    es: 'Volumen (silencio)',
  },
  widgetOffWake: {
    en: 'Not answering. “Switch on” wakes it up.',
    fr: 'Ne répond pas. « Allumer » le réveille.',
    de: 'Antwortet nicht. „Einschalten“ weckt ihn.',
    es: 'No responde. «Encender» lo despierta.',
  },
  widgetOffNoWake: {
    en: 'Not answering: use the remote of the TV.',
    fr: 'Ne répond pas : utilisez sa télécommande.',
    de: 'Antwortet nicht: Fernbedienung benutzen.',
    es: 'No responde: use su mando a distancia.',
  },
  widgetPowerOn: { en: 'Switch on', fr: 'Allumer', de: 'Einschalten', es: 'Encender' },
  widgetPowerOff: { en: 'Standby', fr: 'Mettre en veille', de: 'Standby', es: 'En espera' },
  widgetHomeButton: { en: 'Home', fr: 'Accueil', de: 'Startseite', es: 'Inicio' },
  widgetMute: { en: 'Mute', fr: 'Sourdine', de: 'Stumm', es: 'Silenciar' },
  widgetUnmute: { en: 'Sound on', fr: 'Rétablir le son', de: 'Ton an', es: 'Activar sonido' },
  widgetOpenApp: {
    en: 'Open an app',
    fr: 'Ouvrir une appli',
    de: 'App öffnen',
    es: 'Abrir una app',
  },
  widgetAppField: { en: 'Application', fr: 'Application', de: 'App', es: 'Aplicación' },
  widgetPoweredOn: {
    en: 'The TV is switching on.',
    fr: 'Le téléviseur s’allume.',
    de: 'Der Fernseher schaltet sich ein.',
    es: 'El televisor se está encendiendo.',
  },
  widgetWakeSent: {
    en: 'Wake-on-LAN sent: the TV should switch on within a few seconds.',
    fr: 'Wake-on-LAN envoyé : le téléviseur devrait s’allumer d’ici quelques secondes.',
    de: 'Wake-on-LAN gesendet: Der Fernseher sollte sich in wenigen Sekunden einschalten.',
    es: 'Wake-on-LAN enviado: el televisor debería encenderse en unos segundos.',
  },
  widgetPoweredOff: {
    en: 'The TV is going to standby.',
    fr: 'Le téléviseur se met en veille.',
    de: 'Der Fernseher geht in den Standby.',
    es: 'El televisor pasa a espera.',
  },
  widgetHome: {
    en: 'Back to the home screen.',
    fr: 'Retour à l’écran d’accueil.',
    de: 'Zurück zum Startbildschirm.',
    es: 'Vuelta a la pantalla de inicio.',
  },
  widgetMuted: { en: 'Sound muted.', fr: 'Son coupé.', de: 'Ton aus.', es: 'Sonido silenciado.' },
  widgetUnmuted: {
    en: 'Sound restored.',
    fr: 'Son rétabli.',
    de: 'Ton wieder an.',
    es: 'Sonido restablecido.',
  },
  widgetLaunched: {
    en: '{app} is opening.',
    fr: '{app} s’ouvre.',
    de: '{app} wird geöffnet.',
    es: '{app} se está abriendo.',
  },
};

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
  );
}

/**
 * @description A runtime text in the four languages.
 * @param {string} key - Message key.
 * @param {object} [vars] - Placeholder values, a value may itself be multi-language.
 * @returns {{en: string, fr: string, de: string, es: string}} The message.
 */
export function t(key, vars = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, text(key, language, vars)]));
}

/**
 * @description A runtime text in one language (English when unknown).
 * @param {string} key - Message key.
 * @param {string} language - Language code.
 * @param {object} [vars] - Placeholder values, a value may itself be multi-language.
 * @returns {string} The text.
 */
export function text(key, language, vars = {}) {
  const message = MESSAGES[key];
  if (!message) {
    throw new Error(`Unknown message ${key}`);
  }
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const resolved = Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [name, pick(value, lang)]),
  );
  return fill(message[lang], resolved);
}

/**
 * @description The name of a feature in one language.
 * @param {string} key - Feature key.
 * @param {string} language - Language code.
 * @returns {string} The name.
 */
export function featureName(key, language) {
  return MESSAGES[key] ? text(key, language) : key;
}

/**
 * @description One language of a value that may be multi-language.
 * @param {*} value - A string, a number or `{ en, fr, ... }`.
 * @param {string} language - Language code.
 * @returns {*} The value in that language.
 */
export function pick(value, language) {
  if (value && typeof value === 'object') {
    return value[language] ?? value.en;
  }
  return value;
}

/**
 * @description Cut a text to a maximum length, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - Maximum length.
 * @returns {string} The text, at most `max` characters.
 */
export function truncate(value, max) {
  const string = String(value ?? '');
  return string.length <= max ? string : `${string.slice(0, max - 1).trimEnd()}…`;
}

/**
 * @description Cut every language of a multi-language text.
 * @param {object} message - `{ en, fr, ... }`.
 * @param {number} max - Maximum length.
 * @returns {object} The message.
 */
export function truncateAll(message, max) {
  return Object.fromEntries(
    Object.entries(message).map(([language, value]) => [language, truncate(value, max)]),
  );
}

export const MESSAGE_KEYS = Object.keys(MESSAGES);
export const MESSAGES_FOR_TESTS = MESSAGES;
