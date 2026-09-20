'use strict';

const OCOBS_PARAMETERS = Object.freeze({
  seaLevelRh2000: Object.freeze({
    fallbackKey: '13',
    titleIncludes: Object.freeze(['havsvattenstånd', 'minut']),
    titleExcludes: Object.freeze(['rw']),
  }),
  significantWaveHeight: Object.freeze({
    fallbackKey: '1',
    titleIncludes: Object.freeze(['våghöjd', 'signifikant']),
  }),
  meanWaveDirection: Object.freeze({
    fallbackKey: '7',
    titleIncludes: Object.freeze(['vågriktning', 'medelvärde']),
  }),
  peakWaveDirection: Object.freeze({
    fallbackKey: '8',
    titleIncludes: Object.freeze(['vågriktning', 'tp']),
  }),
  meanWavePeriod: Object.freeze({
    fallbackKey: '10',
    titleIncludes: Object.freeze(['vågperiod', 'medelvärde']),
  }),
  maximumWaveHeight: Object.freeze({
    fallbackKey: '11',
    titleIncludes: Object.freeze(['våghöjd', 'maximal']),
  }),
});

function normalizedTitle(value) {
  return String(value ?? '').trim().toLocaleLowerCase('sv-SE').replace(/\s+/g, ' ');
}

function titleMatches(title, includes, excludes = []) {
  const normalized = normalizedTitle(title);
  return Array.isArray(includes)
    && includes.every(part => normalized.includes(normalizedTitle(part)))
    && (!Array.isArray(excludes)
      || excludes.every(part => !normalized.includes(normalizedTitle(part))));
}

function resolveParameterKey(catalog, descriptor) {
  const resources = Array.isArray(catalog?.resource) ? catalog.resource : [];
  const match = resources.find(resource => titleMatches(
    resource?.title,
    descriptor?.titleIncludes,
    descriptor?.titleExcludes,
  ));

  return match?.key != null ? String(match.key) : null;
}

function validateParameterMetadata(metadata, descriptor) {
  return Boolean(
    metadata
    && metadata.key != null
    && titleMatches(metadata.title, descriptor?.titleIncludes, descriptor?.titleExcludes),
  );
}

function parseCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeStations(parameterPayload) {
  if (!Array.isArray(parameterPayload?.station)) return [];

  return parameterPayload.station
    .filter(station => station?.active !== false)
    .map((station) => {
      const latitude = parseCoordinate(station?.latitude);
      const longitude = parseCoordinate(station?.longitude);
      const id = station?.id ?? station?.key;

      if (id == null || latitude === null || longitude === null) return null;

      return {
        id: String(id),
        name: String(station?.name ?? station?.title ?? id),
        owner: String(station?.owner ?? ''),
        latitude,
        longitude,
        updated: Number.isFinite(Number(station?.updated)) ? Number(station.updated) : null,
      };
    })
    .filter(Boolean);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (!values.every(Number.isFinite)) return null;

  const [aLat, aLon, bLat, bLon] = values;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const firstLat = toRadians(aLat);
  const secondLat = toRadians(bLat);

  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(dLon / 2) ** 2;

  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function sortStationsByDistance(stations, latitude, longitude) {
  return [...(stations || [])]
    .map(station => ({
      ...station,
      distanceKm: distanceKm(latitude, longitude, station.latitude, station.longitude),
    }))
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return a.name.localeCompare(b.name);
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return a.name.localeCompare(b.name);
    });
}

function parseObservationDate(value) {
  if (Number.isFinite(Number(value))) {
    const numeric = Number(value);
    const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseObservationValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function latestObservation(payload, {
  now = Date.now(),
  maxAgeMs = Infinity,
  futureToleranceMs = 15 * 60 * 1000,
} = {}) {
  if (!Array.isArray(payload?.value)) return null;

  const nowMs = Number(now);
  if (!Number.isFinite(nowMs)) return null;

  let latest = null;

  for (const entry of payload.value) {
    const date = parseObservationDate(entry?.date);
    const value = parseObservationValue(entry?.value);

    if (date === null || value === null) continue;
    if (date > nowMs + futureToleranceMs) continue;

    if (!latest || date > latest.date) {
      latest = {
        date,
        value,
        quality: String(entry?.quality ?? ''),
        depth: parseObservationValue(entry?.depth),
      };
    }
  }

  if (!latest) return null;

  const ageMs = Math.max(0, nowMs - latest.date);
  if (ageMs > maxAgeMs) return null;

  return {
    ...latest,
    ageMs,
    ageMinutes: Math.round(ageMs / 60000),
  };
}

function waveDirectionCandidates(stationId, meanStations, peakStations) {
  const id = String(stationId ?? '');
  const candidates = [];

  if ((meanStations || []).some(station => String(station?.id) === id)) {
    candidates.push('meanWaveDirection');
  }
  if ((peakStations || []).some(station => String(station?.id) === id)) {
    candidates.push('peakWaveDirection');
  }

  return candidates;
}

function compassDirection(angle) {
  const number = Number(angle);
  if (!Number.isFinite(number)) return null;

  const directions = [
    'North',
    'North-East',
    'East',
    'South-East',
    'South',
    'South-West',
    'West',
    'North-West',
  ];
  const normalized = ((number % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % 8];
}

function crossedAbove(previous, current, threshold) {
  const values = [previous, current, threshold].map(Number);
  if (!values.every(Number.isFinite)) return false;
  const [from, to, limit] = values;
  return from <= limit && to > limit;
}

function crossedBelow(previous, current, threshold) {
  const values = [previous, current, threshold].map(Number);
  if (!values.every(Number.isFinite)) return false;
  const [from, to, limit] = values;
  return from >= limit && to < limit;
}

module.exports = {
  OCOBS_PARAMETERS,
  titleMatches,
  resolveParameterKey,
  validateParameterMetadata,
  normalizeStations,
  distanceKm,
  sortStationsByDistance,
  parseObservationDate,
  latestObservation,
  waveDirectionCandidates,
  compassDirection,
  crossedAbove,
  crossedBelow,
};
