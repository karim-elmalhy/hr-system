// ============================================================
// 🌍 متغيرات عامة (Global Variables)
// ============================================================
let currentFilteredData = []; // البيانات المعروضة حالياً (بعد الفلترة)
let currentPage = 1;          // رقم الصفحة الحالية
const rowsPerPage = 50;       // عدد الموظفين في كل صفحة

// ==========================================
// 📊 1. رسم جدول الموظفين (مع Pagination)
// ==========================================
function renderTable(data) {
  // حفظ البيانات الحالية
  currentFilteredData = data || [];
  
  // حساب عدد الصفحات
  const totalPages = Math.ceil(currentFilteredData.length / rowsPerPage);
  
  // التأكد من صحة رقم الصفحة
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (totalPages === 0) currentPage = 1;

  // تحديد بداية ونهاية البيانات للصفحة الحالية
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const paginatedItems = currentFilteredData.slice(start, end);

  // تجهيز الجدول
  const tbody = document.getElementById('employeesTableBody');
  const role = localStorage.getItem('currentUserRole');
  const permsStr = localStorage.getItem('userPermissions');
  let canEdit = false;

  if (role === 'Admin') {
      canEdit = true;
  } else if (permsStr) {
      try {
          const perms = JSON.parse(permsStr);
          canEdit = perms.emp_edit === true;
      } catch(e) { canEdit = false; }
  }

  const thActions = document.getElementById('th-actions');
  if (thActions) thActions.style.display = canEdit ? '' : 'none';

  // ملء القوائم المنسدلة (الفلاتر) لأول مرة فقط
  if (data && data.length > 0 && document.getElementById('sel-branch').options.length <= 1) {
       populateEmployeesFilters(data); // نمرر البيانات الأصلية كاملة هنا
  }

  if (!tbody) return;
  tbody.innerHTML = ''; 

  // حالة لا توجد نتائج
  if (paginatedItems.length === 0) {
      const colSpan = canEdit ? 11 : 10; 
      tbody.innerHTML = `<tr><td colspan="${colSpan}" class="p-8 text-center text-gray-400">لا توجد بيانات مطابقة</td></tr>`;
      updatePaginationControls(0);
      if(typeof updateCount === 'function') updateCount(0);
      return;
  }

  // رسم الصفوف
  paginatedItems.forEach(emp => {
      // التحقق من الحالة والموسمية باستخدام الحقول المحسوبة من الباكيند (_isActive, _isSeasonal)
      // أو استخدام النصوص التقليدية للدعم
      const isActive = emp._isActive || (emp.Status || "").toString().includes("بالعمل") || (emp.Status || "").toString().toLowerCase().includes("active");
      const statusBadge = isActive ? 
          `<span class="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold inline-block">نشط</span>` : 
          `<span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold inline-block">منتهي</span>`;

      const isSeasonal = emp._isSeasonal || (emp.Is_Seasonal === "Yes" || emp.Is_Seasonal === "نعم");
      const seasonalIcon = isSeasonal ? `<span class="text-orange-500 font-bold" title="موسمي">✓ نعم</span>` : `<span class="text-gray-300">لا</span>`;

      let actionsHtml = '';
      if (canEdit) {
          actionsHtml = `
            <td class="p-3 text-center border-l bg-gray-50">
                <div class="flex justify-center gap-2">
                    <button onclick="openProfile('${emp.EmployeeCode}')" class="text-gray-500 hover:text-blue-600 transition" title="عرض الملف">👤</button>
                    <button onclick="openEditModal('${emp.EmployeeCode}')" class="text-gray-500 hover:text-virginia-600 transition" title="تعديل">✏️</button>
                </div>
            </td>
          `;
      }

      const tr = document.createElement('tr');
      tr.className = "hover:bg-gray-50 transition group border-b border-gray-100";
      
      tr.innerHTML = `
          <td class="p-3 font-mono font-bold text-virginia-600">${emp.EmployeeCode || '-'}</td>
          <td class="p-3 font-bold text-gray-800 whitespace-normal min-w-[150px]">${emp.FullName_AR || 'بدون اسم'}</td>
          <td class="p-3 text-center">${statusBadge}</td>
          <td class="p-3 text-gray-600">${emp.BranchName || '-'}</td>
          <td class="p-3 text-gray-600">${emp.DepartmentName || '-'}</td>
          <td class="p-3 font-medium text-gray-700">${emp.JobTitle_AR || '-'}</td>
          <td class="p-3 text-xs">${emp.EmploymentType || '-'}</td>
          <td class="p-3 text-center">${seasonalIcon}</td>
          <td class="p-3 font-mono text-xs text-gray-500">${emp.Mobile1 || '-'}</td>
          <td class="p-3 font-mono text-xs text-gray-500">${emp.NationalID || '-'}</td>
          ${actionsHtml} `;
      tbody.appendChild(tr);
  });

  if(typeof updateCount === 'function') updateCount(currentFilteredData.length);
  updatePaginationControls(totalPages);
}

