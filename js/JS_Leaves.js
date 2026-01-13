// متغير لتخزين البيانات محلياً للبحث
let allLeavesData = [];

// دالة البدء (تستدعى عند فتح الصفحة)
function initLeavesManagement() {
    console.log("Initializing Leaves Management...");
    loadLeaveRequests();
}

// تحميل البيانات من السيرفر
function loadLeaveRequests() {
    const tbody = document.getElementById('leaves-table-body');
    const currentUser = localStorage.getItem('currentUser');

    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center"><div class="animate-spin h-8 w-8 border-4 border-virginia-600 rounded-full border-t-transparent mx-auto mb-2"></div><span class="text-gray-500 font-bold">جاري جلب البيانات...</span></td></tr>`;

    google.script.run
        .withSuccessHandler(renderLeavesTable)
        .withFailureHandler(err => {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold">خطأ: ${err.message}</td></tr>`;
        })
        .getAllLeaveRequests(currentUser);
}

// رسم الجدول
function renderLeavesTable(data) {
    allLeavesData = data; 
    const tbody = document.getElementById('leaves-table-body');
    tbody.innerHTML = "";

    let stats = { pending: 0, approved: 0, rejected: 0, today: 0 };
    const todayStr = new Date().toISOString().slice(0, 10);

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-400 flex flex-col items-center"><span class="text-4xl mb-2">📭</span>لا توجد طلبات مسجلة حالياً</td></tr>`;
        updateStats(stats);
        return;
    }

    data.forEach(req => {
        if (req.status === 'قيد المراجعة') stats.pending++;
        if (req.status === 'مقبول') stats.approved++;
        if (req.status === 'مرفوض') stats.rejected++;
        
        if (req.status === 'مقبول') {
            if (todayStr >= req.start && todayStr <= req.end) stats.today++;
        }

        const start = new Date(req.start);
        const end = new Date(req.end);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        let statusHtml = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">⏳ قيد المراجعة</span>`;
        let actionButtons = `
            <div class="flex justify-center gap-2">
                <button onclick="openLeaveModal('${req.id}', 'approve')" class="bg-green-50 text-green-600 hover:bg-green-100 p-2 rounded-lg transition" title="قبول">✅</button>
                <button onclick="openLeaveModal('${req.id}', 'reject')" class="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded-lg transition" title="رفض">❌</button>
            </div>
        `;

        if (req.status === 'مقبول') {
            statusHtml = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ مقبول</span>`;
            actionButtons = `<span class="text-gray-400 text-xs font-bold">تم القبول</span>`;
        } else if (req.status === 'مرفوض') {
            statusHtml = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ مرفوض</span>`;
            actionButtons = `<span class="text-gray-400 text-xs font-bold">تم الرفض</span>`;
        }

        const row = `
            <tr class="hover:bg-gray-50 transition border-b border-gray-50 group">
                <td class="p-4">
                    <div class="font-bold text-gray-800">${req.empName}</div>
                    <div class="text-xs text-gray-500 font-mono">${req.empCode}</div>
                </td>
                <td class="p-4">
                    <span class="text-virginia-700 font-bold text-xs bg-virginia-50 px-2 py-1 rounded">${req.type}</span>
                </td>
                <td class="p-4 text-xs text-gray-600">
                    <div class="flex items-center gap-1"><span class="text-gray-400">من:</span> ${req.start}</div>
                    <div class="flex items-center gap-1"><span class="text-gray-400">إلى:</span> ${req.end}</div>
                </td>
                <td class="p-4">
                    <span class="font-bold text-gray-700">${diffDays}</span> <span class="text-xs text-gray-500">يوم</span>
                </td>
                <td class="p-4 text-xs text-gray-500 max-w-xs truncate" title="${req.reason || ''}">
                    ${req.reason || '-'}
                </td>
                <td class="p-4">${statusHtml}</td>
                <td class="p-4 text-center">${actionButtons}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    updateStats(stats);
}

function updateStats(stats) {
    document.getElementById('stat-pending').innerText = stats.pending;
    document.getElementById('stat-approved').innerText = stats.approved;
    document.getElementById('stat-rejected').innerText = stats.rejected;
    document.getElementById('stat-today').innerText = stats.today;
}

function filterLeavesTable() {
    const input = document.getElementById('leave-search');
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById('leaves-table-body');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const nameCol = rows[i].getElementsByTagName("td")[0];
        if (nameCol) {
            const txtValue = nameCol.textContent || nameCol.innerText;
            rows[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
        }
    }
}

function openLeaveModal(id, action) {
    document.getElementById('modal-req-id').value = id;
    document.getElementById('modal-action').value = action;
    document.getElementById('modal-note').value = ""; 

    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    const icon = document.getElementById('modal-icon');
    const btn = document.getElementById('btn-modal-confirm');

    if(action === 'approve') {
        title.innerText = "قبول طلب الإجازة";
        title.className = "text-xl font-bold text-green-700 mb-1";
        desc.innerText = "هل أنت متأكد من قبول هذا الطلب؟";
        icon.innerText = "✅";
        icon.className = "w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl animate-bounce-slow";
        btn.className = "flex-1 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 font-bold transition shadow-lg shadow-green-200";
        btn.innerText = "نعم، قبول";
    } else {
        title.innerText = "رفض طلب الإجازة";
        title.className = "text-xl font-bold text-red-700 mb-1";
        desc.innerText = "هل أنت متأكد من رفض هذا الطلب؟";
        icon.innerText = "❌";
        icon.className = "w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl animate-pulse";
        btn.className = "flex-1 bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 font-bold transition shadow-lg shadow-red-200";
        btn.innerText = "نعم، رفض";
    }

    document.getElementById('leave-action-modal').classList.remove('hidden');
}

function closeLeaveModal() {
    document.getElementById('leave-action-modal').classList.add('hidden');
}

function confirmLeaveAction() {
    const reqId = document.getElementById('modal-req-id').value;
    const action = document.getElementById('modal-action').value; // يجب أن تكون 'approve' أو 'reject'
    const note = document.getElementById('modal-note').value;
    const btn = document.getElementById('btn-modal-confirm');

    // تغيير نص الزر ليدل على التحميل
    const originalText = btn.innerText;
    btn.innerText = "جاري التنفيذ...";
    btn.disabled = true;

    // تحديد الدالة التي سنستدعيها بناءً على الإجراء
    // لاحظ: نستخدم الدوال الفرعية التي أنشأناها
    const serverFunction = action === 'approve' ? 'approveLeaveRequest' : 'rejectLeaveRequest';

    google.script.run
        .withSuccessHandler((res) => {
            // إعادة الزر لحالته
            btn.innerText = originalText;
            btn.disabled = false;
            
            // إغلاق المودال
            closeActionModal();

            if (res.success) {
                alert("✅ " + res.message);
                loadLeaveRequests(); // تحديث الجدول
            } else {
                alert("⚠️ " + res.message);
            }
        })
        .withFailureHandler((err) => {
            // مهم جداً: إعادة الزر وإغلاق المودال حتى لو فشل السيرفر
            btn.innerText = originalText;
            btn.disabled = false;
            closeActionModal();
            alert("❌ خطأ في الاتصال: " + err.message);
        })
        [serverFunction](reqId, note); // استدعاء الدالة ديناميكياً
}
// ==========================================
// 🚪 دوال فتح وإغلاق المودال (النوافذ المنبثقة)
// ==========================================

// دالة لفتح مودال التأكيد (الموافقة/الرفض)
// ==========================================
// 🚪 إدارة المودال (متطابق مع Leaves.html)
// ==========================================

function openActionModal(reqId, action) {
    // 1. تعبئة البيانات المخفية
    document.getElementById('modal-req-id').value = reqId;
    document.getElementById('modal-action').value = action;
    document.getElementById('modal-note').value = ""; 

    // 2. تخصيص النصوص والألوان
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    const icon = document.getElementById('modal-icon');
    const btn = document.getElementById('btn-modal-confirm');

    if (action === 'approve') {
        title.innerText = "تأكيد الموافقة";
        title.className = "text-xl font-bold text-green-700 mb-1";
        desc.innerText = "سيتم خصم الأيام من رصيد الموظف (إن وجد).";
        icon.innerText = "✅";
        icon.parentElement.className = "w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl border border-green-100";
        btn.innerText = "نعم، موافقة";
        btn.className = "flex-1 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 font-bold transition shadow-lg";
    } else {
        title.innerText = "تأكيد الرفض";
        title.className = "text-xl font-bold text-red-700 mb-1";
        desc.innerText = "لن يتم خصم أي رصيد.";
        icon.innerText = "❌";
        icon.parentElement.className = "w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl border border-red-100";
        btn.innerText = "نعم، رفض الطلب";
        btn.className = "flex-1 bg-red-600 text-white py-2.5 rounded-xl hover:bg-red-700 font-bold transition shadow-lg";
    }

    // 3. إظهار المودال (بالاسم الصحيح الموجود في HTML)
    const modal = document.getElementById('leave-action-modal'); // 👈 التعديل هنا
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // لضمان التوسط في الشاشة
    }
}

// دالة الإغلاق (باسمين لضمان عمل زر الإلغاء وزر الحفظ)
function closeLeaveModal() {
    const modal = document.getElementById('leave-action-modal'); // 👈 التعديل هنا
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// دالة بديلة بنفس الاسم في حالة استدعائها من مكان آخر
function closeActionModal() {
    closeLeaveModal();
}
