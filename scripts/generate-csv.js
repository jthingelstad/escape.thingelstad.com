#!/usr/bin/env node
/**
 * Generate companies.csv and rooms.csv from rooms.json
 * for Airtable import. Normalizes company names and extracts
 * a separate companies table.
 */

const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', '_data', 'rooms.json'), 'utf8')
);

// --- Name normalization map (fix typos and inconsistencies) ---
const COMPANY_NAME_FIXES = {
  'Cabinet Mysterlis': 'Cabinet Mysteriis',
  'Escape Game': 'The Escape Game',
};

function normalizeCompanyName(name) {
  return COMPANY_NAME_FIXES[name] || name;
}

// --- Extract the base company URL (strip room-specific paths) ---
function baseUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Keep archive.org URLs intact (the archived site is the real URL)
    if (u.hostname === 'web.archive.org') return url;
    // Return origin + "/" — the homepage
    return u.origin + '/';
  } catch {
    return url;
  }
}

// --- Build companies table ---
// Group rooms by normalized company name, pick the best URL
const companyMap = new Map(); // name -> { urls: Set, rooms: [] }

for (const room of data.rooms) {
  const name = normalizeCompanyName(room.company);
  if (!companyMap.has(name)) {
    companyMap.set(name, { urls: new Set(), companyUrls: [] });
  }
  const entry = companyMap.get(name);
  if (room.companyUrl) {
    entry.urls.add(room.companyUrl);
    entry.companyUrls.push(room.companyUrl);
  }
}

// For each company, derive the base homepage URL
function pickBestUrl(entry) {
  if (entry.urls.size === 0) return '';
  // Collect base (homepage) URLs from all room-specific URLs
  const bases = new Set();
  for (const url of entry.urls) {
    bases.add(baseUrl(url));
  }
  // If all URLs share the same base, use that; otherwise pick the shortest base
  const sorted = [...bases].sort((a, b) => a.length - b.length);
  return sorted[0];
}

// Sort companies alphabetically, assign IDs
const companyNames = [...companyMap.keys()].sort((a, b) =>
  a.toLowerCase().localeCompare(b.toLowerCase())
);

const companies = [];
const companyIdByName = new Map();

companyNames.forEach((name, index) => {
  const id = index + 1;
  const entry = companyMap.get(name);
  companies.push({
    id,
    name,
    url: pickBestUrl(entry),
  });
  companyIdByName.set(name, id);
});

// --- CSV helpers ---
function escapeCsv(value) {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value);
  // Quote if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(fields) {
  return fields.map(escapeCsv).join(',');
}

// --- Write companies.csv ---
const companiesHeader = ['id', 'name', 'url'];
const companiesRows = [csvRow(companiesHeader)];
for (const c of companies) {
  companiesRows.push(csvRow([c.id, c.name, c.url]));
}

const companiesPath = path.join(__dirname, '..', 'data', 'companies.csv');
fs.mkdirSync(path.dirname(companiesPath), { recursive: true });
fs.writeFileSync(companiesPath, companiesRows.join('\n') + '\n');
console.log(`Wrote ${companies.length} companies to ${companiesPath}`);

// --- Write rooms.csv ---
const roomsHeader = [
  'id',
  'game',
  'company_id',
  'company_name',
  'date',
  'status',
  'win',
  'escapeTime',
  'city',
  'region',
  'country',
  'lat',
  'lng',
  'companyUrl',
  'blogUrl',
  'mortyId',
  'tags',
  'players',
  'notes',
  'photoUrl',
];
const roomsRows = [csvRow(roomsHeader)];

for (const room of data.rooms) {
  const name = normalizeCompanyName(room.company);
  const companyId = companyIdByName.get(name);
  const loc = room.location || {};

  roomsRows.push(
    csvRow([
      room.id,
      room.game,
      companyId,
      name,
      room.date,
      room.status,
      room.win === true ? 'true' : room.win === false ? 'false' : '',
      room.escapeTime || '',
      loc.city || '',
      loc.region || '',
      loc.country || '',
      loc.lat != null ? loc.lat : '',
      loc.lng != null ? loc.lng : '',
      room.companyUrl || '',
      room.blogUrl || '',
      room.mortyId != null ? room.mortyId : '',
      (room.tags || []).join(', '),
      (room.players || []).join(', '),
      room.notes || '',
      room.photoUrl || '',
    ])
  );
}

const roomsPath = path.join(__dirname, '..', 'data', 'rooms.csv');
fs.writeFileSync(roomsPath, roomsRows.join('\n') + '\n');
console.log(`Wrote ${data.rooms.length} rooms to ${roomsPath}`);
