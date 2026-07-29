import { PNG } from 'pngjs';
import fs from 'fs';

const file = process.argv[2];
const x0 = parseInt(process.argv[3]);
const y0 = parseInt(process.argv[4]);
const w = parseInt(process.argv[5]);
const h = parseInt(process.argv[6]);
const bg = process.argv[7]; // optional bg hex to exclude, e.g. fafaf9

const data = fs.readFileSync(file);
const png = PNG.sync.read(data);

function hex(r,g,b) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function bgDist(r,g,b,bgHex) {
  if (!bgHex) return 999;
  const br = parseInt(bgHex.slice(0,2),16), bgc = parseInt(bgHex.slice(2,4),16), bb = parseInt(bgHex.slice(4,6),16);
  return Math.abs(r-br)+Math.abs(g-bgc)+Math.abs(b-bb);
}

let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
const colorCounts = new Map();

for (let y = y0; y < y0+h; y++) {
  for (let x = x0; x < x0+w; x++) {
    const idx = (png.width*y+x)<<2;
    const r=png.data[idx], g=png.data[idx+1], b=png.data[idx+2];
    const d = bgDist(r,g,b,bg);
    if (d > 15) {
      minX = Math.min(minX,x); maxX = Math.max(maxX,x);
      minY = Math.min(minY,y); maxY = Math.max(maxY,y);
      const hx = hex(r,g,b);
      colorCounts.set(hx, (colorCounts.get(hx)||0)+1);
    }
  }
}

console.log(`region (${x0},${y0}) ${w}x${h}`);
if (minX===Infinity) {
  console.log('no non-bg pixels found');
} else {
  console.log(`bbox of non-bg content: (${minX},${minY}) to (${maxX},${maxY}) = ${maxX-minX+1}x${maxY-minY+1}`);
}
const sorted = [...colorCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
console.log('top colors:', sorted.map(([c,n])=>`${c}x${n}`).join(' '));
