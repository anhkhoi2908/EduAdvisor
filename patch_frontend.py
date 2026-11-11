from pathlib import Path
p=Path('/mnt/data/EduAdvisor_Complete/public/index.html')
s=p.read_text(encoding='utf-8')
# Replace demo auth functions while preserving all HTML/CSS structure.
start=s.index('    // Demo authentication only.')
end=s.index('    // 1. DATA MODEL', start)
new_auth='''    // Xác thực thật qua Node.js session; giao diện đăng nhập được giữ nguyên.
    async function handleLogin(event) {
      event.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const error = document.getElementById('login-error');
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Đăng nhập không thành công.');
        document.getElementById('login-screen').style.display = 'none';
        error.style.display = 'none';
        document.getElementById('login-password').value = '';
        await refreshFromServer();
        showToast('Đăng nhập thành công!');
      } catch (e) {
        error.textContent = e.message || 'Không kết nối được máy chủ.';
        error.style.display = 'block';
      }
    }
    async function logout() {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').style.display = 'none';
      students = []; selectedStudent = null; refreshAllViews();
      showToast('Bạn đã đăng xuất.');
    }
    function openPasswordModal() {
      document.getElementById('password-error').style.display = 'none';
      document.getElementById('password-modal').classList.add('active');
    }
    function closePasswordModal() {
      document.getElementById('password-modal').classList.remove('active');
      document.querySelector('#password-modal form').reset();
    }
    async function handleChangePassword(event) {
      event.preventDefault();
      const current = document.getElementById('current-password').value;
      const next = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      const error = document.getElementById('password-error');
      const fail = message => { error.textContent = message; error.style.display = 'block'; };
      if (next.length < 8) return fail('Mật khẩu mới phải có ít nhất 8 ký tự.');
      if (next === current) return fail('Mật khẩu mới phải khác mật khẩu hiện tại.');
      if (next !== confirm) return fail('Mật khẩu xác nhận không khớp.');
      try {
        const response = await fetch('/api/auth/change-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: current, newPassword: next })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không đổi được mật khẩu.');
        closePasswordModal(); showToast(data.message || 'Đổi mật khẩu thành công.');
      } catch (e) { fail(e.message); }
    }

'''
s=s[:start]+new_auth+s[end:]
# Replace local-only load/save with DB backed load and queued sync.
old='''    function loadSavedStudents() {
      try {
        const raw = localStorage.getItem('eduAdvisorStudents');
        if (!raw) return initialStudents.map(s => structuredClone(s));
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return initialStudents.map(s => structuredClone(s));
        return parsed;
      } catch (error) {
        console.warn('Không đọc được dữ liệu đã lưu, dùng dữ liệu mẫu.', error);
        return initialStudents.map(s => structuredClone(s));
      }
    }

    let students = loadSavedStudents();
    let selectedStudent = students[0] || null;
    let distributionChart = null;
    let timelineChart = null;

    function saveStudents() {
      try {
        localStorage.setItem('eduAdvisorStudents', JSON.stringify(students));
        return true;
      } catch (error) {
        showToast('Không thể lưu dữ liệu. Hãy kiểm tra dung lượng/trình duyệt.');
        return false;
      }
    }
'''
new='''    // Du lieu that duoc nap tu MySQL sau khi dang nhap.
    let students = [];
    let selectedStudent = null;
    let distributionChart = null;
    let timelineChart = null;
    let syncQueue = Promise.resolve();

    async function refreshFromServer() {
      const response = await fetch('/api/students');
      if (response.status === 401) {
        document.getElementById('login-screen').style.display = 'flex';
        students = []; selectedStudent = null; refreshAllViews();
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Không tải được dữ liệu sinh viên.');
      students = Array.isArray(data) ? data : [];
      students.forEach(s => {
        if (!Array.isArray(s.reasons)) s.reasons = [];
        if (!Array.isArray(s.advisingHistory)) s.advisingHistory = [];
        if (!Array.isArray(s.courses)) s.courses = [];
      });
      selectedStudent = students[0] || null;
      refreshAllViews();
    }

    function saveStudents() {
      // Luu tam tren trinh duyet va dong bo UPSERT xuong MySQL; khong xoa du lieu DB.
      try { localStorage.setItem('eduAdvisorStudents', JSON.stringify(students)); } catch (e) {}
      const payload = students.map(s => ({
        id: s.id, name: s.name, classCode: s.classCode, email: s.email, phone: s.phone,
        cpa: s.cpa, gpaHK: s.gpaHK, prevGpa: s.prevGpa,
        accumulatedCredits: s.accumulatedCredits, debtCredits: s.debtCredits,
        failedCoursesCount: s.failedCoursesCount, lastAdvising: s.lastAdvising,
        advisingNote: s.advisingNote, advisingHistory: s.advisingHistory || []
      }));
      syncQueue = syncQueue.then(async () => {
        const response = await fetch('/api/students/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: payload })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không đồng bộ được dữ liệu.');
      }).catch(error => showToast(error.message || 'Lỗi đồng bộ MySQL.'));
      return true;
    }
'''
if old not in s: raise SystemExit('Could not find local storage block')
s=s.replace(old,new)
# Make deletion persistent in MySQL.
s=s.replace('''    function deleteStudent(studentId) {
      const s = students.find(item => String(item.id) === String(studentId));''','''    async function deleteStudent(studentId) {
      const s = students.find(item => String(item.id) === String(studentId));''')
