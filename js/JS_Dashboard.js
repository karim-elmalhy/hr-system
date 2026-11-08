// ============================================================
// 🌍 المتغيرات العالمية للداشبورد
// ============================================================
let allData = [];
let chartInstances = {};

// ============================================================
// 1️⃣ التحميل الأولي (Data Loading)
// ============================================================
function loadData() {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.remove('hidden');
  
  const userDept = localStorage.getItem('currentUserDept'); 
  console.log("جاري تحميل البيانات للقسم:", userDept || "الكل (Admin)");

  google.script.run
    .withSuccessHandler(processData)
    .withFailureHandler(onLoadError)
    .getEmployeesDataForUser(userDept);
}

function onLoadError(error) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('hidden');
  alert("❌ خطأ في الاتصال: " + error.message);
}


// ============================================================
// 2️⃣ معالجة البيانات (Data Processing) - (النسخة الآمنة ✅)
// ============================================================
function processData(response) {
  console.log("📥 البيانات الخام الواصلة:", response);

  // --- 🛡️ شبكة الأمان: تجاهل بيانات الإعدادات إذا وصلت بالخطأ ---
  if (response && response.appName) {
      console.warn("⚠️ تم استلام بيانات الإعدادات في معالج الموظفين. تم التجاهل بنجاح.");
      return; // توقف هنا ولا تكمل حتى لا يحدث Crash
  }
  // -----------------------------------------------------------

  // 1. استخراج المصفوفة (Array) بذكاء
  let actualArray = [];

  if (Array.isArray(response)) {
      // الحالة 1: البيانات وصلت كمصفوفة مباشرة
      actualArray = response;
  } else if (response && typeof response === 'object') {
      // الحالة 2: البيانات مغلفة داخل كائن (مثل {result: [...]} أو {data: [...]})
      if (Array.isArray(response.result)) {
          actualArray = response.result;
      } else if (Array.isArray(response.data)) {
          actualArray = response.data;
      }
  }

  // 2. التحقق من أن لدينا مصفوفة قبل البدء
  const loader = document.getElementById('loader');
  
  if (!Array.isArray(actualArray) || actualArray.length === 0) {
    allData = [];
    if (typeof renderTable === 'function') renderTable([]);
    if (loader) loader.classList.add('hidden');
    ["kpi-total", "kpi-permanent", "kpi-seasonal", "pay-total", "pay-avg", "pay-net",
     "adv-active", "adv-active-rate", "adv-top-dept", "adv-top-dept-count", "adv-average-age", "adv-data-quality"]
      .forEach(id => updateText(id, "—"));
    const status = document.getElementById('advanced-data-status');
    if (status) {
      status.textContent = "لا توجد سجلات موظفين؛ تحقق من اتصال قاعدة البيانات أو صلاحية الحساب";
      status.className = "inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-2 text-amber-800 bg-amber-50 border border-amber-200";
    }
    console.warn("⚠️ لم تصل سجلات موظفين صالحة إلى لوحة القيادة.");
    return;
  }

  try {
    // Normalize bilingual and legacy column names without dropping source fields.
    const pick = (emp, keys) => {
      for (const key of keys) {
        const value = emp[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return "";
    };

    allData = actualArray.map((source) => {
      const emp = {
        ...source,
        EmployeeCode: pick(source, ["EmployeeCode", "EmployeeCode / كود الموظف"]),
        FingerprintID: pick(source, ["FingerprintID", "FingerprintID / رقم البصمة"]),
        FullName_AR: pick(source, ["FullName_AR", "FullName_AR / الاسم بالعربية", "FullName / الاسم"]),
        NationalID: pick(source, ["NationalID", "NationalID / الرقم القومي"]),
        Gender: pick(source, ["Gender", "Gender / النوع", "النوع"]),
        BranchName: pick(source, ["BranchName", "BranchName / الفرع", "Branch / الفرع"]),
        DepartmentName: pick(source, ["DepartmentName", "DepartmentName / الإدارة", "DepartmentName / الادارة", "Department / الإدارة", "Section", "Section / القسم"]),
        Status: pick(source, ["Status", "Status / حالة الموظف (بالعمل/منتهي)"]),
        Is_Seasonal: pick(source, ["Is_Seasonal", "Is_Seasonal / عمالة موسمية؟"]),
        EmploymentType: pick(source, ["EmploymentType", "EmploymentType / نوع التوظيف (دائم/موسمي)"]),
        ContractType: pick(source, ["ContractType", "ContractType / نوع العقد"]),
        GrossSalary: pick(source, ["GrossSalary", "GrossSalary / إجمالي"]),
        NetSalary: pick(source, ["NetSalary", "NetSalary / صافي"]),
        Age_Years: pick(source, ["Age_Years", "Age_Years / العمر"]),
        HireDate: pick(source, ["HireDate", "HireDate / تاريخ التعيين"]),
        ExitDate: pick(source, ["ExitDate", "ExitDate / تاريخ ترك العمل"]),
        HealthCertificateExpiryDate: pick(source, ["HealthCertificateExpiryDate", "HealthCertificateExpiryDate / تاريخ انتهاء الشهادة الصحية"])
      };

      const statusTxt = String(emp.Status || "").toLowerCase().trim();
      const isActive = ["بالعمل", "على رأس العمل", "نشط", "نشطة", "active"].some(value => statusTxt.includes(value));
      const seasonalRaw = String(emp.Is_Seasonal || "").toLowerCase().trim();
      const employmentRaw = String(emp.EmploymentType || emp.ContractType || "").toLowerCase().trim();
      const isSeasonal = ["yes", "نعم", "true", "1"].includes(seasonalRaw) ||
        employmentRaw.includes("seasonal") || employmentRaw.includes("موسمي");

      return {
        ...emp,
        _isActive: isActive,
        _isSeasonal: isSeasonal,
        _isPermanent: !isSeasonal,
        _derivedType: isSeasonal ? "Seasonal" : "Permanent"
      };
    });

    populateFilters();
    renderDashboard();

    if (typeof initTurnoverDates === 'function') initTurnoverDates();
    if (typeof populateTurnoverFilters === 'function') populateTurnoverFilters();
    if (typeof calcTurnover === 'function') calcTurnover();

    if (typeof checkAlerts === 'function') checkAlerts();
    if (typeof renderTable === 'function') renderTable(allData);

    const status = document.getElementById('advanced-data-status');
    if (status) {
      status.textContent = `● تم تحميل ${allData.length.toLocaleString()} سجل موظف`;
      status.className = "inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-2 text-green-700 bg-green-50 border border-green-100";
    }
    if (loader) loader.classList.add('hidden');
  } catch (e) {
    console.error("❌ خطأ أثناء معالجة البيانات:", e);
    if (loader) loader.classList.add('hidden');
    const status = document.getElementById('advanced-data-status');
    if (status) {
      status.textContent = "تعذر تجهيز بيانات لوحة القيادة";
      status.className = "inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-2 text-red-700 bg-red-50 border border-red-100";
    }
  }
}

// ============================================================
// 3️⃣ دوال الداشبورد (Rendering Dashboard)
// ============================================================
function renderDashboard() {
  const fBranch = document.getElementById('filter-branch').value;
  const fDept = document.getElementById('filter-dept').value;
  const fSeasonal = document.getElementById('filter-seasonal').value;
  const fStatus = document.getElementById('filter-status').value;

  // 1. الفلترة
  const filtered = allData.filter(d => {
    return (!fBranch || d.BranchName === fBranch) &&
           (!fDept || d.DepartmentName === fDept) &&
           (!fSeasonal || d._derivedType === fSeasonal) &&
           (!fStatus || d.Status === fStatus);
  });

  // 2. تحديث بطاقات KPI
  updateText('kpi-total', filtered.length);
  updateText('kpi-permanent', filtered.filter(d => d._isPermanent).length);
  updateText('kpi-seasonal', filtered.filter(d => d._isSeasonal).length);
  
  const knownStatus = filtered.filter(d => String(d.Status || "").trim() !== "");
  const leftEmpsCount = knownStatus.filter(d => !d._isActive).length;
  const rate = knownStatus.length ? ((leftEmpsCount / knownStatus.length) * 100).toFixed(1) : 0;
  updateText('kpi-turnover', rate + "%");

  // لوحة القراءة التنفيذية الجديدة؛ تعتمد على نفس نتائج الفلترة الحالية.
  updateAdvancedInsights(filtered);

  // 3. التحليل المالي
  const activeOnly = filtered.filter(d => d._isActive); 
  let totalGross = 0, totalNet = 0, deptCost = {};
  let salariedCount = 0;
  
  activeOnly.forEach(emp => {
    let gross = parseFloat((emp.GrossSalary || "0").toString().replace(/,/g, '')) || 0;
    let net = parseFloat((emp.NetSalary || "0").toString().replace(/,/g, '')) || 0;
    
    totalGross += gross;
    totalNet += net;
    
    if (gross > 0) {
        salariedCount++;
    }
    
    let dName = emp.DepartmentName || "غير محدد";
    deptCost[dName] = (deptCost[dName] || 0) + gross;
  });

  updateText('pay-total', totalGross.toLocaleString());
  updateText('pay-net', totalNet.toLocaleString());
  updateText('pay-avg', salariedCount ? Math.round(totalGross / salariedCount).toLocaleString() : 0);
  
  drawChart('chartPayroll', 'bar', deptCost, 'الرواتب (Gross)', true);

  // 4. الرسوم البيانية الأخرى
  const countBy = (arr, key) => arr.reduce((acc, i) => { const v = i[key] ? i[key] : "غير محدد"; acc[v] = (acc[v] || 0) + 1; return acc;}, {});
  
  drawChart('chartDept', 'bar', countBy(filtered, 'DepartmentName'), 'عدد الموظفين');
  drawChart('chartBranch', 'bar', countBy(filtered, 'BranchName'), 'عدد الموظفين');
  drawChart('chartGender', 'doughnut', countBy(filtered, 'Gender'), 'النوع');

  let ages = {'20-30':0, '30-40':0, '40-50':0, '50+':0};
  filtered.forEach(d => {
    let a = parseInt(d.Age_Years);
    if(a > 0) { if(a < 30) ages['20-30']++; else if(a < 40) ages['30-40']++; else if(a < 50) ages['40-50']++; else ages['50+']++; }
  });
  drawChart('chartAge', 'bar', ages, 'الفئات العمرية');
}

function updateAdvancedInsights(filtered) {
  const total = filtered.length;
  const active = filtered.filter(d => d._isActive).length;
  const activeRate = total ? Math.round((active / total) * 100) : 0;
  const departments = {};
  filtered.forEach(emp => {
    const name = emp.DepartmentName || 'غير محدد';
    departments[name] = (departments[name] || 0) + 1;
  });
  const topDept = Object.entries(departments).sort((a, b) => b[1] - a[1])[0];
  const ages = filtered.map(emp => parseFloat(emp.Age_Years)).filter(age => age > 0 && age < 100);
  const averageAge = ages.length ? (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1) : '—';
  const complete = filtered.filter(emp => emp.FullName_AR && emp.DepartmentName && emp.BranchName && emp.Status).length;
  const quality = total ? Math.round((complete / total) * 100) : 0;

  updateText('adv-active', active.toLocaleString());
  updateText('adv-active-rate', `${activeRate}% من الإجمالي`);
  updateText('adv-top-dept', topDept ? topDept[0] : '—');
  updateText('adv-top-dept-count', topDept ? `${topDept[1].toLocaleString()} موظف` : 'لا توجد بيانات');
  updateText('adv-average-age', averageAge === '—' ? averageAge : `${averageAge} سنة`);
  updateText('adv-data-quality', `${quality}%`);

  const status = document.getElementById('advanced-data-status');
  if (status) {
    status.textContent = total ? `● ${total.toLocaleString()} سجل في العرض` : '● لا توجد بيانات للعرض';
    status.className = `inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-2 ${total ? 'text-green-700 bg-green-50 border border-green-100' : 'text-gray-600 bg-gray-100 border border-gray-200'}`;
  }
}

// ============================================================
// 4️⃣ دوال مساعدة (Charts & Filters)
// ============================================================
function updateText(id, t) { const el = document.getElementById(id); if(el) el.innerText = t; }

function populateFilters() {
  const branches = [...new Set(allData.map(d => d.BranchName))].filter(Boolean);
  const depts = [...new Set(allData.map(d => d.DepartmentName))].filter(Boolean);
  const statuses = [...new Set(allData.map(d => d.Status))].filter(Boolean);
  
  const fill = (id, list) => {
    const sel = document.getElementById(id); if(!sel) return;
    while(sel.options.length > 1) sel.remove(1);
    list.forEach(i => sel.innerHTML += `<option value="${i}">${i}</option>`);
  };
  fill('filter-branch', branches);
  fill('filter-dept', depts);
  fill('filter-status', statuses);
}

// ==========================================
// 🎨 رسم الشارتات
// ==========================================
function drawChart(id, type, data, lbl, isCurrency = false) {
    const ctx = document.getElementById(id);
    if(!ctx) return;
    
    if (chartInstances[id]) chartInstances[id].destroy();
    
    const baseColor = '#4f46e5'; // Fixed Modern SaaS brand color

    const hexToRgba = (hex, alpha) => {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    let backgroundColors;
    const dataCount = Object.keys(data).length;

    if (type === 'doughnut' || type === 'pie' || type === 'bar') {
        backgroundColors = generateGradedPalette(baseColor, dataCount);
    } else {
        backgroundColors = hexToRgba(baseColor, 0.5);
    }
    
    chartInstances[id] = new Chart(ctx, {
        type: type,
        data: { 
            labels: Object.keys(data), 
            datasets: [{ 
                label: lbl, 
                data: Object.values(data), 
                backgroundColor: backgroundColors, 
                borderColor: baseColor,            
                borderWidth: type === 'bar' ? 0 : 1, 
                borderRadius: 4,
                hoverOffset: 6
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    display: type !== 'bar',
                    position: 'bottom',
                    labels: { font: { family: 'Cairo' }, usePointStyle: true }
                },
                tooltip: {
                    titleFont: { family: 'Cairo' },
                    bodyFont: { family: 'Cairo' },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null || context.parsed !== null) {
                                let val = (type === 'doughnut' || type === 'pie') ? context.parsed : context.parsed.y;
                                label += isCurrency ? val.toLocaleString() : val;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: type === 'bar' ? { 
                y: { 
                    beginAtZero: true,
                    ticks: { callback: v => isCurrency ? v.toLocaleString() : v, font: { family: 'Arial' } },
                    grid: { color: '#f3f4f6' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { font: { family: 'Cairo' } }
                }
            } : { x: { display: false }, y: { display: false } }
        }
    });
}

function generateGradedPalette(baseColor, count) {
    let palette = [];
    if (count <= 1) return [baseColor];
    for (let i = 0; i < count; i++) {
        let factor = 0.4 - (i * (0.8 / (count - 1)));
        let adjustment = Math.round(factor * 255);
        palette.push(adjustColor(baseColor, adjustment));
    }
    return palette;
}

// ============================================================
// 5️⃣ قسم التنبيهات
// ============================================================
function checkAlerts() {
  const alertsList = document.getElementById('alert-list');
  const alertBadge = document.getElementById('alert-badge');
  if(!alertsList || !alertBadge) return;
  
  alertsList.innerHTML = '';
  let count = 0;
  const today = new Date();
  
  allData.filter(d => d._isActive).forEach(emp => {
    if(emp.HealthCertificateExpiryDate) {
      const expDate = parseSmartDate(emp.HealthCertificateExpiryDate);
      if(expDate) {
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        if(diffDays <= 30 && diffDays >= 0) {
          addAlert(`🏥 تنتهي قريباً: ${emp.FullName_AR}`, `الشهادة الصحية تنتهي خلال ${diffDays} يوم`, false);
          count++;
        } else if (diffDays < 0) {
          addAlert(`⚠️ شهادة منتهية: ${emp.FullName_AR}`, `انتهت منذ ${Math.abs(diffDays)} يوم`, true);
          count++;
        }
      }
    }
  });
  
  if(count > 0) {
    alertBadge.innerText = count;
    alertBadge.classList.remove('hidden');
  } else {
    alertsList.innerHTML = '<div class="p-4 text-center text-gray-400 text-xs">✅ لا توجد تنبيهات حالياً</div>';
    alertBadge.classList.add('hidden');
  }
}

function addAlert(title, desc, isCritical) {
  const list = document.getElementById('alert-list');
  const colorClass = isCritical ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100';
  const icon = isCritical ? '⚠️' : '⏳';
  
  list.innerHTML += `
    <div class="p-3 mb-2 rounded-lg border ${colorClass} flex items-start gap-2">
        <span class="text-lg">${icon}</span>
        <div>
            <div class="font-bold text-xs">${title}</div>
            <div class="text-[10px] opacity-80">${desc}</div>
        </div>
    </div>`;
}

// ============================================================
// 6️⃣ قسم معدل الدوران
// ============================================================
function parseSmartDate(dateStr) {
  if (!dateStr || dateStr === "-" || dateStr === "—") return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr === 'number') {
    const serialDate = new Date((dateStr - 25569) * 86400 * 1000);
    return isNaN(serialDate.getTime()) ? null : serialDate;
  }

  const str = String(dateStr).trim();
  // Google Sheets display dates in Egypt commonly use DD/MM/YYYY.
  const localMatch = str.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (localMatch) {
    const day = Number(localMatch[1]);
    const month = Number(localMatch[2]) - 1;
    const year = Number(localMatch[3]);
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === day) return parsed;
    return null;
  }

  const dStandard = new Date(str);
  return isNaN(dStandard.getTime()) ? null : dStandard;
}

function initTurnoverDates() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const s = document.getElementById('date-start');
  const e = document.getElementById('date-end');
  if(s) s.value = startOfYear.toISOString().split('T')[0];
  if(e) e.value = today.toISOString().split('T')[0];
}

function populateTurnoverFilters() {
  const fill = (id, list) => {
    const sel = document.getElementById(id);
    if(sel) {
      sel.innerHTML = `<option value="">الكل</option>`;
      [...new Set(list)].filter(Boolean).sort().forEach(i => sel.innerHTML += `<option value="${i}">${i}</option>`);
    }
  };
  fill('to-filter-branch', allData.map(d=>d.BranchName));
  fill('to-filter-dept', allData.map(d=>d.DepartmentName));
  fill('to-filter-type', allData.map(d=>d._derivedType));
}

function setPeriod(type) {
  const today = new Date();
  let start = new Date();
  
  if (type === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (type === 'year') start = new Date(today.getFullYear(), 0, 1);
  else if (type === 'all') start = new Date(2015, 0, 1);
  
  document.getElementById('date-start').value = start.toISOString().split('T')[0];
  document.getElementById('date-end').value = today.toISOString().split('T')[0];
  calcTurnover();
}

function calcTurnover() {
  if (!allData.length) return;

  const sEl = document.getElementById('date-start');
  const eEl = document.getElementById('date-end');
  if(!sEl || !eEl) return;

  const startDate = new Date(sEl.value);
  const endDate = new Date(eEl.value);
  endDate.setHours(23, 59, 59, 999);

  const fType = document.getElementById('to-filter-type').value;
  const fDept = document.getElementById('to-filter-dept').value;
  const fBranch = document.getElementById('to-filter-branch').value;

  let leaversCount = 0;
  let joinersCount = 0;
  let headcountStart = 0;
  let headcountEnd = 0;

  allData.forEach(emp => {
    if (fType && emp._derivedType !== fType) return;
    if (fDept && emp.DepartmentName !== fDept) return;
    if (fBranch && emp.BranchName !== fBranch) return;

    let hireDate = parseSmartDate(emp.HireDate);
    let exitDate = parseSmartDate(emp.ExitDate);

    // Missing hire dates stay unknown; never fabricate a start date for turnover calculations.

    if (hireDate && hireDate >= startDate && hireDate <= endDate) joinersCount++;

    if (exitDate && exitDate >= startDate && exitDate <= endDate) {
       const st = (emp.Status || "").toLowerCase();
       if (st.includes("منتهي") || st.includes("terminated") || st.includes("left") || st.includes("resigned")) {
           leaversCount++;
       }
    }

    const activeAtStart = hireDate && hireDate < startDate && (!exitDate || exitDate >= startDate);
    if (activeAtStart) headcountStart++;

    const activeAtEnd = hireDate && hireDate <= endDate && (!exitDate || exitDate > endDate);
    if (activeAtEnd) headcountEnd++;
  });

  const avgHeadcount = (headcountStart + headcountEnd) / 2;
  let rate = 0;
  if (avgHeadcount > 0) rate = (leaversCount / avgHeadcount) * 100;

  updateText('to-kpi-leavers', leaversCount);
  updateText('to-kpi-joiners', joinersCount);
  updateText('to-kpi-avg', Math.round(avgHeadcount));
  updateText('to-kpi-rate', rate.toFixed(1) + '%');
}
// ============================================================
// Theme controls removed: appearance is fixed by css/design-system.css.
