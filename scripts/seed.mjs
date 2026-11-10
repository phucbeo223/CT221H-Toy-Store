import {pool,transaction} from '../server/db.mjs';
import {hashPassword} from '../server/auth.mjs';
import {randomUUID} from 'node:crypto';
const catalog=[
 ['TJ-001','Thành phố sắc màu','Bộ 120 khối gỗ lắp ráp với những mái nhà, cầu và cây xanh. Bé tự xây thành phố, rèn tư duy không gian và khả năng phối hợp tay mắt.','Lắp ráp',389000,459000,48,3,8,'blocks','#f3edff','Bán chạy'],
 ['TJ-002','Gấu bông Mây','Bạn gấu ôm mềm mại làm từ vải nhung, bông PP đàn hồi. Cao 35 cm, phù hợp làm quà sinh nhật và bạn đồng hành trước giờ ngủ.','Thú bông',249000,299000,32,0,12,'bear','#f9e8d9','Được yêu thích'],
 ['TJ-003','Xe đua Tia Chớp','Ô tô đua màu đỏ có bánh cao su, cơ chế chạy đà không dùng pin. Thiết kế bo tròn, dành cho bé mê tốc độ và khám phá chuyển động.','Xe & mô hình',179000,219000,65,3,10,'car','#e6f1ea',null],
 ['TJ-004','Robot khám phá Nova','Robot lắp ráp 85 chi tiết có khớp tay chân chuyển động. Đồ chơi STEM giúp bé tìm hiểu cơ khí và sáng tạo câu chuyện khoa học.','Giáo dục',459000,529000,24,6,14,'robot','#e7ebff','Mới về'],
 ['TJ-005','Khủng long Lá Xanh','Mô hình khủng long cổ dài bằng gỗ tự nhiên. Bề mặt nhẵn, màu nước an toàn, đưa bé khám phá thế giới động vật thời tiền sử.','Xe & mô hình',219000,null,40,3,9,'dino','#ebf1db',null],
 ['TJ-006','Tên lửa lên cung trăng','Bộ xếp hình tên lửa và phi hành gia 150 mảnh, đưa bé vào cuộc phiêu lưu vũ trụ và rèn tính kiên nhẫn.','Lắp ráp',329000,379000,35,6,12,'rocket','#fff0d5','Phiêu lưu'],
 ['TJ-007','Ghép hình Cầu Vồng','Bộ 7 vòng cung gỗ nhiều màu có thể xếp chồng, tạo đường hầm và cân bằng. Giúp bé nhận biết màu sắc và kích thước.','Sáng tạo',289000,null,27,2,7,'puzzle','#f4e7ed',null],
 ['TJ-008','Đàn gỗ Nốt Nhạc','Đàn xylophone 8 thanh âm với hai dùi gỗ. Làm quen giai điệu, nhịp điệu và phát triển khả năng nghe cho bé từ 3 tuổi.','Giáo dục',269000,319000,18,3,8,'music','#fff3d4','Quà tặng hay'],
 ['TJ-009','Gấu nhỏ Mocha','Gấu bông màu cacao 25 cm với khăn quàng xanh. Mềm nhẹ, dễ mang theo trong những chuyến đi và giặt vệ sinh.','Thú bông',189000,null,45,0,10,'bear','#e9e2d7',null],
 ['TJ-010','Xe gỗ Dạo Phố','Ô tô mini bằng gỗ, màu xanh bạc hà. Kích thước vừa tay nhỏ, đẩy lăn nhẹ nhàng và khuyến khích vận động.','Xe & mô hình',129000,null,72,1,5,'car','#e1eee4',null],
 ['TJ-011','Lâu đài trong mơ','Bộ gạch lắp ghép lâu đài 240 chi tiết màu pastel. Bé có thể xây tòa tháp, cổng thành và sáng tạo thế giới cổ tích.','Lắp ráp',549000,629000,16,6,14,'blocks','#ece8fa','Bộ sưu tập mới'],
 ['TJ-012','Bảng màu diệu kỳ','Bộ vòng cung gỗ sáng tạo kèm thẻ gợi ý xếp hình. Phát triển óc thẩm mỹ, nhận diện màu và tư duy hình học.','Sáng tạo',199000,null,38,3,8,'puzzle','#ffe8d7',null],
 ['TJ-013','Robot tí hon Pip','Robot gỗ thân thiện với tay chân đàn hồi, dễ tạo dáng. Một người bạn nhỏ cho trò chơi đóng vai và kể chuyện.','Giáo dục',159000,null,53,3,9,'robot','#dfeeee',null],
 ['TJ-014','Khủng long Bầu Trời','Mô hình khủng long gỗ xanh lam với các khớp ghép đơn giản. Bé vừa lắp ráp vừa học tên gọi động vật.','Xe & mô hình',239000,279000,22,4,10,'dino','#e4ebf3',null],
 ['TJ-015','Trạm vũ trụ bé xíu','Tên lửa gỗ tháo lắp 5 tầng có phi hành gia nhỏ. Rèn trình tự, tư duy logic và kể chuyện không gian.','Giáo dục',359000,null,8,3,8,'rocket','#efe7f6',null],
 ['TJ-016','Ban nhạc khu vườn','Đàn gõ gỗ nhiều màu, âm lượng nhẹ, kèm thẻ bài hát. Bé thử những giai điệu đầu tiên và chơi cùng gia đình.','Sáng tạo',319000,369000,6,3,9,'music','#e6f0dd',null]
];
try{
 if(Number((await pool.query('SELECT count(*) FROM products')).rows[0].count)>0){console.log('Đã có dữ liệu; bỏ qua seed để giữ nguyên đơn hàng hiện có.');}
 else await transaction('seed (dữ liệu minh họa)',async c=>{
  const admin=(await c.query("INSERT INTO users(name,email,password_hash,role,wallet_balance) VALUES('Quản trị Toyjoy','admin@toyjoy.vn',$1,'admin',5000000) RETURNING id",[hashPassword('Admin@12345')])).rows[0];
  const customers=[];
  for(const [i,name] of ['Minh Anh','Hoàng Nam','Linh Chi','Bảo Ngọc','Tuấn Kiệt','Gia Hân','Thanh Hà','Khánh An'].entries()){
    customers.push((await c.query('INSERT INTO users(name,email,password_hash,wallet_balance) VALUES($1,$2,$3,5000000) RETURNING id',[name,i===0?'hello@toyjoy.vn':`demo${i}@toyjoy.vn`,hashPassword('Toyjoy@123')])).rows[0]);
  }
  for(const p of catalog){await c.query('INSERT INTO products(sku,name,description,category,price,original_price,stock,min_age,max_age,art,color,badge,sort_order) VALUES($1,$2,$3,$4,$5,$6,3000,$7,$8,$9,$10,$11,$12)',[...p.slice(0,6),...p.slice(7),catalog.indexOf(p)]);}
  // Synthetic history generated through the same stored procedure as checkout.
  for(let day=59;day>=0;day--){for(let j=0;j<(day%3)+1;j++){
    const customer=customers[(day+j)%6],pid=((day*3+j*5)%catalog.length)+1;
    const out=(await c.query('CALL place_order($1,$2::jsonb,$3,$4::jsonb,$5,NULL,NULL)',[customer.id,JSON.stringify([{product_id:pid,quantity:1+(day+j)%3}]),'cod',JSON.stringify({name:'Khách hàng minh họa',phone:'0901234567',detail:'Địa chỉ giả lập phục vụ đồ án'}),randomUUID()])).rows[0];
    await c.query("UPDATE orders SET status='completed',created_at=current_date-($2::int*interval '1 day')+interval '10 hours' WHERE id=$1",[out.p_order_id,day]);await c.query("UPDATE payments SET status='paid' WHERE order_id=$1",[out.p_order_id]);
  }}
  for(const [i,p] of catalog.entries())await c.query('UPDATE products SET stock=$1 WHERE sku=$2',[p[6],p[0]]);
  await c.query("INSERT INTO notifications(audience,title,body) VALUES('all','Chào mừng đến với Toyjoy!','Khám phá những món đồ chơi giúp bé lớn lên cùng niềm vui. Dữ liệu và số dư ví hiện tại là dữ liệu demo cho đồ án.');");
  console.log('Đã tạo 16 sản phẩm, 9 tài khoản và 120 đơn hàng lịch sử giả lập.');
 });
}finally{await pool.end();}
