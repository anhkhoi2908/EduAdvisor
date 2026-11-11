'use strict';

require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(PUBLIC_DIR));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eduadvisor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true
});

// Login sessions are held in memory. Restarting Node.js signs users out.
const sessions = new Map();
const SESSION_COOKIE = 'eduadvisor_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let bcryptLib = null;
try { bcryptLib = require('bcryptjs'); } catch (_) {
  try { bcryptLib = require('bcrypt'); } catch (_) { /* optional dependency */ }
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function clean(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const result = value.replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').trim();
    return result === '' ? null : result;
  }
  return value;
}

function numberValue(value, fallback = 0) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function validateScore(value, label) {
  const n = numberValue(value, NaN);
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    throw new Error(`${label} phải là số từ 0 đến 10.`);
  }
  return n;
}

function validateCredits(value) {
  const n = numberValue(value, NaN);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error('Số tín chỉ phải là số nguyên từ 1 đến 100.');
  }
  return n;
}

function calculateTotalScore(attendance, midterm, finalScore) {
  return Number((attendance * 0.1 + midterm * 0.3 + finalScore * 0.6).toFixed(2));
}

function calculateGradePoint(total) {
  if (total >= 9.0) return 4.0;
  if (total >= 8.5) return 3.7;
  if (total >= 8.0) return 3.5;
  if (total >= 7.0) return 3.0;
  if (total >= 6.5) return 2.5;
  if (total >= 5.5) return 2.0;
  if (total >= 5.0) return 1.5;
  if (total >= 4.0) return 1.0;
  return 0.0;
}

function calculateLetterGrade(total) {
  if (total >= 9.0) return 'A';
  if (total >= 8.5) return 'A-';
  if (total >= 8.0) return 'B+';
  if (total >= 7.0) return 'B';
  if (total >= 6.5) return 'C+';
  if (total >= 5.5) return 'C';
  if (total >= 5.0) return 'D+';
  if (total >= 4.0) return 'D';
  return 'F';
}

function gradeInput(row = {}) {
  const studentId = clean(row.student_id ?? row.studentId ?? row.id);
  const studentName = clean(row.student_name ?? row.studentName ?? row.full_name ?? row.fullName ?? row.name);
  const courseCode = clean(row.course_code ?? row.courseCode ?? row.code);
  const courseName = clean(row.course_name ?? row.courseName ?? row.name_course);
  const semester = clean(row.semester);

  if (!studentId || !courseCode || !courseName || !semester) {
    throw new Error('Thiếu MSSV, mã môn, tên môn hoặc học kỳ.');
  }

  const attendance = validateScore(row.attendance, 'Điểm chuyên cần');
  const midterm = validateScore(row.midterm, 'Điểm giữa kỳ');
  const finalScore = validateScore(row.final ?? row.final_exam ?? row.finalExam, 'Điểm cuối kỳ');
  const courseCredits = validateCredits(row.credits ?? row.tc);
  const total = calculateTotalScore(attendance, midterm, finalScore);

  return {
    studentId: String(studentId),
    studentName: studentName ? String(studentName) : null,
    courseCode: String(courseCode),
    courseName: String(courseName),
    semester: String(semester),
    credits: courseCredits,
    attendance,
    midterm,
    finalScore,
    totalScore: total,
    gradePoint: calculateGradePoint(total),
    letterGrade: calculateLetterGrade(total)
  };
}