s=s.replace('''      if (!confirmed) return;
      students = students.filter(item => String(item.id) !== String(studentId));''','''      if (!confirmed) return;
      try {
        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không xóa được sinh viên trên máy chủ.');
      } catch (e) { showToast(e.message); return; }
      students = students.filter(item => String(item.id) !== String(studentId));''')
s=s.replace("showToast('Đã xóa sinh viên khỏi dữ liệu demo.');","showToast('Đã xóa sinh viên khỏi hệ thống.');")
# Persist advising in dedicated normalized table as well as student JSON history.
needle='''      if (student) {
        student.advisingHistory.unshift({
          date: new Date().toLocaleDateString('vi-VN'),'''
replacement='''      if (student) {
        try {
          const response = await fetch('/api/advising', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId, content, commitment: action, channel: 'Trực tiếp' })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Không lưu được lịch sử tư vấn.');
        } catch (e) { showToast(e.message); return; }
        student.advisingHistory.unshift({
          date: new Date().toLocaleDateString('vi-VN'),'''
# function isn't async currently
s=s.replace('''    function handleModalSaveAdvising(e) {
      e.preventDefault();''','''    async function handleModalSaveAdvising(e) {
      e.preventDefault();''')
if needle not in s: print('warning advising needle absent')
else: s=s.replace(needle,replacement)
# Replace DOM bootstrap with async auth check and DB load; preserve chart initialisation.
start=s.index("    // DOM Ready Bootstrap")
end=s.index("  </script>", start)
boot='''    // DOM Ready Bootstrap - giao dien goc duoc giu nguyen, du lieu nap tu MySQL.
    window.addEventListener('DOMContentLoaded', async () => {
      lucide.createIcons();
      initCharts();
      try {
        const authResponse = await fetch('/api/auth/me');
        const auth = await authResponse.json();
        if (auth.authenticated) {
          document.getElementById('login-screen').style.display = 'none';
          await refreshFromServer();
        } else {
          document.getElementById('login-screen').style.display = 'flex';
          students = []; selectedStudent = null;
          refreshAllViews();
        }
      } catch (error) {
        document.getElementById('login-screen').style.display = 'flex';
        showToast('Không kết nối được máy chủ EduAdvisor. Hãy kiểm tra backend.');
      }
      const alertCount = students.filter(s => s.reasons && s.reasons.length).length;
      const badge = document.getElementById('sidebar-alert-badge');
      if (badge) badge.textContent = alertCount;
    });
'''
s=s[:start]+boot+s[end:]
p.write_text(s,encoding='utf-8')
