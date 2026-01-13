// ==============================================================================
// 1. إعدادات الثيم والمظهر
// ==============================================================================
const ThemeConfig = {
    defaultColor: '#4f46e5',
    defaultGradient: true 
};

// دالة تطبيق الثيم
function applyTheme(hexColor, isGradient) {
    const root = document.documentElement;
    
    root.style.setProperty('--theme-color', hexColor);
    root.style.setProperty('--color-primary-50',  adjustColor(hexColor, 180));
    root.style.setProperty('--color-primary-100', adjustColor(hexColor, 150));
    root.style.setProperty('--color-primary-200', adjustColor(hexColor, 100));
    root.style.setProperty('--color-primary-300', adjustColor(hexColor, 50));
    root.style.setProperty('--color-primary-400', adjustColor(hexColor, 25));
    root.style.setProperty('--color-primary-500', hexColor);
    root.style.setProperty('--color-primary-600', adjustColor(hexColor, -20));
    root.style.setProperty('--color-primary-700', adjustColor(hexColor, -40));
    root.style.setProperty('--color-primary-800', adjustColor(hexColor, -60));
    root.style.setProperty('--color-primary-900', adjustColor(hexColor, -80));

    const sidebar = document.getElementById('main-sidebar');
    if (sidebar) {
        if (isGradient) {
            sidebar.style.background = `linear-gradient(180deg, ${hexColor} 0%, #111827 100%)`;
        } else {
            sidebar.style.background = hexColor;
        }
    }

    setTimeout(() => {
        if (typeof updateAllChartsColors === "function") {
            updateAllChartsColors(hexColor);
        }
    }, 500);
}

function updateAllChartsColors(hexColor) {
    if (typeof Chart === 'undefined') return;

    Chart.helpers.each(Chart.instances, function (chart) {
        const ctx = chart.ctx;
        const type = chart.config.type;
        const dataCount = chart.data.datasets[0].data.length;
        
        const palette = generateGradedPalette(hexColor, dataCount);

        chart.data.datasets.forEach((dataset) => {
            if (['pie', 'doughnut', 'polarArea'].includes(type)) {
                dataset.backgroundColor = palette;
                dataset.borderColor = '#ffffff';
                dataset.borderWidth = 2;
            } else if (type === 'bar') {
                dataset.backgroundColor = palette;
                dataset.borderColor = palette.map(color => adjustColor(color, -20));
                dataset.borderWidth = 1;
            } else {
                let chartGradient = ctx.createLinearGradient(0, 0, 0, 400);
                chartGradient.addColorStop(0, hexToRgba(hexColor, 0.4));
                chartGradient.addColorStop(1, hexToRgba(hexColor, 0.0));
                
                dataset.backgroundColor = chartGradient;
                dataset.borderColor = hexColor;
                dataset.pointBackgroundColor = hexColor;
                dataset.fill = true;
            }
        });
        chart.update();
    });
}

function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => 
        ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

function syncSettingsInputs(color, isGradient, appName) {
    const colorInput = document.getElementById('setting-theme-color');
    const gradientInput = document.getElementById('setting-sidebar-gradient');
    const previewCircle = document.getElementById('color-preview-circle');
    const colorCode = document.getElementById('color-code-display');
    const nameInput = document.getElementById('setting-app-name');

    if (colorInput) {
        colorInput.value = color;
        colorInput.setAttribute('value', color);
    }
    if (gradientInput) gradientInput.checked = isGradient;
    if (previewCircle) previewCircle.style.backgroundColor = color;
    if (colorCode) colorCode.innerText = color;
    if (nameInput && appName) nameInput.value = appName;
}

// ==============================================================================
// 2. التهيئة والتحميل (Init)
// ==============================================================================

(function initImmediateTheme() {
    const savedColor = localStorage.getItem('themeColor') || ThemeConfig.defaultColor;
    const savedGradient = localStorage.getItem('sidebarGradient') === 'true';
    applyTheme(savedColor, savedGradient);
})();