function studentInput(body = {}) {
  const studentId = clean(body.student_id ?? body.studentId ?? body.id);
  const fullName = clean(body.full_name ?? body.fullName ?? body.student_name ?? body.studentName ?? body.name);
  if (!studentId) throw new Error('Mã sinh viên không được để trống.');
  if (!fullName) throw new Error('Họ tên sinh viên không được để trống.');
  if (String(studentId).length > 30) throw new Error('MSSV tối đa 30 ký tự.');
  if (String(fullName).length > 120) throw new Error('Họ tên tối đa 120 ký tự.');

  const cpa = numberValue(body.cpa, 0);
  const gpaHK = numberValue(body.gpa_hk ?? body.gpaHK, 0);
  const prevGpa = numberValue(body.prev_gpa ?? body.prevGpa, 0);
  if (![cpa, gpaHK, prevGpa].every(n => Number.isFinite(n) && n >= 0 && n <= 4)) {
    throw new Error('CPA/GPA phải nằm trong khoảng 0 đến 4.');
  }

  const accumulatedCredits = numberValue(body.accumulated_credits ?? body.accumulatedCredits, 0);
  const debtCredits = numberValue(body.debt_credits ?? body.debtCredits, 0);
  const failedCoursesCount = numberValue(body.failed_courses_count ?? body.failedCoursesCount, 0);
  if (![accumulatedCredits, debtCredits, failedCoursesCount].every(n => Number.isInteger(n) && n >= 0 && n <= 500)) {
    throw new Error('Các trường tín chỉ và số môn phải là số nguyên không âm.');
  }

  return {
    student_id: String(studentId),
    full_name: String(fullName),
    class_code: clean(body.class_code ?? body.classCode),
    email: clean(body.email),
    phone: clean(body.phone),
    cpa, gpa_hk: gpaHK, prev_gpa: prevGpa,
    accumulated_credits: accumulatedCredits,
    debt_credits: debtCredits,
    failed_courses_count: failedCoursesCount,
    last_advising: clean(body.last_advising ?? body.lastAdvising),
    advising_note: clean(body.advising_note ?? body.advisingNote),
    advising_history: body.advising_history ?? body.advisingHistory ?? []
  };
}

async function updateSemesterGpa(connection, studentId, semester) {
  // grade_point is stored on each course row and maintained by this server.
  const [rows] = await connection.execute(`
    SELECT ROUND(SUM(grade_point * credits) / NULLIF(SUM(credits), 0), 2) AS gpa
    FROM course_grades
    WHERE student_id = ? AND semester = ?
  `, [studentId, semester]);
  const gpa = Number(rows[0]?.gpa ?? 0);
  await connection.execute('UPDATE students SET gpa_hk = ? WHERE student_id = ?', [gpa, studentId]);
  return gpa;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const result = {};
  header.split(';').forEach(part => {
    const index = part.indexOf('=');
    if (index > 0) result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return result;
}

function safeTextEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

async function verifyPassword(password, storedHash) {
  const hash = String(storedHash || '');
  if (hash.startsWith('sha256$')) {
    const expected = hash.slice('sha256$'.length);
    const actual = crypto.createHash('sha256').update(String(password)).digest('hex');
    return safeTextEqual(actual.toLowerCase(), expected.toLowerCase());
  }
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    const actual = crypto.createHash('sha256').update(String(password)).digest('hex');
    return safeTextEqual(actual.toLowerCase(), hash.toLowerCase());
  }
  if (hash.startsWith('scrypt$')) {
    const parts = hash.split('$');
    if (parts.length !== 3) return false;
    const derived = crypto.scryptSync(String(password), parts[1], 64).toString('hex');
    return safeTextEqual(derived, parts[2]);
  }
  if (/^\$2[aby]\$/.test(hash) && bcryptLib) {
    return bcryptLib.compare(String(password), hash);
  }
  // Backward compatibility for an old demo user whose password_hash contains plain text.
  // For real deployment, migrate those rows to scrypt/bcrypt hashes.
  return safeTextEqual(password, hash);
}

function requireAuth(req, res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
  req.user = session.user;
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  next();
}

function decodeJson(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

// ---------------------------------------------------------
// AUTH API: uses users table from the supplied SQL schema.
// Password hashes may be scrypt, bcrypt (when bcryptjs/bcrypt installed),
// or plain text for backward-compatible local demo accounts.
// ---------------------------------------------------------
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const username = clean(req.body?.username);
  const password = req.body?.password;
  if (!username || password === undefined || password === '') {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu.' });
  }

  const [rows] = await pool.execute(`
    SELECT id, username, password_hash, full_name, role, active
    FROM users WHERE username = ? LIMIT 1
  `, [username]);
  const user = rows[0];
  if (!user || Number(user.active) !== 1 || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  res.json({ success: true, authenticated: true, user: { username: user.username, fullName: user.full_name, role: user.role } });
}));

app.get('/api/auth/me', (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  const authenticated = Boolean(session && session.expiresAt >= Date.now());
  if (authenticated) session.expiresAt = Date.now() + SESSION_TTL_MS;
  res.json({ authenticated, user: authenticated ? session.user : null });
});