// ==========================================
// ⏩ دوال التحكم في الصفحات (Pagination Controls)
// ==========================================
function updatePaginationControls(totalPages) {
    const controls = document.getElementById('pagination-controls');
    const pageInfo = document.getElementById('page-info');
    
    if (!controls || !pageInfo) return; // تأكد أنك أضفت كود HTML للأزرار في صفحة Employees.html

    if (totalPages <= 1) {
        controls.style.display = 'none';
    } else {
        controls.style.display = 'flex';
        pageInfo.innerText = `صفحة ${currentPage} من ${totalPages}`;
    }
}

function changePage(direction) {
    currentPage += direction;
    renderTable(currentFilteredData); 
    // تمرير الشاشة لأعلى الجدول
    const tableContainer = document.querySelector('.overflow-x-auto');
    if(tableContainer) tableContainer.scrollTop = 0;
}

function updateCount(num) {
    const el = document.getElementById('table-count');
    if(el) el.innerText = `العدد: ${num}`;
}

// ==========================================
// 🔍 2. تعبئة القوائم المنسدلة (Filters Population)
// ==========================================
function populateEmployeesFilters(data) {
    // نستخدم Set لاستخراج القيم الفريدة فقط
    const branches = [...new Set(data.map(d => d.BranchName))].filter(Boolean).sort();
    const depts = [...new Set(data.map(d => d.DepartmentName))].filter(Boolean).sort();
    const types = [...new Set(data.map(d => d.EmploymentType))].filter(Boolean).sort();
    const statuses = [...new Set(data.map(d => d.Status))].filter(Boolean).sort();

    const fill = (id, list, lbl) => {
        const el = document.getElementById(id);
        if (el && (el.options.length <= 1 || el.value === "")) {
            el.innerHTML = `<option value="">${lbl}</option>`;
            list.forEach(i => el.innerHTML += `<option value="${i}">${i}</option>`);
        }
    };

    fill('sel-branch', branches, 'كل الفروع');
    fill('sel-dept', depts, 'كل الإدارات');
    fill('sel-type', types, 'كل الأنواع');
    fill('sel-status', statuses, 'كل الحالات');
}

// ==========================================
// ⚡ 3. تنفيذ الفلترة (Apply Filters)
// ==========================================
function applyEmployeesFilters() {
    currentPage = 1; // 🔥 إعادة تعيين للصفحة الأولى عند كل بحث جديد

    const search = document.getElementById('search-input').value.toLowerCase();
    const branch = document.getElementById('sel-branch').value;
    const dept = document.getElementById('sel-dept').value;
    const type = document.getElementById('sel-type').value;
    const status = document.getElementById('sel-status').value;

    // التأكد من وجود البيانات الأصلية (allData يجب أن تكون معرفة في النطاق العام)
    if (typeof allData === 'undefined') return;

    const filtered = allData.filter(emp => {
        const matchSearch = !search || 
                            (emp.FullName_AR && emp.FullName_AR.toLowerCase().includes(search)) ||
                            (emp.EmployeeCode && emp.EmployeeCode.toString().includes(search)) ||
                            (emp.NationalID && emp.NationalID.toString().includes(search));

        const matchBranch = !branch || emp.BranchName === branch;
        const matchDept = !dept || emp.DepartmentName === dept;
        const matchType = !type || emp.EmploymentType === type;
        const matchStatus = !status || emp.Status === status;

        return matchSearch && matchBranch && matchDept && matchType && matchStatus;
    });

    renderTable(filtered); // هذا سيقوم برسم الـ 50 نتيجة الأولى فقط
}