function initSettingsPage() {
    console.log("🚀 فتح صفحة الإعدادات...");

    let localColor = localStorage.getItem('themeColor') || ThemeConfig.defaultColor;
    let localGradient = localStorage.getItem('sidebarGradient') === 'true';
    
    setTimeout(() => {
        syncSettingsInputs(localColor, localGradient);
    }, 100);

    applyTheme(localColor, localGradient);
    if(typeof loadMyProfile === 'function') loadMyProfile();

    const role = localStorage.getItem('currentUserRole');
    if (role && role.trim().toLowerCase() === 'admin') {
        const adminSection = document.getElementById('admin-sections-container');
        if (adminSection) adminSection.classList.remove('hidden');
        if(typeof loadUsersList === 'function') loadUsersList();

        google.script.run.withSuccessHandler(settings => {
            console.log("📥 بيانات السيرفر:", settings);
            
            const serverColor = settings.themeColor || localColor;
            const serverGradient = (String(settings.sidebarGradient) === 'true');
            const serverAppName = settings.appName || "";

            localStorage.setItem('themeColor', serverColor);
            localStorage.setItem('sidebarGradient', serverGradient);

            syncSettingsInputs(serverColor, serverGradient, serverAppName);
            applyTheme(serverColor, serverGradient);

            if (serverAppName) {
                document.title = serverAppName;
                const sidebarTitle = document.querySelector('aside h1');
                if(sidebarTitle) sidebarTitle.innerText = serverAppName;
            }
        }).getSystemSettings();
    }
}

// ==============================================================================
// 3. الحفظ (Save)
// ==============================================================================

function saveGeneralSettings() {
    const btn = document.getElementById('btn-save-general');
    const originalText = btn.innerHTML;
    
    const nameInput = document.getElementById('setting-app-name');
    const colorInput = document.getElementById('setting-theme-color');
    const gradientInput = document.getElementById('setting-sidebar-gradient');

    if (!nameInput || !colorInput) return;

    const newAppName = nameInput.value;
    const newColor = colorInput.value;
    const newGradient = gradientInput.checked;

    btn.innerHTML = '⏳ جاري الحفظ...';
    btn.disabled = true;

    localStorage.setItem('themeColor', newColor);
    localStorage.setItem('sidebarGradient', newGradient);
    applyTheme(newColor, newGradient);

    const settingsToSend = {
        appName: newAppName,
        themeColor: newColor,
        sidebarGradient: newGradient
    };

    google.script.run
        .withSuccessHandler((res) => {
            alert("✅ " + res.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            document.title = newAppName;
            const sidebarTitle = document.querySelector('aside h1');
            if(sidebarTitle) sidebarTitle.innerText = newAppName;
        })
        .withFailureHandler((err) => {
            alert("❌ خطأ في الحفظ: " + err);
            btn.innerHTML = originalText;
            btn.disabled = false;
        })
        .saveGeneralSettings(settingsToSend);
}
// ==============================================================================
// 4. إدارة الملف الشخصي (Profile Management)
// ==============================================================================

function loadMyProfile() {
    // جلب البيانات من LocalStorage للعرض الفوري
    document.getElementById('profile-name').innerText = localStorage.getItem('currentUserName') || 'مستخدم';
    document.getElementById('profile-role').innerText = localStorage.getItem('currentUserRole') || '...';
    document.getElementById('profile-username').innerText = localStorage.getItem('currentUser') || '...';
    document.getElementById('profile-code').innerText = localStorage.getItem('empCode') || '-';
}

function togglePassVisibility(id) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}

function changeMyPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-change-pass');
    const oldPass = document.getElementById('old-pass').value;
    const newPass = document.getElementById('new-pass').value;
    const confirmPass = document.getElementById('confirm-pass').value;

    if (newPass !== confirmPass) {
        alert("❌ كلمة المرور الجديدة غير متطابقة!");
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = "جاري التحديث...";
    btn.disabled = true;

    google.script.run
        .withSuccessHandler((res) => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (res.success) {
                alert("✅ تم تغيير كلمة المرور بنجاح. يرجى إعادة الدخول.");
                logout(); // تسجيل خروج للأمان
            } else {
                alert("❌ خطأ: " + res.message);
            }
        })
        .changeUserPassword(oldPass, newPass);
}

// ==============================================================================
// 5. إدارة المستخدمين (User Management)
// ==============================================================================

// تحميل قائمة المستخدمين
function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    google.script.run
        .withSuccessHandler(renderUsersTable)
        .withFailureHandler(err => {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 p-4">حدث خطأ: ${err}</td></tr>`;
        })
        .getSystemUsers();
}

