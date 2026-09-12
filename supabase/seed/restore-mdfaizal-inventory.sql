-- Restores the original 26-product demo catalog to the specified shop owner.
-- Run this ONCE in Supabase SQL Editor if the owner's products table is empty.
-- It is tenant-scoped: it only inserts rows for mdfaizal695@gmail.com.

DO $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT id INTO v_owner
  FROM auth.users
  WHERE lower(email) = 'mdfaizal695@gmail.com'
  LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Supabase auth account mdfaizal695@gmail.com was not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.products WHERE owner_id = v_owner) THEN
    RAISE NOTICE 'Products already exist for this owner; nothing inserted.';
    RETURN;
  END IF;

  INSERT INTO public.products
    (owner_id, name, brand, category, model, sku, serial_number, imei,
     purchase_price, selling_price, stock, image_url, created_at, updated_at)
  VALUES
    (v_owner,'iPhone 15','Apple','Mobile','A3090','APL-IP15-128',NULL,NULL,65900,69900,12,'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Galaxy S24','Samsung','Mobile','SM-S921B','SAM-S24-256',NULL,NULL,58900,62999,8,'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Pixel 8a','Google','Mobile','GKV4X','GOO-P8A-128',NULL,NULL,39900,42999,3,'https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Nord CE 4','OnePlus','Mobile','CPH2613','OP-NCE4-256',NULL,NULL,21900,24999,18,'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Vivo V30','Vivo','Mobile','V2318','VIV-V30-256',NULL,NULL,28900,32999,0,'https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'MacBook Air M3','Apple','Laptop','A3113','APL-MBA-M3',NULL,NULL,101000,114900,5,'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Inspiron 14','Dell','Laptop','5430','DEL-INS14-I5',NULL,NULL,48500,53990,7,'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'IdeaPad Slim 5','Lenovo','Laptop','83D0','LEN-IPS5-R7',NULL,NULL,57000,62990,2,'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Pavilion 14','HP','Laptop','dv2015','HP-PAV14-I5',NULL,NULL,54800,59990,9,'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Bravia 55" 4K','Sony','TV','KD-55X74L','SON-BR55-4K',NULL,NULL,61500,69990,4,'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Crystal 43" Smart TV','Samsung','TV','UA43CUE70','SAM-TV43-4K',NULL,NULL,26900,31990,6,'https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'4K LED 50"','TCL','TV','50P635','TCL-TV50-4K',NULL,NULL,24500,28990,1,'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Godrej 236L Frost Free','Godrej','Refrigerator','RF EON 236B','GOD-FR236',NULL,NULL,24500,28990,4,'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Convertible 340L','LG','Refrigerator','GL-S382SDSX','LG-FR340',NULL,NULL,40500,46990,3,'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Double Door 253L','Whirlpool','Refrigerator','IF INV CNV 278','WHI-FR253',NULL,NULL,28900,33990,0,'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'1.5T 5 Star Inverter','LG','AC','KS-Q18ENZA','LG-AC15-5S',NULL,NULL,38200,44990,6,'https://images.unsplash.com/photo-1631545806609-7e0b6a58e2d1?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'1.5T 3 Star Split AC','Voltas','AC','183V Vectra','VLT-AC15-3S',NULL,NULL,29900,34990,10,'https://images.unsplash.com/photo-1631545806609-7e0b6a58e2d1?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'1.5T 5 Star Inverter','Daikin','AC','FTKM50U','DAI-AC15-5S',NULL,NULL,42500,48990,2,'https://images.unsplash.com/photo-1631545806609-7e0b6a58e2d1?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'WH-1000XM5','Sony','Audio','WH1000XM5','SON-HP-XM5',NULL,NULL,24500,29990,4,'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'AirPods Pro 2','Apple','Audio','MTJV3HN/A','APL-APP2-USB',NULL,NULL,19800,24900,7,'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'Soundbar 300','Bose','Audio','926283','BOS-SB300',NULL,NULL,24500,29900,1,'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'EOS R50 Kit','Canon','Camera','5539C013','CAN-R50-18',NULL,NULL,53500,59990,2,'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'ZV-E10 II','Sony','Camera','ZVE10M2','SON-ZVE10-2',NULL,NULL,69500,76990,3,'https://images.unsplash.com/photo-1606986628253-4b2c6c7f2f77?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'X-S20 Body','Fujifilm','Camera','16802341','FUJ-XS20',NULL,NULL,98500,109990,1,'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=90',now(),now()),
    (v_owner,'65W GaN Charger','Anker','Accessories','A2663','ANK-GAN-65',NULL,NULL,2850,3499,24,'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1000&q=90',now(),now());

  RAISE NOTICE 'Restored 26 products for %', v_owner;
END $$;