// ==========================================
// 🛠️ 4. إدارة مودال الإضافة/التعديل (Modals)
// ==========================================
function openAddModal() {
    document.getElementById('employeeForm').reset();
    document.getElementById('form-mode').value = 'add';
    document.getElementById('modal-title').innerText = 'إضافة موظف جديد';
    document.getElementById('modal-icon').innerText = '➕';
    
    const codeInp = document.querySelector('input[name="EmployeeCode"]');
    if(codeInp) codeInp.readOnly = false;

    document.getElementById('modal').classList.remove('hidden');
}

function openEditModal(code) {
    const searchCode = String(code).trim();
    // البحث في البيانات الأصلية لضمان وجود البيانات حتى لو كانت في صفحة أخرى
    const emp = allData.find(e => String(e.EmployeeCode).trim() === searchCode);
    
    if (!emp) { alert("⚠️ لم يتم العثور على البيانات"); return; }

    document.getElementById('employeeForm').reset();
    document.getElementById('form-mode').value = 'edit';
    document.getElementById('original-code').value = emp.EmployeeCode;
    document.getElementById('modal-title').innerText = 'تعديل بيانات: ' + emp.FullName_AR;
    document.getElementById('modal-icon').innerText = '✏️';

    const form = document.getElementById('employeeForm');
    Array.from(form.elements).forEach(el => {
        if (el.name && emp[el.name] !== undefined) {
            if (el.type === 'checkbox') {
                el.checked = (emp[el.name] === true || emp[el.name] === "TRUE" || emp[el.name] === "Yes");
            } else if (el.type === 'date') {
                 let d = emp[el.name];
                 // محاولة تحويل التاريخ إذا كان نصاً أو رقماً
                 if (d) {
                     let dateObj = new Date(d);
                     if (!isNaN(dateObj)) {
                         el.value = dateObj.toISOString().split('T')[0];
                     }
                 }
            } else {
                el.value = emp[el.name];
            }
        }
    });

    const codeInp = document.querySelector('input[name="EmployeeCode"]');
    if(codeInp) codeInp.readOnly = true;

    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const dataObj = {};
  
  formData.forEach((value, key) => { dataObj[key] = value; });

  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => { dataObj[cb.name] = cb.checked ? "TRUE" : "FALSE"; });
  
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  btn.innerText = "جاري الحفظ...";
  btn.disabled = true;

  google.script.run
    .withSuccessHandler((res) => {
       btn.innerText = originalText;
       btn.disabled = false;
       if(res.success) {
           alert("✅ تم الحفظ بنجاح!");
           closeModal();
           // إعادة تحميل البيانات من السيرفر لتحديث الجدول والكاش
           if(typeof loadData === 'function') loadData(); 
       } else {
           alert("❌ خطأ: " + res.message);
       }
    })
    .saveEmployeeData(dataObj); // تأكد من وجود دالة saveEmployeeData في الباكيند
}

// ==========================================
// 👤 5. البروفايل (Profile)
// ==========================================
function openProfile(code) {
    const emp = allData.find(e => String(e.EmployeeCode) === String(code));
    if (!emp) return;

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerText = val || "-";
    };

    document.getElementById('profileModal').classList.remove('hidden');
    
    setTxt('card-name', emp.FullName_AR);
    setTxt('card-job', emp.JobTitle_AR);
    
    // استخدام الحقل المحسوب _isActive إذا وجد
    const isActive = emp._isActive || (emp.Status || "").toString().includes("بالعمل");
    const statusEl = document.getElementById('card-status');
    if(statusEl) {
        statusEl.innerText = emp.Status || '-';
        statusEl.className = isActive ? "px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700" : "px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700";
    }

    setTxt('card-code', emp.EmployeeCode);
    setTxt('card-dept', emp.DepartmentName);
    setTxt('card-branch', emp.BranchName);
    setTxt('card-mobile1', emp.Mobile1);
    setTxt('card-mobile2', emp.Mobile2);
    setTxt('card-email', emp.Email);
    setTxt('card-nid', emp.NationalID);
    setTxt('card-birth', emp.BirthDate ? new Date(emp.BirthDate).toLocaleDateString('ar-EG') : "-");
    setTxt('card-age', emp.Age_Years);
    setTxt('card-marital', emp.MaritalStatus);
    setTxt('card-military', emp.MilitaryStatus);
    setTxt('card-address', emp.Address);
    setTxt('card-gov', emp.Gov);
    setTxt('card-manager', emp.ManagerName || emp.DirectManager);
    setTxt('card-contract', emp.ContractType);
    setTxt('card-contract-end', emp.ContractEndDate ? new Date(emp.ContractEndDate).toLocaleDateString('ar-EG') : "-");
    setTxt('card-gross', emp.GrossSalary ? Number(emp.GrossSalary).toLocaleString() : "0");
    setTxt('card-net', emp.NetSalary ? Number(emp.NetSalary).toLocaleString() : "0");
    setTxt('card-insurance', emp.SocialInsuranceNumber || emp.InsuranceNumber);
    setTxt('card-bank', emp.BankName);
    setTxt('card-health', emp.HealthCertificateExpiryDate ? new Date(emp.HealthCertificateExpiryDate).toLocaleDateString('ar-EG') : "-");

    const docsDiv = document.getElementById('card-docs');
    if(docsDiv) {
        docsDiv.innerHTML = '';
        const docFields = [
            {k: 'Doc_Birth', l: 'شهادة الميلاد'},
            {k: 'Doc_Edu', l: 'المؤهل'},
            {k: 'Doc_ID', l: 'البطاقة'},
            {k: 'Doc_Military', l: 'التجنيد'},
            {k: 'Doc_WorkPermit', l: 'كعب العمل'},
            {k: 'Doc_Criminal', l: 'فيش جنائي'},
            {k: 'Doc_Photos', l: 'صور شخصية'}
        ];
        docFields.forEach(doc => {
            const isCheck = (emp[doc.k] === true || emp[doc.k] === 'TRUE' || emp[doc.k] === 'Yes');
            const color = isCheck ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-400 border-red-100 line-through decoration-red-400';
            docsDiv.innerHTML += `<span class="px-2 py-1 rounded text-xs border ${color}">${doc.l}</span>`;
        });
    }
}

