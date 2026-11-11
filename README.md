# EduAdvisor – Hệ thống hỗ trợ Cố vấn học tập

EduAdvisor là website hỗ trợ Cố vấn học tập (CVHT) quản lý thông tin sinh viên, theo dõi kết quả học tập, thống kê tín chỉ, nhận diện nguy cơ cảnh báo học vụ và ghi nhận lịch sử tư vấn.

Phiên bản này giữ lại giao diện HTML/CSS/JavaScript hiện có, đồng thời tích hợp backend Node.js/Express và cơ sở dữ liệu MySQL nhằm lưu trữ, truy xuất và đồng bộ dữ liệu.

---

## 1. Chức năng hệ thống

### 1.1. Quản lý tài khoản và xác thực

- Đăng nhập và đăng xuất bằng session phía máy chủ.
- Kiểm tra trạng thái đăng nhập.
- Đổi mật khẩu tài khoản.
- Mã hóa mật khẩu bằng bcrypt trước khi lưu vào cơ sở dữ liệu.
- Tạo tài khoản Cố vấn học tập mặc định nếu tài khoản chưa tồn tại.

### 1.2. Quản lý sinh viên

- Hiển thị danh sách sinh viên từ MySQL.
- Thêm mới thông tin sinh viên.
- Cập nhật hồ sơ sinh viên.
- Xóa sinh viên theo mã số sinh viên.
- Tìm kiếm theo MSSV và họ tên.
- Lọc và sắp xếp sinh viên theo kết quả học tập.
- Đồng bộ dữ liệu từ giao diện với MySQL thông qua API.

### 1.3. Quản lý điểm và kết quả học tập

- Nhập điểm học phần.
- Lưu thông tin điểm theo từng sinh viên và học kỳ.
- Tính điểm tổng kết từ các thành phần đánh giá.
- Quy đổi điểm hệ 10 sang hệ 4 và điểm chữ theo bảng quy đổi được cấu hình trong mã nguồn.
- Tính GPA học kỳ và CPA tích lũy theo trọng số tín chỉ.
- Xem kết quả học tập của từng sinh viên.
- Hỗ trợ nhập dữ liệu điểm bằng CSV.

Công thức tính điểm tổng kết đang được cấu hình:

\[
Điểm\ tổng\ kết = Chuyên\ cần \times 10\% + Giữa\ kỳ \times 30\% + Cuối\ kỳ \times 60\%
\]

Bảng quy đổi điểm và công thức cần được đối chiếu với quy chế đào tạo chính thức trước khi sử dụng trong thực tế.

### 1.4. Theo dõi tín chỉ và học phần còn nợ

- Theo dõi số tín chỉ đã tích lũy.
- Theo dõi số tín chỉ còn nợ.
- Xác định các môn học chưa đạt ở lần học mới nhất.
- Lưu lịch sử những môn từng trượt.
- Nhận diện các môn đã học lại và đạt yêu cầu.
- Hiển thị tình trạng học tập trong hồ sơ chi tiết sinh viên.

### 1.5. Cảnh báo học vụ

Hệ thống hỗ trợ phân tích các dấu hiệu học tập như:

- GPA học kỳ thấp.
- CPA tích lũy thấp.
- GPA giảm so với học kỳ trước.
- Sinh viên còn nhiều tín chỉ hoặc học phần chưa đạt.
- Tiến độ tích lũy tín chỉ chậm.

Các trường hợp được phân loại thành những nhóm trạng thái như Đạt chuẩn, Cảnh báo mức 1 và Cảnh báo mức 2 theo bộ quy tắc được cấu hình.

### 1.6. Quản lý tư vấn học tập

- Tạo biên bản tư vấn cho sinh viên.
- Ghi nhận hình thức tư vấn.
- Lưu nội dung trao đổi và kế hoạch cải thiện.
- Theo dõi ngày tư vấn gần nhất.
- Xem lịch sử tư vấn trong hồ sơ sinh viên.

