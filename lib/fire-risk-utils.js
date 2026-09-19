'use strict';

const FIRE_RISK_CLASS_CODES = Object.freeze([-1, 1, 2, 3, 4, 5, 6]);

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeClassCode(value) {
  if (!isFiniteNumber(value)) return null;
  const code = Number(value);
  return FIRE_RISK_CLASS_CODES.includes(code) ? code : null;
}

function externalClassCode(code, type) {
  const normalized = normalizeClassCode(code);
  if (normalized === null || normalized === -1) return '';
  if ((type === 'forest' || type === 'dryness') && normalized === 6) return '5E';
  return String(normalized);
}

function parameterCode(point, parameterName) {
  if (!Array.isArray(point?.parameters)) return null;

  const parameter = point.parameters.find(item => item?.name === parameterName);
  const value = parameter?.values?.[0];

  return normalizeClassCode(value);
}

function dateKeyInTimezone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]),
  );

  return values.year && values.month && values.day
    ? `${values.year}-${values.month}-${values.day}`
    : null;
}

function targetDateKey(now, dayOffset, timeZone) {
  const baseKey = dateKeyInTimezone(now, timeZone);
  if (!baseKey) return null;

  const [year, month, day] = baseKey.split('-').map(Number);
  const offset = Number(dayOffset);

  if (!Number.isInteger(offset) || offset < 0 || offset > 5) return null;

  const target = new Date(Date.UTC(year, month - 1, day + offset, 12, 0, 0));
  return target.toISOString().slice(0, 10);
}

function selectDailyFireRiskPoint(payload, dayOffset, now, timeZone) {
  if (!payload || !Array.isArray(payload.timeSeries)) return null;

  const targetKey = targetDateKey(now, dayOffset, timeZone);
  if (!targetKey) return null;

  const matching = payload.timeSeries
    .filter(point => dateKeyInTimezone(point?.validTime, timeZone) === targetKey)
    .sort((a, b) => new Date(b.validTime).getTime() - new Date(a.validTime).getTime());

  if (matching.length === 0) return null;

  const point = matching[0];

  return {
    validTime: point.validTime,
    forestFireRiskCode: parameterCode(point, 'fwiindex'),
    grassFireRiskCode: parameterCode(point, 'grassfire'),
    forestDrynessCode: parameterCode(point, 'forestdry'),
  };
}

function parseApprovedTime(payload, now = Date.now(), {
  maxAgeMs = 24 * 60 * 60 * 1000,
  futureToleranceMs = 15 * 60 * 1000,
} = {}) {
  const approvedMs = Date.parse(payload?.approvedTime);

  if (!Number.isFinite(approvedMs)) {
    throw new Error('SMHI fire risk response has no valid approvedTime');
  }

  const nowMs = Number(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error('Invalid current time');
  }

  if (approvedMs < nowMs - maxAgeMs) {
    throw new Error('SMHI fire risk forecast is stale');
  }

  if (approvedMs > nowMs + futureToleranceMs) {
    throw new Error('SMHI fire risk approvedTime is unexpectedly in the future');
  }

  return payload.approvedTime;
}

function isRiskAtLeast(code, threshold) {
  const current = normalizeClassCode(code);
  const minimum = normalizeClassCode(threshold);

  if (current === null || minimum === null || current < 1 || minimum < 1) return false;
  return current >= minimum;
}

function diffFireRisk(previous, next) {
  const fields = [
    ['forest', 'forestFireRiskCode'],
    ['grass', 'grassFireRiskCode'],
    ['dryness', 'forestDrynessCode'],
  ];

  const changes = [];

  for (const [type, field] of fields) {
    const from = previous?.[field] ?? null;
    const to = next?.[field] ?? null;

    if (from !== to) {
      changes.push({ type, from, to });
    }
  }

  return changes;
}

module.exports = {
  FIRE_RISK_CLASS_CODES,
  normalizeClassCode,
  externalClassCode,
  parameterCode,
  dateKeyInTimezone,
  targetDateKey,
  selectDailyFireRiskPoint,
  parseApprovedTime,
  isRiskAtLeast,
  diffFireRisk,
};
