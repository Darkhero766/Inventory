export type Category = 'Mobile' | 'Laptop' | 'TV' | 'Refrigerator' | 'AC' | 'Audio' | 'Camera' | 'Accessories';
export type Product = {
  id: string; name: string; brand: string; category: Category; model: string; sku: string;
  purchasePrice: number; sellingPrice: number; mrp: number; quantity: number; minStock: number;
  warranty: string; image: string; createdAt: string;
};
export type StockEntry = { id: string; productId: string; productName: string; type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT'; quantity: number; note: string; date: string; };
export type Purchase = { id: string; supplier: string; invoice: string; date: string; productId: string; productName: string; quantity: number; purchasePrice: number; total: number; };
export type Sale = { id: string; date: string; items: { productId: string; productName: string; quantity: number; price: number }[]; subtotal: number; discount: number; total: number; payment: string; };

const pics = {
  phone: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=700',
  phone2: 'https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=700',
  laptop: 'https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=700',
  tv: 'https://images.pexels.com/photos/6976094/pexels-photo-6976094.jpeg?auto=compress&cs=tinysrgb&w=700',
  camera: 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=700',
  audio: 'https://images.pexels.com/photos/164829/pexels-photo-164829.jpeg?auto=compress&cs=tinysrgb&w=700',
  fridge: 'https://images.pexels.com/photos/3637739/pexels-photo-3637739.jpeg?auto=compress&cs=tinysrgb&w=700',
  ac: 'https://images.pexels.com/photos/425416/pexels-photo-425416.jpeg?auto=compress&cs=tinysrgb&w=700',
};
const rows: [string,string,Category,string,string,number,number,number,number,number,string,string][] = [
  ['iPhone 15','Apple','Mobile','A3090','APL-IP15-128',65900,69900,79900,12,4,'1 Year',pics.phone],
  ['Galaxy S24','Samsung','Mobile','SM-S921B','SAM-S24-256',58900,62999,74999,8,3,'1 Year',pics.phone2],
  ['Pixel 8a','Google','Mobile','GKV4X','GOO-P8A-128',39900,42999,49999,3,4,'1 Year',pics.phone],
  ['Nord CE 4','OnePlus','Mobile','CPH2613','OP-NCE4-256',21900,24999,27999,18,5,'1 Year',pics.phone2],
  ['Vivo V30','Vivo','Mobile','V2318','VIV-V30-256',28900,32999,36999,0,3,'1 Year',pics.phone],
  ['MacBook Air M3','Apple','Laptop','A3113','APL-MBA-M3',101000,114900,119900,5,2,'1 Year',pics.laptop],
  ['Inspiron 14','Dell','Laptop','5430','DEL-INS14-I5',48500,53990,59990,7,2,'1 Year',pics.laptop],
  ['IdeaPad Slim 5','Lenovo','Laptop','83D0','LEN-IPS5-R7',57000,62990,69990,2,3,'1 Year',pics.laptop],
  ['Pavilion 14','HP','Laptop','dv2015','HP-PAV14-I5',54800,59990,67990,9,3,'1 Year',pics.laptop],
  ['Bravia 55" 4K','Sony','TV','KD-55X74L','SON-BR55-4K',61500,69990,79990,4,2,'2 Years',pics.tv],
  ['Crystal 43" Smart TV','Samsung','TV','UA43CUE70','SAM-TV43-4K',26900,31990,36990,6,2,'2 Years',pics.tv],
  ['4K LED 50"','TCL','TV','50P635','TCL-TV50-4K',24500,28990,32990,1,2,'2 Years',pics.tv],
  ['Godrej 236L Frost Free','Godrej','Refrigerator','RF EON 236B','GOD-FR236',24500,28990,31990,4,2,'10 Years',pics.fridge],
  ['Convertible 340L','LG','Refrigerator','GL-S382SDSX','LG-FR340',40500,46990,52990,3,2,'10 Years',pics.fridge],
  ['Double Door 253L','Whirlpool','Refrigerator','IF INV CNV 278','WHI-FR253',28900,33990,38990,0,2,'10 Years',pics.fridge],
  ['1.5T 5 Star Inverter','LG','AC','KS-Q18ENZA','LG-AC15-5S',38200,44990,49990,6,2,'5 Years',pics.ac],
  ['1.5T 3 Star Split AC','Voltas','AC','183V Vectra','VLT-AC15-3S',29900,34990,38990,10,3,'5 Years',pics.ac],
  ['1.5T 5 Star Inverter','Daikin','AC','FTKM50U','DAI-AC15-5S',42500,48990,54990,2,2,'5 Years',pics.ac],
  ['WH-1000XM5','Sony','Audio','WH1000XM5','SON-HP-XM5',24500,29990,34990,4,2,'1 Year',pics.audio],
  ['AirPods Pro 2','Apple','Audio','MTJV3HN/A','APL-APP2-USB',19800,24900,26900,7,3,'1 Year',pics.audio],
  ['Soundbar 300','Bose','Audio','926283','BOS-SB300',24500,29900,34900,1,2,'1 Year',pics.audio],
  ['EOS R50 Kit','Canon','Camera','5539C013','CAN-R50-18',53500,59990,67990,2,2,'2 Years',pics.camera],
  ['ZV-E10 II','Sony','Camera','ZVE10M2','SON-ZVE10-2',69500,76990,82990,3,2,'2 Years',pics.camera],
  ['X-S20 Body','Fujifilm','Camera','16802341','FUJ-XS20',98500,109990,119990,1,2,'2 Years',pics.camera],
  ['65W GaN Charger','Anker','Accessories','A2663','ANK-GAN-65',2850,3499,3999,24,6,'18 Months',pics.audio],
];
export const categories: Category[] = ['Mobile','Laptop','TV','Refrigerator','AC','Audio','Camera','Accessories'];
export const brands = ['Samsung','Apple','LG','Sony','OnePlus','Xiaomi','Motorola','HP','Dell','Lenovo','ASUS','Acer','Whirlpool','IFB','Bosch','Haier','Voltas','Daikin','JBL','boAt','Canon','Epson','Logitech','TP-Link','Google','Vivo','TCL','Godrej','Bose','Fujifilm','Anker'];
export const seedProducts: Product[] = rows.map((r, i) => ({ id: `p-${i+1}`, name:r[0], brand:r[1], category:r[2] as Category, model:r[3], sku:r[4], purchasePrice:r[5], sellingPrice:r[6], mrp:r[7], quantity:r[8], minStock:r[9], warranty:r[10], image:r[11], createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString() }));
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(value);
export const statusOf = (p: Product) => p.quantity === 0 ? 'OUT OF STOCK' : p.quantity <= p.minStock ? 'LOW STOCK' : 'IN STOCK';
export const readStore = <T,>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
export const writeStore = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));