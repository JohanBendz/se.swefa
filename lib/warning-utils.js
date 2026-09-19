'use strict';

const WARNING_LEVEL_RANK = Object.freeze({
  MESSAGE: 1,
  YELLOW: 2,
  ORANGE: 3,
  RED: 4,
});

const WEATHER_WARNING_LEVELS = new Set(['YELLOW', 'ORANGE', 'RED']);

function normalizeLevelCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function getLevelRank(value) {
  return WARNING_LEVEL_RANK[normalizeLevelCode(value)] ?? 0;
}

function pointOnSegment(point, start, end, epsilon = 1e-10) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > epsilon) return false;

  const squaredLength = ((x2 - x1) ** 2) + ((y2 - y1) ** 2);
  if (squaredLength <= epsilon) {
    return Math.abs(x - x1) <= epsilon && Math.abs(y - y1) <= epsilon;
  }

  const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dot < -epsilon) return false;

  return dot <= squaredLength + epsilon;
}

function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;

  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const current = ring[i];
    const previous = ring[j];

    if (!Array.isArray(current) || !Array.isArray(previous)) continue;
    if (pointOnSegment(point, previous, current)) return true;

    const [x, y] = point;
    const [xi, yi] = current;
    const [xj, yj] = previous;

    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) return false;
  }

  return true;
}

function pointInGeometry(longitude, latitude, geometry) {
  const lon = Number(longitude);
  const lat = Number(latitude);

  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !geometry) return false;

  const point = [lon, lat];

  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      && geometry.coordinates.some(polygon => pointInPolygon(point, polygon));
  }

  return false;
}

function parseTime(value) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

function isWarningActiveNow(warning, now = Date.now()) {
  const start = parseTime(warning?.start);
  const end = parseTime(warning?.end);
  const nowMs = Number(now);

  if (!Number.isFinite(nowMs)) return false;
  if (start !== null && nowMs < start) return false;
  if (end !== null && nowMs > end) return false;
  return true;
}

function hasWarningEnded(warning, now = Date.now()) {
  const end = parseTime(warning?.end);
  return end !== null && end < Number(now);
}

function localizedOfficialText(value, language = 'en') {
  if (!value || typeof value !== 'object') return '';

  // SMHI currently supplies Swedish and English warning text. Do not
  // machine-translate official warning content.
  if (language === 'sv' && typeof value.sv === 'string') return value.sv;
  if (typeof value.en === 'string') return value.en;
  if (typeof value.sv === 'string') return value.sv;
  return '';
}

function flattenWeatherWarnings(payload, now = Date.now()) {
  if (!Array.isArray(payload)) return [];

  const warnings = [];

  for (const parent of payload) {
    if (!parent || !Array.isArray(parent.warningAreas)) continue;

    for (const area of parent.warningAreas) {
      const levelCode = normalizeLevelCode(area?.warningLevel?.code);
      if (!WEATHER_WARNING_LEVELS.has(levelCode)) continue;

      const warning = {
        id: String(area?.id ?? ''),
        parentId: String(parent?.id ?? ''),
        levelCode,
        level: area?.warningLevel ?? {},
        event: parent?.event ?? {},
        eventDescription: area?.eventDescription ?? {},
        areaName: area?.areaName ?? area?.area?.properties ?? {},
        affectedAreas: Array.isArray(area?.affectedAreas) ? area.affectedAreas : [],
        descriptions: Array.isArray(area?.descriptions) ? area.descriptions : [],
        geometry: area?.area?.geometry ?? null,
        start: area?.approximateStart ?? null,
        end: area?.approximateEnd ?? null,
        published: area?.published ?? null,
        created: area?.created ?? null,
      };

      if (!warning.id || !warning.geometry || hasWarningEnded(warning, now)) continue;
      warnings.push(warning);
    }
  }

  return warnings;
}

function getWeatherWarningsForPoint(payload, longitude, latitude, now = Date.now()) {
  return flattenWeatherWarnings(payload, now)
    .filter(warning => pointInGeometry(longitude, latitude, warning.geometry))
    .sort((a, b) => {
      const rankDifference = getLevelRank(b.levelCode) - getLevelRank(a.levelCode);
      if (rankDifference !== 0) return rankDifference;

      const activeDifference = Number(isWarningActiveNow(b, now)) - Number(isWarningActiveNow(a, now));
      if (activeDifference !== 0) return activeDifference;

      const aStart = parseTime(a.start) ?? Number.MAX_SAFE_INTEGER;
      const bStart = parseTime(b.start) ?? Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;

      return a.id.localeCompare(b.id);
    });
}

function getDescriptionByCode(warning, code, language = 'en') {
  const description = warning?.descriptions?.find(item => item?.title?.code === code);
  return localizedOfficialText(description?.text, language);
}

function warningSignature(warning) {
  return JSON.stringify({
    levelCode: warning?.levelCode ?? '',
    eventCode: warning?.event?.code ?? '',
    eventDescriptionCode: warning?.eventDescription?.code ?? '',
    start: warning?.start ?? null,
    end: warning?.end ?? null,
    published: warning?.published ?? null,
  });
}

module.exports = {
  WARNING_LEVEL_RANK,
  WEATHER_WARNING_LEVELS,
  getLevelRank,
  pointInGeometry,
  isWarningActiveNow,
  localizedOfficialText,
  flattenWeatherWarnings,
  getWeatherWarningsForPoint,
  getDescriptionByCode,
  warningSignature,
};
