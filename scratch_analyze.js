const fs = require('fs');

const content = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = content.split('\n');
const channels = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('#EXTINF:')) {
    channels.push({ ext: lines[i], url: lines[i+1] ? lines[i+1].trim() : '' });
  }
}
console.log('Total channels in Canais de TV.m3u8:', channels.length);

const groups = {};
channels.forEach(c => {
  const m = c.ext.match(/group-title="([^"]+)"/);
  const g = m ? m[1] : 'Outros';
  groups[g] = (groups[g] || 0) + 1;
});
console.log('Groups:', JSON.stringify(groups, null, 2));

// Check duplicates or quality variations in names
const baseNames = new Map();
channels.forEach(c => {
  const nameMatch = c.ext.match(/tvg-name="([^"]+)"/) || c.ext.match(/,([^\r\n]+)$/);
  const fullName = nameMatch ? nameMatch[1].trim() : 'Unknown';
  // clean quality tag: 4K, FHD, HD, SD
  const cleanName = fullName.replace(/\b(4K|FHD|HD|SD|H265|HEVC)\b/gi, '').trim().replace(/\s+/g, ' ');
  if (!baseNames.has(cleanName)) baseNames.set(cleanName, []);
  baseNames.get(cleanName).push({ fullName, url: c.url });
});

console.log('Unique base channels:', baseNames.size);
const withMultipleQualities = [];
for (const [base, list] of baseNames.entries()) {
  if (list.length > 1) {
    withMultipleQualities.push({ base, count: list.length, items: list.map(x => x.fullName) });
  }
}
console.log('Channels with multiple entries in Canais de TV.m3u8:', withMultipleQualities.length);
if (withMultipleQualities.length > 0) {
  console.log('Examples:', withMultipleQualities.slice(0, 10));
}
