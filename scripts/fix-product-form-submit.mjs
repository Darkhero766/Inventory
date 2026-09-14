import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

// seedProducts is intentionally empty in production. The new-product form was
// still dereferencing seedProducts[0].image when no image URL was supplied,
// throwing before the product state could be saved. Keep the existing form and
// navigation unchanged; only make the image fallback safe.
const broken = "image:form.image||seedProducts[0].image";
const fixed = "image:form.image||''";
if (src.includes(broken)) {
  src = src.replace(broken, fixed);
  fs.writeFileSync(file, src);
  console.log('Product form submit fallback fixed.');
} else {
  console.log('Product form submit fallback already fixed or target not found; skipping.');
}