### 1.7. Thống kê và báo cáo

- Dashboard tổng quan tình hình sinh viên.
- Thống kê GPA và CPA.
- Thống kê tình trạng học vụ.
- Thống kê tín chỉ và học phần còn nợ.
- Hiển thị biểu đồ phân bố kết quả học tập.
- Xuất dữ liệu danh sách sinh viên và cảnh báo dưới định dạng CSV.

### 1.8. Lộ trình học tập

- Theo dõi tiến độ tích lũy tín chỉ.
- Thống kê số tín chỉ còn thiếu.
- Xác định các môn cần học lại từ dữ liệu điểm.
- Đề xuất kế hoạch học tập tham khảo theo từng học kỳ.

Lộ trình được xây dựng dựa trên dữ liệu hiện có và cần được Cố vấn học tập kiểm tra lại điều kiện tiên quyết, lịch mở lớp và quy định đăng ký học phần.

---

## 2. Công nghệ sử dụng

| Công nghệ | Vai trò |
|---|---|
| HTML5 | Xây dựng cấu trúc giao diện |
| CSS3 | Thiết kế giao diện và bố cục |
| JavaScript | Xử lý chức năng phía trình duyệt |
| Node.js | Môi trường chạy JavaScript phía máy chủ |
| Express.js | Xây dựng backend và REST API |
| MySQL | Quản lý cơ sở dữ liệu |
| MySQL Workbench | Quản trị và truy vấn cơ sở dữ liệu |
| bcrypt | Mã hóa mật khẩu |
| express-session | Quản lý phiên đăng nhập |
| Chart.js | Hiển thị biểu đồ thống kê |
| Lucide | Bộ biểu tượng giao diện |

### Mô hình hoạt động

```text
                  NGƯỜI DÙNG
                       |
                       v
             GIAO DIỆN EDUADVISOR
              HTML / CSS / JS
                       |
                       v
                NODE.JS / EXPRESS
                       |
              REST API / SESSION
                       |
                       v
                  MYSQL SERVER
                       |
                       v
                 DATABASE
                  eduadvisor
```

---

## 3. Cấu trúc thư mục

```text
EduAdvisor_Complete/
│
├── database/
│   └── schema.sql
│
├── public/
│   ├── index.html
│   ├── grades.html
│   ├── *.csv
│   └── các tài nguyên giao diện khác
│
├── server.js
├── package.json
├── package-lock.json
├── .env
├── .env.example
├── .gitignore
├── README.md
└── patch_frontend.py
```

**Giải thích:**

- `database/schema.sql`: Cấu trúc cơ sở dữ liệu và các bảng cần thiết.
- `public/index.html`: Giao diện chính dành cho Cố vấn học tập.
- `public/grades.html`: Giao diện nhập điểm và quản lý GPA.
- `server.js`: Xử lý backend, xác thực, truy vấn MySQL và cung cấp API.
- `package.json`: Khai báo thông tin dự án và các thư viện phụ thuộc.
- `.env`: Chứa thông tin kết nối MySQL và cấu hình bảo mật.
- `.env.example`: File mẫu hướng dẫn cấu hình môi trường.
- `.gitignore`: Quy định những file không được đưa lên Git.
- `README.md`: Tài liệu hướng dẫn cài đặt và sử dụng dự án.

---

## 4. Yêu cầu môi trường

Trước khi cài đặt, cần chuẩn bị:

- Node.js phiên bản 18 trở lên.
- MySQL Server phiên bản 8 trở lên.
- MySQL Workbench.
- Visual Studio Code hoặc trình soạn thảo mã nguồn tương đương.
- Trình duyệt Google Chrome, Microsoft Edge hoặc Firefox.

---

## 5. Hướng dẫn cài đặt

### Bước 1: Tải mã nguồn

Clone repository:

```bash
git clone https://github.com/anhkhoi2908/EduAdvisor.git
```

