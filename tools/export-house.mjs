// Write a built-in preset as a house file the listing tour can load.
//   node tools/export-house.mjs 191   > listings/191-webster.house.json
//   node tools/export-house.mjs dream > listings/dream.house.json
// (For customer homes, use the designer's 💾 Save instead and rename the file.)
import { buildHouse191 } from '../house191.js';
import { buildDreamHouse } from '../houseDream.js';

const which = process.argv[2] || '191';
const h = which === 'dream' ? buildDreamHouse() : buildHouse191();
process.stdout.write(JSON.stringify({ floors: h.floors, activeFloor: h.activeFloor, site: h.site }));