function closeProfile() {
    document.getElementById('profileModal').classList.add('hidden');
}

// ============================================================
// 📥 6. تصدير Excel
// ============================================================
function exportToExcel() {
    // نستخدم currentFilteredData (النتائج المفلترة كاملة) وليس الصفحة الحالية فقط
    if (!currentFilteredData || currentFilteredData.length === 0) {
        alert("لا توجد بيانات لتصديرها!");
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert("خطأ: مكتبة الإكسيل غير محملة.");
        return;
    }
    
    const exportData = currentFilteredData.map(emp => ({
        "كود الموظف": emp.EmployeeCode,
        "الاسم": emp.FullName_AR,
        "الفرع": emp.BranchName,
        "الإدارة": emp.DepartmentName,
        "المسمى الوظيفي": emp.JobTitle_AR,
        "الحالة": emp.Status,
        "نوع التوظيف": emp.EmploymentType,
        "موسمي": emp.Is_Seasonal,
        "موبايل": emp.Mobile1,
        "الرقم القومي": emp.NationalID,
        "تاريخ التعيين": emp.HireDate ? new Date(emp.HireDate).toLocaleDateString('ar-EG') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الموظفين");
    XLSX.writeFile(workbook, "Employees_Data.xlsx");
}

function downloadProfilePDF() {
    const element = document.querySelector('#profileModal > div'); 
    const empName = document.getElementById('card-name').innerText || 'Employee';
    
    const opt = {
      margin:       [10, 10, 10, 10], 
      filename:     `CV_${empName}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true }, 
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const btns = element.querySelectorAll('button');
    btns.forEach(b => b.style.display = 'none');

    html2pdf().set(opt).from(element).save().then(() => {
        btns.forEach(b => b.style.display = 'block');
    });
}

// ============================================================
// ⚡ المراقب الذكي (Observer)
// ============================================================
const viewObserver = new MutationObserver((mutations) => {
    const tableBody = document.getElementById("employeesTableBody");

    // التحقق من وجود الجدول، فراغه، ووجود البيانات في allData
    if (tableBody && tableBody.children.length === 0 && typeof allData !== 'undefined' && allData.length > 0) {
        
        console.log("⚡ تم اكتشاف صفحة الموظفين - جاري تعبئة البيانات...");
        
        // تشغيل الفلاتر والرسم (سيقوم برسم الصفحة الأولى فقط)
        applyEmployeesFilters();
        
        // ملء قوائم الفلاتر إذا كانت فارغة
        if (document.getElementById('sel-branch') && document.getElementById('sel-branch').options.length <= 1) {
             populateEmployeesFilters(allData);
        }
    }
});

setTimeout(() => {
    const targetNode = document.body; 
    viewObserver.observe(targetNode, { childList: true, subtree: true });
}, 2000);
