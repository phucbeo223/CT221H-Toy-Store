import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
test('photo catalog has 64 unique products, eight groups and an existing local photo for each item',async()=>{
 const {products}=JSON.parse(await readFile(new URL('../data/photo-catalog.json',import.meta.url),'utf8'));
 assert.equal(products.length,64);assert.equal(new Set(products.map(p=>p.sku)).size,64);assert.equal(new Set(products.map(p=>p.category)).size,8);
 for(const category of ['Thú bông','Búp bê','LEGO','Rubik','Cờ & board game'])assert.ok(products.some(p=>p.category===category));
 assert.ok(products.some(p=>/cờ vua/i.test(p.name)));
 for(const p of products){assert.ok(p.source_url.startsWith('https://'));assert.match(p.image_url,/^\/products\/[a-z0-9-]+\.(jpg|png|webp|avif)$/);assert.ok((await stat(new URL('../public'+p.image_url,import.meta.url))).size>1000);assert.ok(p.name.length<=150);}
});
