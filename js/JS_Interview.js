// ================= NAVIGATION =================
function showSection(sectionId) {
  document.getElementById('registrationSection').classList.add('hidden');
  document.getElementById('interviewerSection').classList.add('hidden');
  
  const section = document.getElementById(sectionId);
  if(section) section.classList.remove('hidden');
}

// ================= APPLICANT SUBMISSION =================
function handleApplicantSubmit() {
  const btn = document.getElementById('submitBtn');
  const originalText = btn.innerText;
  
  const form = document.getElementById('applicantForm');
  if(!form.name.value || !form.phone.value || !form.email.value) {
    alert("يرجى ملء كافة الحقول الأساسية (الاسم، الهاتف، الإيميل)");
    return;
  }

  btn.disabled = true;
  btn.innerText = "جاري الرفع والإرسال...";

  const formData = {
    name: form.name.value,
    phone: form.phone.value,
    email: form.email.value,
    position: form.position.value,
    experience: form.experience.value
  };

  const fileInput = document.getElementById('cvFile');
  const file = fileInput.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function(loadEvent) {
      const rawData = loadEvent.target.result.split(",")[1]; 
      const fileData = {
        data: rawData,
        name: file.name,
        mimeType: file.type
      };
      sendToGoogle(formData, fileData, btn, originalText);
    };
    reader.readAsDataURL(file);
  } else {
    sendToGoogle(formData, null, btn, originalText);
  }
}

function sendToGoogle(formData, fileData, btn, btnText) {
  google.script.run
    .withSuccessHandler((res) => {
      if(res.success){
        alert("✅ " + res.message);
        document.getElementById('applicantForm').reset();
      } else {
        alert("❌ حدث خطأ: " + res.message);
      }
      btn.disabled = false;
      btn.innerText = btnText;
    })
    .withFailureHandler((err) => {
      alert("Fatal Error: " + err);
      btn.disabled = false;
      btn.innerText = btnText;
    })
    .saveApplicantData(formData, fileData);
}

// ================= INTERVIEWER DASHBOARD =================
let allApplicantsCache = [];

