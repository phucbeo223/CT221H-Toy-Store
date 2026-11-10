import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {pool,transaction} from '../server/db.mjs';

// Public catalog metadata only; descriptions below are written for this demo.
const groups=[
 {category:'Thú bông',handle:'thu-bong',count:8,art:'bear',age:3,description:'Thú nhồi bông để ôm, trang trí góc ngủ hoặc làm quà sinh nhật. Một người bạn mềm mại cho những câu chuyện và trò chơi đóng vai.',prefer:/gấu|bear|teddy|pooh/i,exclude:/máy nuôi|quả trứng|túi mù/i},
 {category:'Búp bê',handle:'bup-be',count:8,art:'bear',age:3,description:'Búp bê dành cho trò chơi nhập vai, kể chuyện và xây dựng thế giới nhân vật. Có thể phối hợp với bộ sưu tập búp bê của bé để sáng tạo những cuộc phiêu lưu mới.',exclude:/phụ kiện|giày|trang phục|xe cắm trại/i},
 {category:'LEGO',handle:'lego',count:12,art:'blocks',age:6,description:'Bộ LEGO lắp ráp để khám phá mô hình, ghép các chi tiết theo hướng dẫn và sáng tạo cách chơi riêng. Phù hợp với sở thích xây dựng, kể chuyện và sưu tầm mô hình.',exclude:/minifigures|botanicals|editions|icons|art |architecture/i},
 {category:'Rubik',host:'https://speedcubeshop.com',handle:'3x3-speed-cubes',count:8,art:'puzzle',age:8,description:'Khối Rubik 3x3 để luyện xoay tầng, nhận diện màu sắc và ghi nhớ trình tự giải. Có thể dùng cho việc học giải khối lập phương hoặc luyện kỹ năng speedcubing.',prefer:/QiYi Warrior|YJ MGC|GAN|Tornado|RS3|WeiLong/i,exclude:/calendar|spooky|frozen|autograph|blind|keychain/i},
 {category:'Cờ & board game',handle:'board-game',count:8,art:'puzzle',age:6,description:'Trò chơi bàn dành cho những buổi chơi cùng bạn bè hoặc gia đình. Làm quen luật chơi, chờ lượt, cân nhắc lựa chọn và tương tác trực tiếp với người chơi khác.',prefer:/cờ vua|chess|cờ tỷ phú|domino|uno/i},
 {category:'Xe & mô hình',handle:'xe-dieu-khien-tu-xa',count:8,art:'car',age:6,description:'Xe đồ chơi điều khiển từ xa dành cho người yêu các phương tiện và mô hình ô tô. Có thể tạo đường chạy, thử điều khiển và trưng bày trong bộ sưu tập xe.'},
 {category:'Sáng tạo',handle:'do-choi-sang-tao',count:6,art:'puzzle',age:3,description:'Bộ đồ chơi sáng tạo để thử phối màu, tạo hình và thể hiện ý tưởng bằng đôi tay. Phù hợp cho các buổi chơi thủ công, kể chuyện và khám phá hình dạng.',exclude:/combo|ngẫu nhiên|lắp ráp bó hoa/i},
 {category:'Giáo dục',handle:'do-choi-giao-duc',count:6,art:'robot',age:3,description:'Đồ chơi học qua trải nghiệm, hỗ trợ bé khám phá hình khối, chữ, số, âm thanh hoặc những hoạt động thường ngày. Chơi cùng người lớn để đặt câu hỏi và thử những cách chơi mới.',exclude:/xe tập đi/i}
];
const selected=new Set();
async function getProducts(group){
 const host=group.host||'https://www.mykingdom.com.vn';
 const r=await fetch(`${host}/collections/${group.handle}/products.json?limit=200`,{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`Nguồn ${group.handle}: HTTP ${r.status}`);
 const data=await r.json();
 const candidates=(data.products||[]).filter(p=>p.images?.[0]?.src&&p.variants?.some(v=>Number(v.price)>0)&&!group.exclude?.test(p.title));
 if(group.prefer)candidates.sort((a,b)=>Number(group.prefer.test(b.title))-Number(group.prefer.test(a.title)));
 // Give the Rubik group distinct brands/models, rather than eight color variants.
 const modelKeys=new Set();
 const rows=[];
 for(const p of candidates){
  const key=host+':'+p.id;if(selected.has(key))continue;
  const modelKey=p.title.replace(/\s*\([^)]*\)/g,'').trim();
  if(group.category==='Rubik'&&modelKeys.has(modelKey))continue;
  selected.add(key);modelKeys.add(modelKey);
  const name=(group.category==='Rubik'?'Rubik '+p.title:p.title.replace(/^Đồ [Cc]hơi\s*/,'')).replace(/\s+/g,' ').trim().slice(0,150);
  const image=new URL(p.images[0].src);image.searchParams.set('width','800');
  const sku=(group.host?'SCS-':'MKD-')+p.id;
  const price=group.host?129000+rows.length*70000:Math.max(1000,Math.round(Number(p.variants.find(v=>Number(v.price)>0).price)/1000)*1000);
  const titleHints=/cờ vua|chess/i.test(name)?'Bộ cờ vua gồm các quân cờ và bàn cờ, dành cho hai người chơi. Tập suy nghĩ chiến lược, tính nước đi và chơi cờ cùng gia đình.':group.description;
  rows.push({sku,name,description:`${name}. ${titleHints} Thương hiệu: ${p.vendor||'xem nguồn'}. Giá, tồn kho và độ tuổi trên Toyjoy là dữ liệu minh họa; đối chiếu thông tin nhà sản xuất tại trang nguồn.`,category:group.category,price,original_price:null,stock:18+(rows.length*7)%45,min_age:group.age,max_age:99,art:group.art,color:'#f7f7f2',badge:rows.length===0?'Có ảnh thật':null,active:true,image_alt:name,source_url:`${host}/products/${p.handle}`,source_name:group.host?'SpeedCubeShop':'MyKingdom',brand:p.vendor||null,image_source_url:image.href});
  if(rows.length===group.count)break;
 }
 if(rows.length!==group.count)throw new Error(`Nhóm ${group.category} chỉ lấy được ${rows.length}/${group.count}`);
 return rows;
}
async function downloadPhoto(row){
 await mkdir('public/products',{recursive:true});
 const key=row.sku.toLowerCase();
 // Images are kept locally so the demo does not depend on hotlink availability.
 const r=await fetch(row.image_source_url,{signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw new Error(`${row.sku}: tải ảnh HTTP ${r.status}`);
 const mime=r.headers.get('content-type')||'';
 if(!/^image\/(jpeg|png|webp|avif)/.test(mime))throw new Error(`${row.sku}: nguồn không trả ảnh`);
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<1000||bytes.length>8_000_000)throw new Error(`${row.sku}: dung lượng ảnh không hợp lệ`);
 const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':mime.includes('avif')?'avif':'jpg';
 const target=`public/products/${key}.${ext}`;await writeFile(target,bytes);row.image_url=`/products/${key}.${ext}`;
}

try{
 let rows;
 if(process.argv.includes('--from-cache'))rows=JSON.parse(await readFile('data/photo-catalog.json','utf8')).products;
 else{
  console.log('Đang lấy sản phẩm và ảnh từ các danh mục công khai...');
  const collections=[];for(const group of groups){collections.push(await getProducts(group));console.log(group.category,collections.at(-1).length);}
  rows=[];for(let i=0;i<12;i++)for(const list of collections)if(list[i])rows.push({...list[i],sort_order:rows.length});
  let cursor=0,completed=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<rows.length){const row=rows[cursor++];await downloadPhoto(row);completed++;if(completed%8===0)console.log(`Đã tải ${completed}/${rows.length} ảnh`);}}));
  await mkdir('data',{recursive:true});await writeFile('data/photo-catalog.json',JSON.stringify({fetched_at:new Date().toISOString(),purpose:'Dữ liệu và ảnh tham khảo cho đồ án; không đại diện giá bán hoặc tồn kho của nhà cung cấp.',products:rows},null,2)+'\n');
 }
 if(rows.length!==64)throw new Error('Danh mục phải có đúng 64 sản phẩm.');
 for(const row of rows){if(!/^\/products\/[a-z0-9-]+\.(jpg|png|webp|avif)$/.test(row.image_url))throw new Error('Đường dẫn ảnh không hợp lệ');await stat('public'+row.image_url);}
 await transaction('import: ảnh đồ chơi thật',async c=>{
  // Preserve old IDs, order items and stock history; hide only the original SVG demo catalog.
  await c.query("UPDATE products SET active=false WHERE sku ~ '^TJ-[0-9]{3}$' AND active");
  for(const row of rows){const keys=Object.keys(row);const updates=keys.filter(k=>!['sku','stock'].includes(k));await c.query(`INSERT INTO products(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT(sku) DO UPDATE SET ${updates.map(k=>k+'=EXCLUDED.'+k).join(',')}`,Object.values(row));}
 });
 console.log(JSON.stringify({imported:rows.length,categories:groups.map(g=>({name:g.category,count:g.count})),localPhotos:rows.length,oldOrdersPreserved:true}));
}finally{await pool.end();}
