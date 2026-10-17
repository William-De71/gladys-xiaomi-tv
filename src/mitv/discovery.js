// -----------------------------------------------------------------------------
// Finding the TVs on the local network.
//
// The integration container sits behind the Docker bridge, where a multicast
// never reaches the LAN: the search goes through the mediated SSDP scan of
// Gladys (the core, on the host network, sends an M-SEARCH `ssdp:all` and
// relays the raw answers). Xiaomi TVs answer it as a DLNA / Miracast
// renderer. Every address that answers is then asked `isalive` on port 6095,
// by unicast from the container (that crosses the bridge): only a Xiaomi TV
// answers there.
//
// The core adds the MAC address of a responder when its own neighbour (ARP)
// table knows it. Asking the TV on port 6095 goes through the host, which
// then learns the MAC: a TV found without one is searched once more.
//
// The addresses typed in the configuration are asked directly: TVs on
// another subnet, or a network that filters multicast.
// -----------------------------------------------------------------------------

export const SSDP_TARGET = 'ssdp:all';
export const SCAN_SECONDS = 4;
const PROBE_MS = 1500;
const PROBE_CONCURRENCY = 8;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

const isIpv4 = (value) =>
  IPV4.test(value) && value.split('.').every((octet) => Number(octet) <= 255);

/**
 * @description Normalize a MAC address.
 * @param {string} value - Any format.
 * @returns {string} 12 lowercase hex digits, or '' when it is not one.
 */
export function normalizeMac(value) {
  const mac = String(value ?? '')
    .toLowerCase()
    .replace(/[^0-9a-f]/g, '');
  return mac.length === 12 && mac !== '000000000000' && mac !== 'ffffffffffff' ? mac : '';
}

/**
 * @description The addresses of an SSDP scan, with their MAC when known.
 * @param {Array} results - `scanNetwork('ssdp')` results.
 * @returns {Map<string, string>} IP address -> MAC ('' when unknown).
 */
export function ssdpCandidates(results) {
  const candidates = new Map();
  for (const result of Array.isArray(results) ? results : []) {
    const ip = String(result?.source_ip ?? '');
    if (!isIpv4(ip)) {
      continue;
    }
    const mac = normalizeMac(result?.source_mac);
    if (!candidates.has(ip) || (mac && !candidates.get(ip))) {
      candidates.set(ip, mac);
    }
  }
  return candidates;
}

/**
 * @description Run the mediated SSDP scan.
 * @param {object} gladys - SDK client.
 * @param {object} [options] - `{ logger, timeoutSeconds }`.
 * @returns {Promise<{ candidates: Map<string, string>, error: string|null }>}
 * The answering addresses and why the scan failed, if it did.
 */
export async function ssdpScan(gladys, { logger, timeoutSeconds = SCAN_SECONDS } = {}) {
  try {
    const results = await gladys.scanNetwork('ssdp', { timeoutSeconds });
    return { candidates: ssdpCandidates(results), error: null };
  } catch (error) {
    if (error?.status === 403) {
      logger?.warn(
        'Xiaomi TV: Gladys refused the network scan (reinstall the integration to accept its network discovery)',
      );
      return { candidates: new Map(), error: 'forbidden' };
    }
    if (error?.status === 429 || error?.status === 409) {
      return { candidates: new Map(), error: 'busy' };
    }
    logger?.warn(`Xiaomi TV: network scan failed: ${error?.message ?? error}`);
    return { candidates: new Map(), error: 'failed' };
  }
}

/**
 * @description Ask `isalive` to many addresses, a few at a time.
 * @param {object} client - src/mitv/client.js client.
 * @param {string[]} hosts - Addresses.
 * @param {number} [timeoutMs] - Timeout per address.
 * @returns {Promise<Map<string, object>>} Address -> parseIsAlive() of the TVs that answered.
 */
export async function probeHosts(client, hosts, timeoutMs = PROBE_MS) {
  const found = new Map();
  const queue = [...hosts];
  const worker = async () => {
    while (queue.length > 0) {
      const host = queue.shift();
      try {
        found.set(host, await client.isAlive(host, timeoutMs));
      } catch {
        // Not a Xiaomi TV, or switched off.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, worker));
  return found;
}

/**
 * @description Parse the addresses typed in the configuration.
 * @param {string} value - `192.168.1.20, 192.168.1.21`.
 * @returns {string[]} The valid IPv4 addresses, deduplicated.
 */
export function parseHosts(value) {
  return [
    ...new Set(
      String(value ?? '')
        .split(/[\s,;]+/)
        .map((part) => part.trim())
        .filter(isIpv4),
    ),
  ];
}
