import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

// The real tenant catalog has no design seed products. Never dereference
// seedProducts[0].image when the image field is blank.
src = src.replace("image:form.image||seedProducts[0].image", "image:form.image||''");

// Product persistence is asynchronous in the production build. Do not navigate
// back to Inventory until Supabase has accepted the new/edited product. This
// prevents hydration from immediately replacing an unsaved local product.
const brokenSubmit = "const submit=(e:FormEvent)=>{e.preventDefault();saveProduct({name:form.name,brand:form.brand,category:form.category as Product['category'],model:form.model,sku:form.sku,purchasePrice:Number(form.purchasePrice),sellingPrice:Number(form.sellingPrice),mrp:Number(form.mrp),quantity:Number(form.quantity),minStock:Number(form.minStock),warranty:form.warranty,image:form.image||''},id);setLocation(id?`/product/${id}`:'/inventory')};";
const fixedSubmit = "const submit=async(e:FormEvent)=>{e.preventDefault();const data={name:form.name,brand:form.brand,category:form.category as Product['category'],model:form.model,sku:form.sku,purchasePrice:Number(form.purchasePrice),sellingPrice:Number(form.sellingPrice),mrp:Number(form.mrp),quantity:Number(form.quantity),minStock:Number(form.minStock),warranty:form.warranty,image:form.image||''};try{await saveProduct(data,id);setLocation(id?`/product/${id}`:'/inventory')}catch(error){console.error('[inventory] product save failed:',error);window.alert(error instanceof Error?error.message:'Product could not be saved. Please try again.')}};";

if (src.includes(fixedSubmit)) {
  console.log('Product form submit already awaits cloud persistence.');
} else if (src.includes(brokenSubmit)) {
  src = src.replace(brokenSubmit, fixedSubmit);
  console.log('Product form submit now waits for cloud persistence.');
} else {
  console.warn('Product form submit target not found; skipping.');
}

fs.writeFileSync(file, src);
