# EduAdvisor

Website hỗ trợ Cố vấn học tập quản lý sinh viên. Phiên bản này giữ nguyên file `public/index.html` và giao diện HTML/CSS cũ đã cung cấp; bổ sung backend Node.js/Express và kết nối MySQL.

## Chức năng đã nối backend
- Đăng nhập/đăng xuất bằng session server và đổi mật khẩu (bcrypt hash).
- Danh sách, thêm, sửa, xóa sinh viên; dữ liệu được lưu MySQL.
- Đồng bộ thông tin từ giao diện cũ sang MySQL (UPSERT, không tự xóa dữ liệu DB).
- Nhập điểm: chuyên cần 10%, giữa kỳ 30%, cuối kỳ 60%; quy đổi thang 4 theo bảng quy đổi đang dùng trong mã nguồn cũ.
- GPA theo trọng số tín chỉ; xem điểm từng sinh viên.
- Nhập CSV qua API; xuất CSV danh sách cảnh báo qua API.
- Ghi lịch sử tư vấn vào bảng riêng và thông tin lịch sử JSON trên sinh viên.
- API dashboard, tình trạng kết nối và các API CRUD.

## 1. Cài đặt
Yêu cầu Node.js 18+ và MySQL 8+.

```bash
npm install
```

Sao chép `.env.example` thành `.env`, sau đó sửa `DB_PASSWORD` đúng mật khẩu MySQL của máy bạn. Thay `SESSION_SECRET` bằng chuỗi ngẫu nhiên dài.

## 2. Database
Mở MySQL Workbench, chạy file `database/schema.sql` trong database `eduadvisor`.

`server.js` cũng có bước migration bổ sung các cột còn thiếu cho bảng `students` và tạo các bảng phụ nếu chưa có. Không có lệnh DROP và không xóa dữ liệu hiện tại. Hãy sao lưu database trước khi nâng cấp bất kỳ ứng dụng nào.

## 3. Chạy ứng dụng

```bash
npm start
```

Mở: http://localhost:3000

Tài khoản lần đầu (được tạo nếu chưa tồn tại):
- Tài khoản: `cvht01`
- Mật khẩu: `Edu@123456`

Đăng nhập lần đầu và đổi mật khẩu trong giao diện. Có thể thay tài khoản/mật khẩu khởi tạo trong `.env` trước khi chạy lần đầu.

## 4. API chính
- `GET /api/health`
- `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/change-password`
- `GET /api/students`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`
- `POST /api/grades`, `GET /api/students/:id/grades`, `GET /api/students/:id/gpa`, `DELETE /api/grades/:id`
- `POST /api/grades/import` nhận JSON `{ "rows": [...] }`
- `POST /api/import/csv` nhận multipart form-data, key `file`
- `POST /api/advising`, `GET /api/advising/:studentId`
- `GET /api/dashboard`, `GET /api/export/warnings`

CSV cần các cột: `student_id,student_name,class_code,email,phone,semester,course_code,course_name,credits,attendance,midterm,final`.

## Lưu ý quan trọng
- Giao diện gốc sử dụng bộ quy tắc cảnh báo minh họa (GPA dưới 2.0, giảm GPA từ 0.8, nợ từ 12 tín chỉ; mức 2 khi GPA/CPA dưới 1.5 hoặc nợ từ 12). Cần đối chiếu quy chế chính thức của trường trước khi dùng để ra quyết định học vụ.
- Công thức điểm và quy đổi GPA giữ theo mã nguồn đã gửi, không khẳng định đây là quy chế chính thức của trường.
- Session store mặc định của Express phù hợp chạy thử trên máy cá nhân; khi triển khai thật cần cấu hình session store bền vững, HTTPS, sao lưu DB, CSRF/rate-limit và phân quyền quản trị đầy đủ.
- Trang gốc có các biểu đồ/demo UI cũ; phần biểu đồ lịch sử 4 học kỳ cần có đủ dữ liệu điểm theo học kỳ trong MySQL mới phản ánh dữ liệu thật.
- Không chạy `DROP TABLE`, `DROP DATABASE` hoặc script xóa dữ liệu trên database đang sử dụng.