function loadInterviewerDashboard() {
  showSection('interviewerSection');
  document.getElementById('evaluationFormCard').classList.add('hidden');
  document.getElementById('applicantsListCard').classList.remove('hidden');

  const tbody = document.getElementById('applicantsTableBody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4">جاري تحميل البيانات...</td></tr>';
  
  google.script.run
    .withSuccessHandler((data) => {
      allApplicantsCache = data;
      renderApplicants(data);
    })
    .getApplicantsList();
}

function renderApplicants(data) {
  const tbody = document.getElementById('applicantsTableBody');
  tbody.innerHTML = "";

  if(!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-gray-500 bg-gray-50">لا يوجد متقدمين.</td></tr>';
    return;
  }

  data.forEach(app => {
    let statusBadge = `<span class="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">${app.status}</span>`;
    
    if(app.status === 'Interviewed') statusBadge = `<span class="px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700">تمت المقابلة</span>`;
    else if(app.status === 'Hired') statusBadge = `<span class="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">🎉 تم التعيين</span>`;

    let recBadge = `<span class="text-gray-400">-</span>`;
    let scoreDisplay = `<span class="text-gray-400">-</span>`;
    let actionButtons = '';

    if (app.status === 'Hired') {
       scoreDisplay = `<span class="font-bold text-gray-800">${app.score}</span>`;
       recBadge = `<span class="text-gray-500 text-xs">تم التنفيذ</span>`;
       actionButtons = `<span class="text-green-600 font-bold text-sm">✓ موظف حالي</span>`;

    } else if(app.score !== "-" && app.score !== "") {
      scoreDisplay = `<span class="font-bold text-gray-800">${app.score}</span>`;
      
      if(app.recommendation === 'Hire') recBadge = `<span class="text-green-600 font-bold">✅ تعيين</span>`;
      else if(app.recommendation === 'Hold') recBadge = `<span class="text-yellow-600 font-bold">⏳ انتظار</span>`;
      else if(app.recommendation === 'Reject') recBadge = `<span class="text-red-600 font-bold">❌ رفض</span>`;

      actionButtons = `
        <div class="flex justify-center items-center gap-2">
          <button onclick="changeStatus('${app.id}', 'Hired')" title="تعيين رسمي" class="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition border border-green-200">
            ✅ تعيين
          </button>
          <button onclick="changeStatus('${app.id}', 'Rejected')" title="رفض نهائي" class="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition border border-red-200">
            ❌ رفض
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <button onclick="startEvaluation('${app.id}', '${app.name}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 shadow">
          بدء المقابلة
        </button>
      `;
    }

    const row = `
      <tr class="border-b hover:bg-gray-50 transition group">
        <td class="px-4 py-3">
          <div class="font-bold text-gray-800">${app.name}</div>
          <div class="text-xs text-gray-500">${app.position}</div>
        </td>
        <td class="px-4 py-3 text-center">${statusBadge}</td>
        <td class="px-4 py-3 text-center text-lg">${scoreDisplay}</td>
        <td class="px-4 py-3 text-center">${recBadge}</td>
        <td class="px-4 py-3 text-center">
          ${actionButtons}
        </td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

function changeStatus(id, newStatus) {
  let confirmMsg = newStatus === 'Hired' 
    ? "هل أنت متأكد من تعيين هذا الموظف؟" 
    : "هل أنت متأكد من رفض هذا المتقدم؟";
    
  if(!confirm(confirmMsg)) return;

  google.script.run
    .withSuccessHandler((res) => {
      if(res.success) {
        alert(newStatus === 'Hired' ? "🎉 تم التعيين بنجاح!" : "تم تحديث الحالة إلى مرفوض.");
        loadInterviewerDashboard();
      } else {
        alert("خطأ: " + res.message);
      }
    })
    .updateApplicantStatus(id, newStatus);
}

function filterApplicants() {
  const query = document.getElementById('searchApp').value.toLowerCase();
  const filtered = allApplicantsCache.filter(app => 
    String(app.name).toLowerCase().includes(query) || 
    String(app.position).toLowerCase().includes(query)
  );
  renderApplicants(filtered);
}

// ================= EVALUATION LOGIC =================
function startEvaluation(id, name) {
  document.getElementById('applicantsListCard').classList.add('hidden');
  document.getElementById('evaluationFormCard').classList.remove('hidden');
  
  document.getElementById('evalApplicantId').value = id;
  document.getElementById('evalApplicantName').innerText = name;
  
  document.getElementById('starEvalForm').reset();
  document.getElementById('displayTotal').innerText = "0";
}

function closeEvaluation() {
  document.getElementById('evaluationFormCard').classList.add('hidden');
  document.getElementById('applicantsListCard').classList.remove('hidden');
}

function calcWeightedTotal() {
  const weights = {
    1: 10,
    2: 20,
    3: 15,
    4: 35,
    5: 20
  };

  let totalScore = 0;

  for (let i = 1; i <= 5; i++) {
    const input = document.getElementById('crit_' + i);
    const resDisplay = document.getElementById('res_' + i);
    
    let val = parseFloat(input.value);
    
    if (isNaN(val) || input.value === "") {
      val = 0;
      resDisplay.innerText = "0%";
    } else {
      if (val > 5) { val = 5; input.value = 5; }
      if (val < 1) { val = 1; input.value = 1; }

      let weightedVal = (val / 5) * weights[i];
      resDisplay.innerText = weightedVal.toFixed(1) + "%";
      totalScore += weightedVal;
    }
  }

  const totalEl = document.getElementById('displayTotal');
  totalEl.innerText = totalScore.toFixed(1) + "%";

  totalEl.className = "text-4xl font-bold tracking-wider";
  if(totalScore >= 80) totalEl.classList.add("text-green-400");
  else if(totalScore >= 60) totalEl.classList.add("text-yellow-400");
  else totalEl.classList.add("text-red-400");
}

function submitEvaluation(e) {
  e.preventDefault(); 
  
  const totalText = document.getElementById('displayTotal').innerText;
  if(totalText === "0.0%" || totalText === "0%") {
    alert("⚠️ يرجى إدخال درجات التقييم في جميع المعايير الخمسة.");
    return;
  }

  if(!confirm("هل أنت متأكد من حفظ التقييم؟\nالنتيجة النهائية: " + totalText)) return;

  const evalData = {
    applicantId: document.getElementById('evalApplicantId').value,
    
    s_notes: document.getElementById('s_notes').value,
    t_notes: document.getElementById('t_notes').value,
    a_notes: document.getElementById('a_notes').value,
    r_notes: document.getElementById('r_notes').value,
    
    score_other: document.getElementById('crit_1').value || 0,
    score_soft: document.getElementById('crit_2').value || 0,
    score_computer: document.getElementById('crit_3').value || 0,
    score_know: document.getElementById('crit_4').value || 0,
    score_ability: document.getElementById('crit_5').value || 0,
    
    total_percent: totalText,
    recommendation: document.getElementById('recommendation').value
  };

  google.script.run
    .withSuccessHandler((res) => {
      if(res.success) {
        alert("✅ تم حفظ التقييم بنجاح!");
        closeEvaluation();
        loadInterviewerDashboard(); 
      } else {
        alert("❌ خطأ: " + res.message);
      }
    })
    .saveEvaluationResult(evalData);
}