app.post('/api/auth/logout', (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ success: true, message: 'Đã đăng xuất.' });
});

app.post('/api/auth/change-password', requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = String(req.body?.newPassword || '');
  if (!currentPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
  }
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  if (!rows.length || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
  }
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id]);
  res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
}));

// ---------------------------------------------------------
// HEALTH
// ---------------------------------------------------------
app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ success: true, message: 'EduAdvisor API đang hoạt động.', database: 'connected' });
}));

// ---------------------------------------------------------
// STUDENTS
// ---------------------------------------------------------
app.get('/api/students', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT
      student_id AS id,
      student_id AS studentId,
      full_name AS name,
      full_name AS full_name,
      class_code AS classCode,
      email,
      phone,
      cpa,
      gpa_hk AS gpaHK,
      prev_gpa AS prevGpa,
      accumulated_credits AS accumulatedCredits,
      debt_credits AS debtCredits,
      failed_courses_count AS failedCoursesCount,
      last_advising AS lastAdvising,
      advising_note AS advisingNote,
      advising_history AS advisingHistory
    FROM students
    ORDER BY student_id
  `);
  res.json(rows.map(row => ({
    ...row,
    cpa: Number(row.cpa || 0),
    gpaHK: Number(row.gpaHK || 0),
    prevGpa: Number(row.prevGpa || 0),
    accumulatedCredits: Number(row.accumulatedCredits || 0),
    debtCredits: Number(row.debtCredits || 0),
    failedCoursesCount: Number(row.failedCoursesCount || 0),
    advisingHistory: decodeJson(row.advisingHistory, []),
    courses: [], reasons: [], status: 'NORMAL', statusLabel: 'Đạt chuẩn'
  })));
}));

app.get('/api/students/:id', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT student_id AS id, student_id AS studentId,
      full_name AS name, full_name AS full_name, class_code AS classCode,
      email, phone, cpa, gpa_hk AS gpaHK, prev_gpa AS prevGpa,
      accumulated_credits AS accumulatedCredits, debt_credits AS debtCredits,
      failed_courses_count AS failedCoursesCount, last_advising AS lastAdvising,
      advising_note AS advisingNote, advising_history AS advisingHistory
    FROM students WHERE student_id = ?
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên.' });
  const row = rows[0];
  row.advisingHistory = decodeJson(row.advisingHistory, []);
  res.json(row);
}));

app.post('/api/students', requireAuth, asyncHandler(async (req, res) => {
  const s = studentInput(req.body);
  await pool.execute(`
    INSERT INTO students (
      student_id, full_name, class_code, email, phone, cpa, gpa_hk, prev_gpa,
      accumulated_credits, debt_credits, failed_courses_count, last_advising,
      advising_note, advising_history
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [s.student_id, s.full_name, s.class_code, s.email, s.phone, s.cpa, s.gpa_hk,
    s.prev_gpa, s.accumulated_credits, s.debt_credits, s.failed_courses_count,
    s.last_advising, s.advising_note, JSON.stringify(s.advising_history || [])]);
  res.status(201).json({ success: true, message: 'Thêm sinh viên thành công.', id: s.student_id });
}));

