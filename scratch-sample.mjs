import { PNG } from 'pngjs';
import fs from 'fs';

const file = process.argv[2];
const x0 = parseInt(process.argv[3]);
const y0 = parseInt(process.argv[4]);
const w = parseInt(process.argv[5] || '1');
const h = parseInt(process.argv[6] || '1');

const data = fs.readFileSync(file);
const png = PNG.sync.read(data);

for (let y = y0; y < y0 + h; y++) {
  let row = [];
  for (let x = x0; x < x0 + w; x++) {
    const idx = (png.width * y + x) << 2;
    const r = png.data[idx], g = png.data[idx+1], b = png.data[idx+2], a = png.data[idx+3];
    row.push(`(${x},${y})=#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}/${a}`);
  }
  console.log(row.join(' '));
}
