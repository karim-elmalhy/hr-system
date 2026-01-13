// ==========================================
// ⚖️ إدارة الجزاءات (Logic)
// ==========================================

document.addEventListener('DOMContentLoaded', initPenalties);

function initPenalties() {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    
    if (document.getElementById('rep_from')) {
        document.getElementById('rep_from').value = firstDay.toISOString().split('T')[0];
        document.getElementById('rep_to').value = date.toISOString().split('T')[0];
    }
    
    if (document.getElementById('violation_list')) {
        loadViolationTypes();
    }
}

// ==========================================
// 2. تحميل قائمة المخالفات
// ==========================================
function loadViolationTypes() {
    const dataList = document.getElementById('violation_list');
    if (!dataList) return;

    dataList.innerHTML = ''; 

    google.script.run.withSuccessHandler((rules) => {
        if (!rules || rules.length === 0) return;

        rules.forEach(rule => {
            if (rule[0]) {
                const opt = document.createElement('option');
                opt.value = rule[0];
                dataList.appendChild(opt);
            }
        });
    }).getPenaltyRules();
}

// ==========================================
// 3. التحقق الذكي (البصمة + المخالفة)
// ==========================================
function checkEmpAndViolation() {
    const fid = document.getElementById('p_fingerprint').value;
    const vType = document.getElementById('p_violation').value; 
    const infoLabel = document.getElementById('p_emp_info');
    const resultDiv = document.getElementById('calculation-result');
    const btn = document.getElementById('btn-save-penalty');

    infoLabel.innerText = '';

    if (!fid) return;

    if (fid && !vType) {
        if (typeof allData !== 'undefined') {
            const localEmp = allData.find(e => e.FingerprintID == fid || e.EmployeeCode == fid); 
            if (localEmp) {
                infoLabel.innerText = `✅ ${localEmp.FullName_AR}`;
                infoLabel.className = 'text-xs mt-1 h-4 text-green-600 font-bold';
            } else {
                infoLabel.innerText = `⚠️ جاري البحث...`;
                infoLabel.className = 'text-xs mt-1 h-4 text-orange-500';
            }
        }
        return; 
    }

    if (fid && vType) {
        infoLabel.innerText = '⏳ جاري الحساب...';
        btn.disabled = true;

        google.script.run.withSuccessHandler((res) => {
            if (!res.found) {
                infoLabel.innerText = '❌ ' + res.message;
                infoLabel.className = 'text-xs mt-1 h-4 text-red-600 font-bold';
                resultDiv.classList.add('hidden');
            } else {
                document.getElementById('p_empName').value = res.empName;
                document.getElementById('p_email').value = res.empEmail;
                document.getElementById('p_recurrence').value = res.recurrence;
        
                infoLabel.innerText = `✅ ${res.empName} - ${res.empDept}`;
                infoLabel.className = 'text-xs mt-1 h-4 text-green-600 font-bold';
        
                resultDiv.classList.remove('hidden');
        
                let recurrenceText = "المرة الأولى";
                if(res.recurrence == 2) recurrenceText = "المرة الثانية";
                if(res.recurrence == 3) recurrenceText = "المرة الثالثة";
                if(res.recurrence >= 4) recurrenceText = "المرة الرابعة أو أكثر";
        
                document.getElementById('disp_recurrence').innerText = recurrenceText;
                document.getElementById('p_penalty').value = res.suggestedPenalty;
        
                btn.disabled = false;
            }
        }).checkPenaltyStatus(fid, vType);
    }
}

// ==========================================
// 4. حفظ الجزاء وإرسال الإيميل
// ==========================================
function handlePenaltySubmit(e) {
    e.preventDefault();

    const empName = document.getElementById('p_empName').value;
    const penalty = document.getElementById('p_penalty').value;

    if(!empName || !penalty) {
        alert("تأكد من صحة البيانات وحساب الجزاء أولاً");
        return;
    }

    if(!confirm(`هل أنت متأكد من تسجيل الجزاء على:\n${empName}\nالجزاء: ${penalty}`)) return;

    const btn = document.getElementById('btn-save-penalty');
    const originalText = btn.innerText;
    btn.innerText = "⏳ جاري الإرسال...";
    btn.disabled = true;

    const formData = {
        p_fingerprint: document.getElementById('p_fingerprint').value,
        p_empName: document.getElementById('p_empName').value,
        p_email: document.getElementById('p_email').value,
        p_violation: document.getElementById('p_violation').value,
        p_penalty: document.getElementById('p_penalty').value,
        p_recurrence: document.getElementById('p_recurrence').value,
        p_notes: document.querySelector('textarea[name="p_notes"]').value
    };

    google.script.run.withSuccessHandler((res) => {
        alert(res.message);
        btn.innerText = originalText;
        btn.disabled = false;

        if (res.success) {
            document.getElementById('penaltyForm').reset();
            document.getElementById('calculation-result').classList.add('hidden');
            document.getElementById('p_emp_info').innerText = '';
            loadPenaltyReport();
        }
    }).submitPenalty(formData);
}

// ==========================================
// 5. تقرير الجزاءات (الجدول)
// ==========================================
function loadPenaltyReport() {
    const from = document.getElementById('rep_from').value;
    const to = document.getElementById('rep_to').value;
    const fid = document.getElementById('rep_fingerprint').value;
    const tbody = document.getElementById('reportTableBody');

    const currentUser = localStorage.getItem('currentUser'); 

    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">جاري التحميل...</td></tr>';

    google.script.run.withSuccessHandler((data) => {
        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">لا توجد بيانات مطابقة للصلاحيات</td></tr>';
            return;
        }

        data.forEach(row => {
            const d = new Date(row.date).toLocaleDateString('ar-EG');
            const tr = document.createElement('tr');
            tr.className = "hover:bg-red-50 transition border-b border-gray-100";
            tr.innerHTML = `
                <td class="p-3 text-gray-600">${d}</td>
                <td class="p-3 font-bold text-gray-800">${row.name}</td>
                <td class="p-3 text-red-600">${row.violation}</td>
                <td class="p-3 text-center"><span class="bg-gray-200 text-xs px-2 py-1 rounded">${row.count}</span></td>
                <td class="p-3 font-bold text-gray-800">${row.penalty}</td>
            `;
            tbody.appendChild(tr);
        });
    }).getPenaltyReportsData(from, to, fid, currentUser);
}