// رسم الجدول
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = "";

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">لا يوجد مستخدمين حالياً</td></tr>`;
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 transition border-b border-gray-100";
        
        let roleBadge = user.role === 'Admin' 
            ? '<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">Admin</span>' 
            : '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Manager</span>';

        row.innerHTML = `
            <td class="p-4 font-bold text-gray-800">${user.username}</td>
            <td class="p-4">${roleBadge}</td>
            <td class="p-4 font-mono text-xs text-gray-500">${user.empCode || '-'}</td>
            <td class="p-4 text-sm">${user.department || 'الكل'}</td>
            <td class="p-4 flex gap-2 justify-end">
                <button onclick='openUserModal(${JSON.stringify(user)})' class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition" title="تعديل">
                    ✏️
                </button>
                <button onclick="deleteUser('${user.username}')" class="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition" title="حذف">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ==============================================================================
// 6. التعامل مع نافذة المستخدم (Add/Edit Modal)
// ==============================================================================

let isEditingUser = false;
let editingUsername = "";

function openUserModal(user = null) {
    const modal = document.getElementById('user-modal');
    modal.classList.remove('hidden');
    
    // إعادة تعيين الحقول
    document.getElementById('u_username').value = "";
    document.getElementById('u_password').value = "";
    document.getElementById('u_role').value = "Manager";
    document.getElementById('u_empCode').value = "";
    document.getElementById('u_dept').value = "";
    
    // تصفير الصلاحيات
    const perms = ['dashboard', 'emp_view', 'emp_edit', 'penalties', 'settings', 'interview', 'leaves', 'docs'];
    perms.forEach(p => document.getElementById('perm_'+p).checked = false);

    if (user) {
        // وضع التعديل (Edit Mode)
        isEditingUser = true;
        editingUsername = user.username;
        document.getElementById('modal-title').innerText = "تعديل بيانات المستخدم";
        document.getElementById('btn-save-user').innerText = "حفظ التعديلات";
        
        document.getElementById('u_username').value = user.username;
        document.getElementById('u_username').disabled = true; // منع تغيير اسم المستخدم
        document.getElementById('u_password').placeholder = "(اتركه فارغاً لعدم التغيير)";
        document.getElementById('u_role').value = user.role;
        document.getElementById('u_empCode').value = user.empCode || "";
        document.getElementById('u_dept').value = user.department || "";

        if (user.permissions) {
            perms.forEach(p => {
                if (user.permissions[p]) document.getElementById('perm_'+p).checked = true;
            });
        }
    } else {
        // وضع الإضافة (Add Mode)
        isEditingUser = false;
        editingUsername = "";
        document.getElementById('modal-title').innerText = "إضافة مستخدم جديد";
        document.getElementById('btn-save-user').innerText = "إنشاء المستخدم";
        document.getElementById('u_username').disabled = false;
        document.getElementById('u_password').placeholder = "";
    }
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

function saveUser() {
    const btn = document.getElementById('btn-save-user');
    const username = document.getElementById('u_username').value.trim();
    const password = document.getElementById('u_password').value.trim();
    
    if (!username) { alert("يرجى كتابة اسم المستخدم"); return; }
    if (!isEditingUser && !password) { alert("يرجى كتابة كلمة المرور"); return; }

    const userData = {
        username: username,
        password: password, // سيرسل فارغاً في التعديل إذا لم يتغير
        role: document.getElementById('u_role').value,
        empCode: document.getElementById('u_empCode').value,
        department: document.getElementById('u_dept').value,
        permissions: {
            dashboard: document.getElementById('perm_dashboard').checked,
            emp_view: document.getElementById('perm_emp_view').checked,
            emp_edit: document.getElementById('perm_emp_edit').checked,
            penalties: document.getElementById('perm_penalties').checked,
            settings: document.getElementById('perm_settings').checked,
            interview: document.getElementById('perm_interview').checked,
            leaves: document.getElementById('perm_leaves').checked,
            docs: document.getElementById('perm_docs').checked
        }
    };

    const originalText = btn.innerText;
    btn.innerText = "جاري الحفظ...";
    btn.disabled = true;

    google.script.run
        .withSuccessHandler(res => {
            btn.innerText = originalText;
            btn.disabled = false;
            if (res.success) {
                closeUserModal();
                loadUsersList(); // تحديث الجدول
                alert(isEditingUser ? "✅ تم تعديل البيانات" : "✅ تم إضافة المستخدم");
            } else {
                alert("❌ خطأ: " + res.message);
            }
        })
        .saveSystemUser(userData, isEditingUser);
}

function deleteUser(username) {
    if (!confirm("هل أنت متأكد من حذف المستخدم: " + username + "؟")) return;

    google.script.run
        .withSuccessHandler(res => {
            if (res.success) {
                loadUsersList();
                alert("🗑️ تم الحذف بنجاح");
            } else {
                alert("❌ فشل الحذف: " + res.message);
            }
        })
        .deleteSystemUser(username);
}
