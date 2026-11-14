// High-coverage schedule hubs used ONLY for the detail (schedule) search pass.
//
// Why this exists: several official esports/series sites are JS-driven SPAs whose
// directly fetched HTML is only a landing or season-overview page (e.g.
// valorantesports.com renders "CLICK TO REVEAL" placeholders). The official-hosts
// whitelist is therefore enough to confirm an event exists, but not to recover a
// precise phase schedule (groups / playoffs / finals dates). Community schedule
// aggregators such as Liquipedia maintain full phase-level brackets and are the
// de-facto authoritative schedule source for esports.
//
// These hubs enrich schedule detail only. They never change which source claims
// identity, and they are only queried when a named, schedule-driven target still
// lacks detail-rich evidence after the official detail search.
const SCHEDULE_HUB_HOSTS = {
  game: {
    _default: ['liquipedia.net'],
    valorant: ['liquipedia.net', 'vlr.gg'],
    lol: ['liquipedia.net', 'lolesports.com'],
    honor_of_kings: ['liquipedia.net'],
    peace_elite: ['liquipedia.net']
  }
}

function scheduleHubHostsFor(domain, topicKey, namedTarget) {
  const byDomain = SCHEDULE_HUB_HOSTS[domain]
  if (!byDomain) return []
  const hosts = []
  if (topicKey && Array.isArray(byDomain[topicKey])) hosts.push.apply(hosts, byDomain[topicKey])
  if (Array.isArray(byDomain._default)) hosts.push.apply(hosts, byDomain._default)
  return Array.from(new Set(hosts))
}

module.exports = { SCHEDULE_HUB_HOSTS, scheduleHubHostsFor }
