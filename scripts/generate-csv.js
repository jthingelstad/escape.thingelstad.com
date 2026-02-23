#!/usr/bin/env node
/**
 * Generate companies.csv, locations.csv, and rooms.csv from rooms.json
 * for Airtable import. Normalizes data and extracts three related tables:
 *   Company → Location → Room
 */

const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', '_data', 'rooms.json'), 'utf8')
);

// --- Name normalization (fix typos and inconsistencies) ---
const COMPANY_NAME_FIXES = {
  'Cabinet Mysterlis': 'Cabinet Mysteriis',
  'Escape Game': 'The Escape Game',
};

const CITY_NAME_FIXES = {
  'St. Pual': 'St. Paul',
};

function normalizeCompanyName(name) {
  return COMPANY_NAME_FIXES[name] || name;
}

function normalizeCityName(name) {
  if (!name) return name;
  return CITY_NAME_FIXES[name] || name;
}

// --- Extract the base company URL (strip room-specific paths) ---
function baseUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'web.archive.org') return url;
    return u.origin + '/';
  } catch {
    return url;
  }
}

// --- CSV helpers ---
function escapeCsv(value) {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(fields) {
  return fields.map(escapeCsv).join(',');
}

function writeCsv(filePath, header, rows) {
  const lines = [csvRow(header), ...rows.map(r => csvRow(r))];
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  return rows.length;
}

// =====================================================
// 1. Build COMPANIES table
// =====================================================
const companyUrlMap = new Map(); // companyName -> Set of URLs

for (const room of data.rooms) {
  const name = normalizeCompanyName(room.company);
  if (!companyUrlMap.has(name)) {
    companyUrlMap.set(name, new Set());
  }
  if (room.companyUrl) {
    companyUrlMap.get(name).add(room.companyUrl);
  }
}

function pickBestUrl(urls) {
  if (!urls || urls.size === 0) return '';
  const bases = new Set();
  for (const url of urls) {
    bases.add(baseUrl(url));
  }
  const sorted = [...bases].sort((a, b) => a.length - b.length);
  return sorted[0];
}

const companyNames = [...companyUrlMap.keys()].sort((a, b) =>
  a.toLowerCase().localeCompare(b.toLowerCase())
);

const companies = [];
const companyIdByName = new Map();

companyNames.forEach((name, index) => {
  const id = index + 1;
  companies.push({
    id,
    name,
    url: pickBestUrl(companyUrlMap.get(name)),
  });
  companyIdByName.set(name, id);
});

// =====================================================
// 2. Build LOCATIONS table
// =====================================================
// A location is a unique (company, city, region, country) tuple.
// Geo coordinates (lat/lng) are stored here, picked from the first room seen.

const locationKeyMap = new Map(); // "companyName|city|region|country" -> location obj
const locationList = [];

function locationKey(companyName, city, region, country) {
  return `${companyName}|${city || ''}|${region || ''}|${country || ''}`;
}

for (const room of data.rooms) {
  const name = normalizeCompanyName(room.company);
  const loc = room.location || {};
  const city = normalizeCityName(loc.city) || null;
  const region = loc.region || null;
  const country = loc.country || null;
  const key = locationKey(name, city, region, country);

  if (!locationKeyMap.has(key)) {
    const locObj = {
      id: null, // assigned after sorting
      companyName: name,
      companyId: companyIdByName.get(name),
      city,
      region,
      country,
      lat: loc.lat,
      lng: loc.lng,
      urls: new Set(),
    };
    locationKeyMap.set(key, locObj);
    locationList.push(locObj);
  }
  if (room.companyUrl) {
    locationKeyMap.get(key).urls.add(room.companyUrl);
  }
}

// Sort locations by company name, then city
locationList.sort((a, b) => {
  const cmp = a.companyName.toLowerCase().localeCompare(b.companyName.toLowerCase());
  if (cmp !== 0) return cmp;
  return (a.city || '').localeCompare(b.city || '');
});

const locationIdByKey = new Map();
locationList.forEach((loc, index) => {
  loc.id = index + 1;
  const key = locationKey(loc.companyName, loc.city, loc.region, loc.country);
  locationIdByKey.set(key, loc.id);
});

// =====================================================
// 3. Build ROOMS table
// =====================================================
const rooms = data.rooms.map(room => {
  const name = normalizeCompanyName(room.company);
  const loc = room.location || {};
  const city = normalizeCityName(loc.city) || null;
  const region = loc.region || null;
  const country = loc.country || null;
  const key = locationKey(name, city, region, country);

  return {
    id: room.id,
    game: room.game,
    locationId: locationIdByKey.get(key),
    date: room.date,
    status: room.status,
    win: room.win === true ? 'true' : room.win === false ? 'false' : '',
    escapeTime: room.escapeTime || '',
    blogUrl: room.blogUrl || '',
    mortyId: room.mortyId != null ? room.mortyId : '',
    tags: (room.tags || []).join(', '),
    players: (room.players || []).join(', '),
    notes: room.notes || '',
    photoUrl: room.photoUrl || '',
  };
});

// =====================================================
// Write all three CSVs
// =====================================================
const outDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

// companies.csv
const companiesCount = writeCsv(
  path.join(outDir, 'companies.csv'),
  ['id', 'name', 'url'],
  companies.map(c => [c.id, c.name, c.url])
);
console.log(`Wrote ${companiesCount} companies to data/companies.csv`);

// locations.csv
// Pick the best (shortest/most generic) companyUrl per location
function pickLocationUrl(urls) {
  if (!urls || urls.size === 0) return '';
  const sorted = [...urls].sort((a, b) => a.length - b.length);
  return sorted[0];
}

const locationsCount = writeCsv(
  path.join(outDir, 'locations.csv'),
  ['id', 'company_id', 'company_name', 'city', 'region', 'country', 'lat', 'lng', 'url'],
  locationList.map(l => [
    l.id,
    l.companyId,
    l.companyName,
    l.city || '',
    l.region || '',
    l.country || '',
    l.lat != null ? l.lat : '',
    l.lng != null ? l.lng : '',
    pickLocationUrl(l.urls),
  ])
);
console.log(`Wrote ${locationsCount} locations to data/locations.csv`);

// rooms.csv
const roomsCount = writeCsv(
  path.join(outDir, 'rooms.csv'),
  [
    'id', 'game', 'location_id',
    'date', 'status', 'win', 'escapeTime',
    'blogUrl', 'mortyId',
    'tags', 'players', 'notes', 'photoUrl',
  ],
  rooms.map(r => [
    r.id, r.game, r.locationId,
    r.date, r.status, r.win, r.escapeTime,
    r.blogUrl, r.mortyId,
    r.tags, r.players, r.notes, r.photoUrl,
  ])
);
console.log(`Wrote ${roomsCount} rooms to data/rooms.csv`);