Di chuyển vào thư mục dự án:

```bash
cd EduAdvisor
```

Nếu tải mã nguồn dưới dạng ZIP, giải nén và mở đúng thư mục chứa `package.json` và `server.js`.

### Bước 2: Cài đặt thư viện

Mở Terminal tại thư mục dự án và chạy:

```bash
npm install
```

Lệnh này sẽ cài đặt các thư viện được khai báo trong `package.json`.

### Bước 3: Tạo và cấu hình file môi trường

Sao chép file `.env.example` thành `.env`.

Trên Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Mở file `.env` và điều chỉnh cấu hình phù hợp với máy tính:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=eduadvisor

SESSION_SECRET=replace_with_a_long_random_secret

DEFAULT_ADVISOR_USERNAME=cvht01
DEFAULT_ADVISOR_PASSWORD=change_this_password
```

**Lưu ý:**

- Thay `your_mysql_password` bằng mật khẩu MySQL thực tế.
- Tạo `SESSION_SECRET` là một chuỗi ngẫu nhiên dài và khó đoán.
- Thay mật khẩu mặc định trước khi sử dụng chính thức.
- Không chia sẻ file `.env` và không commit file này lên GitHub.

### Bước 4: Tạo cơ sở dữ liệu MySQL

1. Mở MySQL Workbench.
2. Kết nối đến MySQL Server trên máy tính.
3. Mở file `database/schema.sql`.
4. Kiểm tra nội dung SQL.
5. Chạy script để tạo cơ sở dữ liệu và các bảng cần thiết.

Tên database sử dụng:

```sql
eduadvisor
```

Backend có thể thực hiện các bước migration bổ sung theo mã nguồn hiện tại.

**Quan trọng:** Không tự ý chạy lệnh `DROP DATABASE`, `DROP TABLE` hoặc script xóa dữ liệu trên cơ sở dữ liệu đang sử dụng. Nên sao lưu dữ liệu trước khi thay đổi cấu trúc database.

### Bước 5: Khởi chạy ứng dụng

Trong Terminal, chạy:

```bash
npm start
```

Nếu máy chủ khởi động thành công, truy cập:

```text
http://localhost:3000
```

Tài khoản Cố vấn học tập mặc định (nếu chưa tồn tại và cấu hình khởi tạo đang được bật):

```text
Tài khoản: cvht01
Mật khẩu: Edu@123456
```

Sau khi đăng nhập lần đầu, nên đổi mật khẩu ngay trong giao diện.

---

## 6. Các API chính

### 6.1. Xác thực tài khoản

| Phương thức | API | Chức năng |
|---|---|---|
| GET | `/api/auth/me` | Kiểm tra trạng thái đăng nhập |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| POST | `/api/auth/change-password` | Đổi mật khẩu |

### 6.2. Quản lý sinh viên

| Phương thức | API | Chức năng |
|---|---|---|
| GET | `/api/students` | Lấy danh sách sinh viên |
| POST | `/api/students` | Thêm sinh viên |
| PUT | `/api/students/:id` | Cập nhật sinh viên |
| DELETE | `/api/students/:id` | Xóa sinh viên |
| POST | `/api/students/sync` | Đồng bộ dữ liệu sinh viên |

### 6.3. Quản lý điểm

| Phương thức | API | Chức năng |
|---|---|---|
| POST | `/api/grades` | Thêm hoặc cập nhật điểm |
| GET | `/api/students/:id/grades` | Xem bảng điểm sinh viên |
| GET | `/api/students/:id/gpa` | Xem kết quả GPA |
| DELETE | `/api/grades/:id` | Xóa bản ghi điểm |
| POST | `/api/grades/import` | Nhập điểm bằng JSON |
| POST | `/api/import/csv` | Nhập dữ liệu CSV |

API nhập điểm JSON sử dụng cấu trúc:

```json
{
  "rows": [
    {
      "student_id": "SV001",
      "student_name": "Nguyen Van A",
      "course_code": "IT001",
      "course_name": "Co so du lieu",
      "semester": "HK1_2026",
      "credits": 3,
      "attendance": 8,
      "midterm": 7,
      "final": 8
    }
  ]
}
```

### 6.4. Tư vấn, thống kê và báo cáo

| Phương thức | API | Chức năng |
|---|---|---|
| POST | `/api/advising` | Ghi nhận buổi tư vấn |
| GET | `/api/advising/:studentId` | Xem lịch sử tư vấn |
| GET | `/api/dashboard` | Lấy dữ liệu dashboard |
| GET | `/api/export/warnings` | Xuất danh sách cảnh báo |
| GET | `/api/health` | Kiểm tra tình trạng máy chủ |

Các API yêu cầu đăng nhập phải được gọi kèm session hợp lệ.

---

## 7. Cấu trúc dữ liệu CSV nhập điểm

File CSV sử dụng các cột sau:

```csv
student_id,student_name,class_code,email,phone,semester,course_code,course_name,credits,attendance,midterm,final
```

Trong đó:

- `student_id`: Mã số sinh viên.
- `student_name`: Họ tên sinh viên.
- `class_code`: Mã lớp.
- `email`: Email sinh viên.
- `phone`: Số điện thoại.
- `semester`: Học kỳ.
- `course_code`: Mã học phần.
- `course_name`: Tên học phần.
- `credits`: Số tín chỉ.
- `attendance`: Điểm chuyên cần.
- `midterm`: Điểm giữa kỳ.
- `final`: Điểm cuối kỳ.

Cần kiểm tra dữ liệu trước khi nhập để tránh sai MSSV, sai mã học phần, trùng bản ghi hoặc thiếu thông tin bắt buộc.

---

## 8. An toàn và bảo mật dữ liệu

Khi sử dụng và phát triển hệ thống, cần chú ý:

1. Không đưa file `.env` chứa mật khẩu và khóa phiên lên GitHub.
2. Không lưu mật khẩu người dùng dưới dạng văn bản thuần.
3. Không sử dụng dữ liệu cá nhân hoặc bảng điểm thật khi chia sẻ repository công khai nếu chưa được phép.
4. Sao lưu MySQL trước khi nâng cấp hoặc chỉnh sửa cơ sở dữ liệu.
5. Không sử dụng session store mặc định của Express cho hệ thống triển khai thực tế.
6. Khi triển khai, cần cấu hình HTTPS, session store phù hợp, CSRF protection, rate limiting và phân quyền truy cập.
7. Kiểm tra và giới hạn quyền truy cập API theo vai trò tài khoản.

Các ngưỡng cảnh báo học vụ và công thức quy đổi điểm hiện tại là cấu hình của ứng dụng, cần được đối chiếu với quy chế đào tạo chính thức của nhà trường trước khi áp dụng vào quyết định học vụ.

---

## 9. Hướng phát triển

Một số chức năng có thể tiếp tục nghiên cứu và phát triển:

- Xây dựng cổng sinh viên với tài khoản đăng nhập riêng.
- Phân quyền Cố vấn học tập và sinh viên ở cả giao diện và backend.
- Cho phép sinh viên xem lộ trình học tập và các học phần còn nợ của chính mình.
- Hoàn thiện thống kê kết quả học tập theo nhiều học kỳ.
- Xây dựng biểu đồ theo dõi tiến độ học tập.
- Bổ sung thông báo khi có thay đổi điểm hoặc trạng thái cảnh báo.
- Hoàn thiện chức năng sao lưu và khôi phục dữ liệu.

---

## 10. Tác giả và repository

**Dự án:** EduAdvisor – Hệ thống hỗ trợ Cố vấn học tập

**GitHub:** https://github.com/anhkhoi2908/EduAdvisor

**Công nghệ chính:** Node.js, Express.js, MySQL, HTML, CSS, JavaScript.