app.put('/api/students/:id', requireAuth, asyncHandler(async (req, res) => {
  const s = studentInput({ ...req.body, student_id: req.params.id });
  const [result] = await pool.execute(`
    UPDATE students SET full_name=?, class_code=?, email=?, phone=?, cpa=?, gpa_hk=?, prev_gpa=?,
      accumulated_credits=?, debt_credits=?, failed_courses_count=?, last_advising=?, advising_note=?, advising_history=?
    WHERE student_id=?
  `, [s.full_name, s.class_code, s.email, s.phone, s.cpa, s.gpa_hk, s.prev_gpa,
    s.accumulated_credits, s.debt_credits, s.failed_courses_count, s.last_advising,
    s.advising_note, JSON.stringify(s.advising_history || []), req.params.id]);
  if (!result.affectedRows) {
    const [exists] = await pool.execute('SELECT student_id FROM students WHERE student_id=?', [req.params.id]);
    if (!exists.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên.' });
  }
  res.json({ success: true, message: 'Cập nhật sinh viên thành công.' });
}));

// Upsert from the existing index.html. Does not delete any student record.
app.post('/api/students/sync', requireAuth, asyncHandler(async (req, res) => {
  const rows = req.body?.students;
  if (!Array.isArray(rows)) return res.status(400).json({ success: false, message: 'Thiếu mảng students.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const raw of rows) {
      const s = studentInput(raw);
      await connection.execute(`
        INSERT INTO students (
          student_id, full_name, class_code, email, phone, cpa, gpa_hk, prev_gpa,
          accumulated_credits, debt_credits, failed_courses_count, last_advising,
          advising_note, advising_history
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          full_name=VALUES(full_name), class_code=VALUES(class_code), email=VALUES(email), phone=VALUES(phone),
          cpa=VALUES(cpa), gpa_hk=VALUES(gpa_hk), prev_gpa=VALUES(prev_gpa),
          accumulated_credits=VALUES(accumulated_credits), debt_credits=VALUES(debt_credits),
          failed_courses_count=VALUES(failed_courses_count), last_advising=VALUES(last_advising),
          advising_note=VALUES(advising_note), advising_history=VALUES(advising_history)
      `, [s.student_id, s.full_name, s.class_code, s.email, s.phone, s.cpa, s.gpa_hk,
        s.prev_gpa, s.accumulated_credits, s.debt_credits, s.failed_courses_count,
        s.last_advising, s.advising_note, JSON.stringify(s.advising_history || [])]);
    }
    await connection.commit();
    res.json({ success: true, message: `Đã đồng bộ ${rows.length} sinh viên.` });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.delete('/api/students/:id', requireAuth, asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // CASCADE in SQL already removes grades/advising, explicit delete is retained for legacy DBs.
    await connection.execute('DELETE FROM course_grades WHERE student_id=?', [req.params.id]);
    await connection.execute('DELETE FROM advising_sessions WHERE student_id=?', [req.params.id]);
    const [result] = await connection.execute('DELETE FROM students WHERE student_id=?', [req.params.id]);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên.' });
    }
    await connection.commit();
    res.json({ success: true, message: 'Xóa sinh viên thành công.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// ---------------------------------------------------------
// ADVISING
// ---------------------------------------------------------
app.post('/api/advising', requireAuth, asyncHandler(async (req, res) => {
  const studentId = clean(req.body?.student_id ?? req.body?.studentId);
  const content = clean(req.body?.content);
  const commitment = clean(req.body?.commitment ?? req.body?.action);
  const channel = clean(req.body?.channel) || 'Trực tiếp';
  if (!studentId || !content) return res.status(400).json({ success: false, message: 'Thiếu sinh viên hoặc nội dung tư vấn.' });

  const [students] = await pool.execute('SELECT full_name, advising_history FROM students WHERE student_id=?', [studentId]);
  if (!students.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên.' });

  const today = new Date();
  const dateText = today.toLocaleDateString('vi-VN');
  const note = channel;
  const entry = {
    date: dateText,
    title: `Tư vấn ngày ${dateText}`,
    content: commitment ? `${content} - Cam kết: ${commitment}` : content,
    note
  };
  const history = decodeJson(students[0].advising_history, []);
  history.unshift(entry);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`
      INSERT INTO advising_sessions (student_id, advisor_username, content, commitment, channel)
      VALUES (?, ?, ?, ?, ?)
    `, [studentId, req.user.username, content, commitment, channel]);
    await connection.execute(`
      UPDATE students SET last_advising=?, advising_note=?, advising_history=? WHERE student_id=?
    `, [dateText, commitment || 'Đã cập nhật tư vấn', JSON.stringify(history), studentId]);
    await connection.commit();
    res.status(201).json({ success: true, message: 'Đã lưu biên bản tư vấn.', history: entry });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// ---------------------------------------------------------
// GRADES API
// ---------------------------------------------------------
// IMPORTANT: actual PK is grade_id. We expose it as `id` alias for old UI compatibility.
app.get('/api/grades', requireAuth, asyncHandler(async (req, res) => {
  const studentId = clean(req.query.student_id ?? req.query.studentId);
  const semester = clean(req.query.semester);
  const conditions = [];
  const params = [];
  if (studentId) { conditions.push('cg.student_id = ?'); params.push(studentId); }
  if (semester) { conditions.push('cg.semester = ?'); params.push(semester); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(`
    SELECT
      cg.grade_id AS id,
      cg.grade_id AS gradeId,
      cg.student_id AS studentId,
      s.full_name AS studentName,
      cg.course_code AS code,
      cg.course_code AS courseCode,
      cg.course_name AS name,
      cg.course_name AS courseName,
      cg.semester,
      cg.credits AS tc,
      cg.credits,
      cg.attendance,
      cg.midterm,
      cg.final,
      cg.total_score AS total,
      cg.total_score AS totalScore,
      cg.grade_point AS gradePoint,
      cg.letter_grade AS letter,
      cg.letter_grade AS letterGrade
    FROM course_grades cg
    INNER JOIN students s ON s.student_id = cg.student_id
    ${where}
    ORDER BY cg.semester, cg.student_id, cg.course_code
  `, params);
  res.json(rows);
}));

app.get('/api/students/:id/grades', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT
      grade_id AS gradeId,
      student_id AS studentId,
      student_name AS studentName,
      course_code AS courseCode,
      course_name AS courseName,
      semester,
      credits,
      attendance,
      midterm,
      final,
      total_score AS totalScore,
      grade_point AS gradePoint,
      letter_grade AS letterGrade
    FROM course_grades
    WHERE student_id = ?
    ORDER BY semester, course_code, grade_id
  `, [req.params.id]);
  res.json(rows);
}));

app.post('/api/grades', requireAuth, asyncHandler(async (req, res) => {
  const g = gradeInput(req.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [studentRows] = await connection.execute('SELECT full_name FROM students WHERE student_id=?', [g.studentId]);
    if (!studentRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: `Không tìm thấy sinh viên ${g.studentId}.` });
    }
    const studentName = g.studentName || studentRows[0].full_name;
    const [existing] = await connection.execute(`
      SELECT grade_id FROM course_grades
      WHERE student_id=? AND course_code=? AND semester=? LIMIT 1
    `, [g.studentId, g.courseCode, g.semester]);

    if (existing.length) {
      await connection.execute(`
        UPDATE course_grades
        SET student_name=?, course_name=?, credits=?, attendance=?, midterm=?, final=?, grade_point=?, letter_grade=?
        WHERE grade_id=?
      `, [studentName, g.courseName, g.credits, g.attendance, g.midterm, g.finalScore,
        g.gradePoint, g.letterGrade, existing[0].grade_id]);
    } else {
      // total_score is GENERATED ALWAYS: DO NOT INSERT it.
      await connection.execute(`
        INSERT INTO course_grades
          (student_id, student_name, course_code, course_name, semester, credits,
           attendance, midterm, final, grade_point, letter_grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [g.studentId, studentName, g.courseCode, g.courseName, g.semester, g.credits,
        g.attendance, g.midterm, g.finalScore, g.gradePoint, g.letterGrade]);
    }

    const gpaHK = await updateSemesterGpa(connection, g.studentId, g.semester);
    await connection.commit();
    res.json({ success: true, message: 'Lưu điểm thành công.', studentId: g.studentId,
      courseCode: g.courseCode, semester: g.semester, totalScore: g.totalScore,
      gradePoint: g.gradePoint, letterGrade: g.letterGrade, gpaHK });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.post('/api/grades/import', requireAuth, asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : (req.body?.rows ?? req.body?.grades ?? req.body?.data);
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ success: false, message: 'Dữ liệu nhập điểm trống hoặc không đúng định dạng.', imported: 0, total: 0, errors: [] });
  }

  const connection = await pool.getConnection();
  const errors = [];
  const touched = new Map();
  let imported = 0;
  try {
    await connection.beginTransaction();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      try {
        const g = gradeInput(row);
        const [studentRows] = await connection.execute('SELECT full_name FROM students WHERE student_id=?', [g.studentId]);
        if (!studentRows.length) throw new Error(`Không tìm thấy sinh viên ${g.studentId} trong bảng students.`);
        const studentName = g.studentName || studentRows[0].full_name;
        const [existing] = await connection.execute(`
          SELECT grade_id FROM course_grades
          WHERE student_id=? AND course_code=? AND semester=? LIMIT 1
        `, [g.studentId, g.courseCode, g.semester]);

        if (existing.length) {
          await connection.execute(`
            UPDATE course_grades
            SET student_name=?, course_name=?, credits=?, attendance=?, midterm=?, final=?, grade_point=?, letter_grade=?
            WHERE grade_id=?
          `, [studentName, g.courseName, g.credits, g.attendance, g.midterm, g.finalScore,
            g.gradePoint, g.letterGrade, existing[0].grade_id]);
        } else {
          await connection.execute(`
            INSERT INTO course_grades
              (student_id, student_name, course_code, course_name, semester, credits,
               attendance, midterm, final, grade_point, letter_grade)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [g.studentId, studentName, g.courseCode, g.courseName, g.semester, g.credits,
            g.attendance, g.midterm, g.finalScore, g.gradePoint, g.letterGrade]);
        }
        touched.set(`${g.studentId}::${g.semester}`, { studentId: g.studentId, semester: g.semester });
        imported++;
      } catch (error) {
        errors.push({ row: i + 2, studentId: clean(row.student_id ?? row.studentId ?? row.id),
          courseCode: clean(row.course_code ?? row.courseCode), message: error.message });
      }
    }
    for (const item of touched.values()) await updateSemesterGpa(connection, item.studentId, item.semester);
    await connection.commit();
    res.json({ success: errors.length === 0, message: errors.length
      ? `Đã nhập ${imported}/${rows.length} dòng điểm; có ${errors.length} lỗi.`
      : `Đã nhập thành công ${imported} dòng điểm.`, imported, total: rows.length, errors });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Delete by actual primary key grade_id. URL param kept as :id for frontend compatibility.
app.delete('/api/grades/:id', requireAuth, asyncHandler(async (req, res) => {
  const gradeId = Number(req.params.id);
  if (!Number.isInteger(gradeId) || gradeId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã bản ghi điểm không hợp lệ.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT student_id, semester FROM course_grades WHERE grade_id=?', [gradeId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm.' });
    }
    await connection.execute('DELETE FROM course_grades WHERE grade_id=?', [gradeId]);
    await updateSemesterGpa(connection, rows[0].student_id, rows[0].semester);
    await connection.commit();
    res.json({ success: true, message: 'Xóa điểm thành công.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

// Legacy delete endpoint by student + course + semester.
app.delete('/api/grades', requireAuth, asyncHandler(async (req, res) => {
  const studentId = clean(req.body?.student_id ?? req.body?.studentId);
  const courseCode = clean(req.body?.course_code ?? req.body?.courseCode);
  const semester = clean(req.body?.semester);
  if (!studentId || !courseCode || !semester) {
    return res.status(400).json({ success: false, message: 'Thiếu MSSV, mã môn hoặc học kỳ.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'DELETE FROM course_grades WHERE student_id=? AND course_code=? AND semester=?',
      [studentId, courseCode, semester]
    );
    await updateSemesterGpa(connection, studentId, semester);
    await connection.commit();
    res.json({ success: true, message: result.affectedRows ? 'Xóa điểm thành công.' : 'Không tìm thấy điểm.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((err, req, res, next) => {
  console.error('API ERROR:', err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Dữ liệu bị trùng khóa.' });
  }
  if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({ success: false, message: 'Cấu trúc MySQL không khớp server.js.', detail: err.sqlMessage || err.message });
  }
  res.status(400).json({ success: false, message: err.message || 'Có lỗi xảy ra.' });
});

async function startServer() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    // Verify the schema uses grade_id as primary key, not id.
    const [columns] = await connection.query("SHOW COLUMNS FROM course_grades LIKE 'grade_id'");
    if (!columns.length) throw new Error('Thiếu cột course_grades.grade_id. Hãy kiểm tra schema SQL.');
    console.log(`MySQL connected: ${process.env.DB_NAME || 'eduadvisor'}`);
  } catch (error) {
    console.error('Không kết nối/kiểm tra được MySQL:', error.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }

  const server = app.listen(PORT, () => console.log(`EduAdvisor đang chạy tại http://localhost:${PORT}`));
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') console.error(`Cổng ${PORT} đang được sử dụng. Hãy dừng server cũ.`);
    else console.error('Lỗi khởi động server:', error);
    process.exit(1);
  });
}

startServer();
