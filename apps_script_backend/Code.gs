function doGet() {
  // Simple health check / info response for the API deployment
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "ok",
      message: "Apps Script API - use POST to call actions",
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  // kept for compatibility if any server-side includes are used in an Apps Script HTML project
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    return "";
  }
}

// JSON API dispatcher: accept POST { action: 'name', params: { ... } }
function doPost(e) {
  function sendJSON(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  try {
    var body = {};
    if (
      e &&
      e.postData &&
      e.postData.type &&
      e.postData.type.indexOf("json") !== -1
    ) {
      body = JSON.parse(e.postData.contents || "{}");
    } else if (e && e.parameter && e.parameter.action) {
      // fallback to form-encoded
      body.action = e.parameter.action;
      body.params = e.parameter;
    } else {
      body = {};
    }

    var action = body.action;
    var params = body.params || {};

    if (!action)
      return sendJSON({ success: false, error: "No action specified" });

    // Whitelist of allowed backend functions
    var allowed = [
      "getEmployeesData",
      "getEmployeesDataForUser",
      "getEmployeeEmail",
      "getEmployeeBalance",
      "updateEmployeeSheetBalance",
      "addEmployee",
      "updateEmployee",
      "getPenaltyRules",
      "checkPenaltyStatus",
      "submitPenalty",
      "getPenaltyReportsData",
      "getAllLeaveRequests",
      "getEmployeeRequests",
      "askAI",
      "getSystemUsers",
      "getSystemSettings",
    ];

    if (allowed.indexOf(action) === -1 || typeof this[action] !== "function") {
      return sendJSON({
        success: false,
        error: "Action not allowed: " + action,
      });
    }

    // Call the function. If params is an array, spread it; otherwise pass as single arg.
    var result;
    if (Array.isArray(params)) {
      result = this[action].apply(null, params);
    } else {
      result = this[action].apply(null, [params]);
    }

    return sendJSON({ success: true, action: action, result: result });
  } catch (err) {
    return sendJSON({
      success: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

const SHEET_NAME = "Employees_DB";

// === 1. دالة getColumnKey (خريطة الأسماء) ===
function getColumnKey(headerName) {
  switch (headerName) {
    case "Section / القسم":
      return "Section";
    case "JobTitle_AR / المسمى بالعربية":
      return "JobTitle_AR";
    case "JobFamily / المسار الوظيفي":
      return "JobFamily";
    case "Grade / المستوى الوظيفي":
      return "Grade";
    case "ManagerName / المدير المباشر":
      return "ManagerName";
    case "ايميل المدير المباشر":
      return "ManagerEmail";

    // --- التوظيف والحالة ---
    case "EmploymentType / نوع التوظيف (دائم/موسمي)":
      return "EmploymentType";
    case "WorkType / طبيعة الدوام (كامل/جزئي)":
      return "WorkType";
    case "HireDate / تاريخ التعيين":
      return "HireDate";
    case "ContractType / نوع العقد":
      return "ContractType";
    case "Status / حالة الموظف (بالعمل/منتهي)":
      return "Status"; // العمود المهم
    case "ExitDate / تاريخ ترك العمل":
      return "ExitDate";
    case "ExitReason / سبب ترك العمل":
      return "ExitReason";
    case "Is_Seasonal / عمالة موسمية؟":
      return "Is_Seasonal";
    case "New Hire":
      return "NewHire";

    // --- المواعيد ---
    case "WorkSchedule / نظام العمل":
      return "WorkSchedule";
    case "من الساعة":
      return "FromTime";
    case "إلى الساعه":
      return "ToTime";
    case "WorkingHoursPerDay / ساعات العمل باليوم":
      return "WorkingHoursPerDay";
    case "WorkingDaysPerWeek / أيام العمل بالأسبوع":
      return "WorkingDaysPerWeek";

    // --- الرواتب والماليات ---
    case "BasicSalary / أساسي":
      return "BasicSalary";
    case "GrossSalary / إجمالي":
      return "GrossSalary";
    case "NetSalary / صافي":
      return "NetSalary";
    case "البنك التابع له":
      return "BankName";
    case "رقم الحساب البنكى":
      return "BankAccount";

    // --- التأمينات ---
    case "SocialInsuranceNumber / رقم التأمينات":
      return "SocialInsuranceNumber";
    case "InsuranceJobTitle / المسمى التأميني":
      return "InsuranceJobTitle";
    case "InsuranceStartDate / تاريخ بداية التأمين":
      return "InsuranceStartDate";
    case "تاريخ نهاية التأمين الإجتماعى":
      return "InsuranceEndDate";
    case "InsuranceSalary / أجر التأمين":
      return "InsuranceSalary";

    // --- الصحة ---
    case "HealthCertificateNumber / رقم الشهادة الصحية":
      return "HealthCertificateNumber";
    case "HealthCertificateIssueDate / تاريخ إصدار الشهادة الصحية":
      return "HealthCertificateIssueDate";
    case "HealthCertificateExpiryDate / تاريخ انتهاء الشهادة الصحية":
      return "HealthCertificateExpiryDate";
    case "MedicalInsurance / تأمين طبي (Yes/No)":
      return "MedicalInsurance";

    // --- التعليم والتجنيد ---
    case "EducationLevel / المؤهل الدراسي":
      return "EducationLevel";
    case "Specialization / التخصص":
      return "Specialization";
    case "MilitaryStatus / الموقف من التجنيد":
      return "MilitaryStatus";

    // --- تواريخ ومدد إضافية ---
    case "حالة البطاقة":
      return "CardStatus";
    case "تاريخ الإصدار البطاقة":
      return "IDIssueDate";
    case "نهاية مدة الإختبار":
      return "ProbationEndDate";
    case "عدد الايام الباقية من مدة الاختبار":
      return "ProbationDaysLeft";
    case "تاريخ بداية التعاقد":
      return "ContractStartDate";
    case "تاريخ انتهاء العقد":
      return "ContractEndDate";
    case "عدد الايام الباقية من العقد":
      return "ContractDaysLeft";
    case "حالة العقد":
      return "ContractStatus";

    // --- تحليلات وملاحظات ---
    case "Notes / ملاحظات":
      return "Notes";
    case "Tenure_Years / مدة الخدمة (سنة)":
      return "Tenure_Years";
    case "Age_Group / فئة العمر":
      return "Age_Group";
    case "Service_Group / فئة مدة الخدمة":
      return "Service_Group";

    // --- الأوراق (Checkboxes) ---
    case "أصل الميلاد":
      return "Doc_Birth";
    case "أصل المؤهل":
      return "Doc_Edu";
    case "صورة البطاقة":
      return "Doc_ID"; // انتبه: يوجد "صورة البطاقه" بالتاء المربوطة والهاء في القائمة
    case "صورة البطاقه":
      return "Doc_ID_2"; // تكرار في القائمة
    case "أصل التجنيد":
      return "Doc_Military";
    case "كعب عمل":
      return "Doc_WorkPermit";
    case "كارنيه النقابه":
      return "Doc_Union";
    case "صورة الرخصه":
      return "Doc_License";
    case "فيش":
      return "Doc_Criminal";
    case "نموذج 111":
      return "Doc_Form111";
    case "صور 5*6":
      return "Doc_Photos";

    default:
      return null; // تجاهل أي عمود غير معروف
  }
}

// === 2. دالة قراءة البيانات (تستخدم المفتاح المباشر) ===
// ملاحظة: تعريف `getEmployeesDataForUser` الموحد موجود لاحقًا في الملف.

// === 3. دالة الإضافة (تستخدم نفس الخريطة + الإضافة تحت النشط) ===
function addEmployee(formObject) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    const lastRow = sheet.getLastRow();
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    // البحث عن عمود الحالة باستخدام الاسم الصريح
    let statusIndex = headers.indexOf("Status / حالة الموظف (بالعمل/منتهي)");
    if (statusIndex === -1)
      return { success: false, message: "لم يتم العثور على عمود الحالة" };

    // منطق تحديد الصف (تحت آخر موظف نشط)
    let targetRowIndex = lastRow;
    if (lastRow > 1) {
      const statusValues = sheet
        .getRange(2, statusIndex + 1, lastRow - 1, 1)
        .getValues();
      for (let i = statusValues.length - 1; i >= 0; i--) {
        const val = statusValues[i][0].toString();
        if (val === "بالعمل" || val === "Active") {
          targetRowIndex = i + 2;
          if (targetRowIndex < lastRow) sheet.insertRowAfter(targetRowIndex);
          break;
        }
      }
    }
    const writeRow = targetRowIndex + 1;

    // === تعبئة الصف بناءً على المطابقة المباشرة ===
    const newRow = headers.map((headerName) => {
      // 1. نحصل على المفتاح البرمجي لهذا العمود (مثلاً "Mobile1")
      const key = getColumnKey(headerName);

      // 2. إذا لم يكن للعمود مفتاح (غير موجود في قائمتنا)، نتركه فارغاً
      if (!key) return "";

      // 3. نجلب القيمة من الفورم باستخدام هذا المفتاح
      // ملاحظة: formObject يحتوي على القيم بأسماء المفاتيح (مثل formObject.Mobile1)
      return formObject[key] || "";
    });

    sheet.getRange(writeRow, 1, 1, newRow.length).setValues([newRow]);

    return { success: true, message: "تمت الإضافة بنجاح" };
  } catch (e) {
    return { success: false, message: "حدث خطأ: " + e.message };
  }
}

// === 4. دالة التعديل (نفس المنطق) ===
function updateEmployee(formObject) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];

    // البحث عن عمود الكود بالاسم الصريح
    let codeIndex = headers.indexOf("EmployeeCode / كود الموظف");
    if (codeIndex === -1)
      return { success: false, message: "لم يتم العثور على عمود كود الموظف" };

    const searchCode =
      formObject.OriginalEmployeeCode || formObject.EmployeeCode;
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIndex].toString() == searchCode.toString()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) return { success: false, message: "الموظف غير موجود" };

    const updatedRow = headers.map((headerName, colIndex) => {
      const key = getColumnKey(headerName);
      if (!key) return data[rowIndex - 1][colIndex]; // عمود غير معروف، نحتفظ بالقديم

      // هل توجد قيمة جديدة في الفورم لهذا المفتاح؟
      // (نستخدم undefined للفحص لأن القيمة الفارغة "" تعتبر تغيير مقصود أحياناً)
      const newVal = formObject[key];

      return newVal !== undefined ? newVal : data[rowIndex - 1][colIndex];
    });

    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
    return { success: true, message: "تم تحديث البيانات بنجاح" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
// ==========================================
// ========== وحدة إدارة الجزاءات ===========
// ==========================================

// معرف شيت الجزاءات المنفصل (من الرابط الذي أرسلته)
const PENALTIES_SS_ID = "1YMf4MazzOIl-ho9Ji-JyIvxPaEGJJw_xe0LdDJwgwII";
const SHEET_RULES = "لائحة المخالفات";
const SHEET_LOG = "Penalties_Log";

function getPenaltyRules() {
  try {
    // محاولة فتح الملف
    const ss = SpreadsheetApp.openById(PENALTIES_SS_ID);
    const sheet = ss.getSheetByName(SHEET_RULES);

    // لو الشيت مش موجود، نرجع مصفوفة فاضية ونطبع خطأ
    if (!sheet) {
      console.error(`❌ لم يتم العثور على شيت باسم: ${SHEET_RULES}`);
      return [];
    }

    const data = sheet.getDataRange().getDisplayValues();

    // لو مفيش داتا غير العنوان، نرجع فاضي
    if (data.length <= 1) return [];

    // إرجاع القواعد (بدون صف العناوين)
    // العمود الأول (index 0) هو "نوع المخالفة"
    return data.slice(1);
  } catch (e) {
    console.error("خطأ في جلب اللائحة: " + e.toString());
    return [];
  }
}

// دالة التحقق (كما هي مع تحسين بسيط في التعامل مع الأخطاء)
// ==========================================
// دالة التحقق (مع حساب التكرار خلال الشهر المالي فقط)
// ==========================================
function checkPenaltyStatus(fingerprintId, violationType) {
  try {
    const allEmp = getEmployeesData();
    const emp = allEmp.find(
      (e) =>
        String(e["FingerprintID / رقم البصمة"]).trim() ==
        String(fingerprintId).trim()
    );

    if (!emp)
      return { found: false, message: "رقم البصمة غير موجود في سجل الموظفين" };

    const ss = SpreadsheetApp.openById(PENALTIES_SS_ID);
    let logSheet = ss.getSheetByName(SHEET_LOG);

    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOG);
      logSheet.appendRow([
        "Date",
        "FingerprintID",
        "EmployeeName",
        "Email",
        "ViolationType",
        "Penalty",
        "RecurrenceIndex",
        "Notes",
      ]);
    }

    const logs = logSheet.getDataRange().getDisplayValues();

    // -----------------------------------------------------
    // 🔥 منطق تحديد الشهر المالي (من 26 السابق لـ 25 الحالي)
    // -----------------------------------------------------
    const today = new Date();
    let startDate, endDate;

    // إذا كنا اليوم في يوم 25 أو قبل (مثلاً 10 فبراير)
    // يبقى الشهر المالي بدأ 26 يناير وهينتهي 25 فبراير
    if (today.getDate() <= 25) {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 26);
      endDate = new Date(today.getFullYear(), today.getMonth(), 25);
    }
    // إذا كنا اليوم بعد يوم 25 (مثلاً 27 فبراير)
    // يبقى الشهر المالي بدأ 26 فبراير وهينتهي 25 مارس
    else {
      startDate = new Date(today.getFullYear(), today.getMonth(), 26);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 25);
    }

    // ضبط الوقت لضمان دقة المقارنة
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    // -----------------------------------------------------

    let count = 0;

    // حساب التكرار داخل الفترة المحددة فقط
    logs.forEach((row) => {
      // الصف الأول عناوين نتخطاه
      if (row[0] === "Date") return;

      const logDate = new Date(row[0]); // تاريخ المخالفة المسجلة

      // الشروط: نفس البصمة + نفس نوع المخالفة + التاريخ داخل الشهر المالي الحالي
      if (
        String(row[1]) == String(fingerprintId) &&
        row[4] == violationType &&
        logDate >= startDate &&
        logDate <= endDate
      ) {
        count++;
      }
    });

    const nextRecurrence = count + 1;

    // جلب اللائحة لتحديد العقوبة
    const rulesSheet = ss.getSheetByName(SHEET_RULES);
    let suggestPenalty = "غير محدد في اللائحة";

    if (rulesSheet) {
      const rulesData = rulesSheet.getDataRange().getDisplayValues();
      const violationRow = rulesData.find((r) => r[0] == violationType);

      if (violationRow) {
        let colIndex = nextRecurrence;
        if (colIndex > 4) colIndex = 4; // الحد الأقصى للعقوبة
        suggestPenalty = violationRow[colIndex] || "غير محدد";
      }
    }

    return {
      found: true,
      empName: emp["FullName_AR / الاسم بالعربية"],
      empEmail: emp["ايميل الموظف"],
      empDept: emp["DepartmentName / الإدارة"],
      recurrence: nextRecurrence,
      suggestedPenalty: suggestPenalty,
    };
  } catch (e) {
    return { found: false, message: "خطأ في النظام: " + e.message };
  }
}

// دالة لحفظ المخالفة في السجل (مهمة لإتمام العملية)
// دالة لحفظ المخالفة في السجل (تم إصلاح خطأ timestamp)
function submitPenalty(form) {
  try {
    const ss = SpreadsheetApp.openById(PENALTIES_SS_ID);
    let logSheet = ss.getSheetByName(SHEET_LOG);
    if (!logSheet) throw new Error("سجل الجزاءات غير موجود");

    // 🔥 1. تعريف الوقت الحالي هنا (هذا هو السطر الناقص)
    const timestamp = new Date();

    logSheet.appendRow([
      timestamp, // استخدام نفس الوقت للسجل
      form.p_fingerprint,
      form.p_empName,
      form.p_email,
      form.p_violation,
      form.p_penalty,
      form.p_recurrence,
      form.p_notes,
    ]);

    // 🔥 2. إرسال الإيميل (الآن المتغير timestamp موجود ولن يظهر خطأ)
    if (form.p_email && form.p_email.includes("@")) {
      sendPenaltyEmail(
        form.p_email,
        form.p_empName,
        form.p_violation,
        form.p_penalty,
        timestamp
      );
    }

    return { success: true, message: "تم تسجيل الجزاء وإرسال التنبيه بنجاح" };
  } catch (e) {
    return { success: false, message: "خطأ: " + e.message };
  }
}

// 4. دالة إرسال الإيميل (HTML Template)
// استبدل دالة sendPenaltyEmail القديمة بهذه النسخة المعدلة
function sendPenaltyEmail(email, name, violation, penalty, date) {
  // === إصلاح الخطأ: التأكد من أن التاريخ هو كائن Date صحيح ===
  // 1. إذا كان التاريخ غير موجود، نستخدم التاريخ والوقت الحالي
  if (!date) {
    date = new Date();
  }

  // 2. إذا كان التاريخ عبارة عن "نص" (String)، نحوله لتاريخ
  if (typeof date === "string") {
    date = new Date(date);
  }

  // 3. التحقق النهائي (إذا كان التاريخ غير صالح Invalid Date)
  if (isNaN(date.getTime())) {
    date = new Date(); // نستخدم الوقت الحالي كبديل آمن
  }
  // ==========================================================

  const subject = "تنبيه إداري - تطبيق جزاء";

  // الآن يمكننا التنسيق بأمان
  const dateStr = Utilities.formatDate(date, "Africa/Cairo", "yyyy-MM-dd");

  const htmlBody = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h3 style="color: #d32f2f;">إشعار بمخالفة إدارية</h3>
      <p>السيد/ة <strong>${name}</strong>،</p>
      <p>نحيطكم علماً بأنه قد تم تسجيل مخالفة إدارية ضدكم بتاريخ ${dateStr}، وفيما يلي التفاصيل:</p>
      <ul>
        <li><strong>نوع المخالفة:</strong> ${violation}</li>
        <li><strong>الجزاء المطبق:</strong> <span style="color:red; font-weight:bold;">${penalty}</span></li>
      </ul>
      <p>نأمل منكم الالتزام بلوائح العمل لتجنب تكرار المخالفات مستقبلاً.</p>
      <hr>
      <p style="font-size: 12px; color: #777;">إدارة الموارد البشرية </p>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody,
  });
}

// 5. جلب تقارير الجزاءات
function getPenaltyReportsData(fromDate, toDate, fingerprintId) {
  const ss = SpreadsheetApp.openById(PENALTIES_SS_ID);
  const logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) return [];

  const data = logSheet.getDataRange().getDisplayValues();
  const headers = data.shift(); // إزالة الهيدر

  const start = new Date(fromDate);
  const end = new Date(toDate);
  end.setHours(23, 59, 59);

  // تصفية البيانات
  const filtered = data.filter((row) => {
    const rowDate = new Date(row[0]); // العمود الأول هو التاريخ
    const rowFing = row[1]; // العمود الثاني هو البصمة

    const inDate = rowDate >= start && rowDate <= end;
    const matchEmp = fingerprintId ? rowFing == fingerprintId : true;

    return inDate && matchEmp;
  });

  return filtered.map((row) => ({
    date: row[0],
    fingerprint: row[1],
    name: row[2],
    violation: row[4],
    penalty: row[5],
    count: row[6],
  }));
}
/* =========================================
   S.T.A.R INTERVIEW PLATFORM MODULE
   (Corrected & Linked to ID: 17p49s_HtFdwfkZGKqm-Ekul8JqQfGf57joKmSaCQcFQ)
   ========================================= */

const STAR_SHEET_ID = "17p49s_HtFdwfkZGKqm-Ekul8JqQfGf57joKmSaCQcFQ";

function getStarDb() {
  return SpreadsheetApp.openById(STAR_SHEET_ID);
}

// 1. حفظ بيانات المتقدم ورفع الـ CV
function saveApplicantData(formObject, fileData) {
  try {
    const ss = getStarDb();
    const ws = ss.getSheetByName("Applicants");
    if (!ws) throw new Error("ورقة 'Applicants' غير موجودة. تأكد من إنشائها.");

    let cvUrl = "No CV Uploaded";

    // معالجة الملف إذا وجد
    if (fileData && fileData.data) {
      const contentType = fileData.mimeType || "application/pdf";
      const blob = Utilities.newBlob(
        Utilities.base64Decode(fileData.data),
        contentType,
        fileData.name
      );
      const file = DriveApp.createFile(blob);
      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );
      cvUrl = file.getUrl();
    }

    const id = "APP-" + Math.floor(Math.random() * 1000000); // رقم عشوائي أكبر
    const date = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm"
    );

    ws.appendRow([
      id,
      formObject.name,
      formObject.phone,
      formObject.email,
      formObject.position,
      formObject.experience,
      cvUrl,
      "New",
      date,
    ]);

    return { success: true, message: "تم تسجيل البيانات بنجاح!" };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// 2. دالة لجلب قائمة المتقدمين (تسمح بظهور المعينين Hired)
function getApplicantsList() {
  try {
    const ss = getStarDb();
    const appSheet = ss.getSheetByName("Applicants");
    const evalSheet = ss.getSheetByName("Evaluations");

    if (!appSheet || !evalSheet) return [];

    const appData = appSheet.getDataRange().getValues();
    const evalData = evalSheet.getDataRange().getValues();

    appData.shift();
    evalData.shift();

    let evalMap = {};
    evalData.forEach((row) => {
      let rawScore = row[12];
      let finalScore = "-";

      if (rawScore !== "" && rawScore !== null) {
        if (typeof rawScore === "number") {
          if (rawScore <= 1.5) {
            finalScore = (rawScore * 100).toFixed(1) + "%";
          } else {
            finalScore = rawScore.toFixed(1) + "%";
          }
        } else {
          finalScore = rawScore.toString();
        }
      }

      evalMap[row[1]] = {
        score: finalScore,
        rec: row[13],
      };
    });

    return appData
      .map((row) => {
        const appId = row[0];
        const evaluation = evalMap[appId] || { score: "-", rec: "-" };

        return {
          id: appId,
          name: row[1],
          phone: row[2],
          email: row[3],
          position: row[4],
          status: row[7],
          score: evaluation.score,
          recommendation: evaluation.rec,
        };
        // التعديل هنا: نسمح بظهور Hired، ونخفي فقط Rejected
        // إذا كنت تريد إظهار المرفوضين أيضاً، احذف .filter بالكامل
      })
      .filter((app) => app.status !== "Rejected");
  } catch (e) {
    Logger.log(e);
    return [];
  }
}

// 4. دالة جديدة لتحديث حالة المتقدم (تعيين / رفض)
function updateApplicantStatus(applicantId, newStatus) {
  try {
    const ss = getStarDb();
    const ws = ss.getSheetByName("Applicants");
    const data = ws.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == applicantId) {
        // العمود رقم 8 هو Status (Index 7)
        ws.getRange(i + 1, 8).setValue(newStatus);
        return { success: true };
      }
    }
    return { success: false, message: "متقدم غير موجود" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// 3. دالة حفظ التقييم (محدثة لتوافق هيكل KSAOs)
function saveEvaluationResult(data) {
  try {
    const ss = getStarDb(); // تأكد أن هذه الدالة موجودة وتعمل
    const ws = ss.getSheetByName("Evaluations");

    if (!ws) throw new Error("ورقة 'Evaluations' غير موجودة. يرجى إنشاؤها.");

    const evalId = "EVAL-" + Date.now();
    const interviewer = Session.getActiveUser().getEmail();
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss"
    );

    // الترتيب هنا يجب أن يطابق ترتيب الأعمدة في الشيت بالضبط
    // داخل دالة saveEvaluationResult
    ws.appendRow([
      evalId,
      data.applicantId,
      interviewer,
      data.s_notes,
      data.t_notes,
      data.a_notes,
      data.r_notes,
      data.score_other, // H
      data.score_soft, // I: تخزين Soft Skills هنا
      data.score_computer, // J: تخزين Computer Skills هنا
      data.score_know, // K
      data.score_ability, // L
      data.total_percent,
      data.recommendation,
      timestamp,
    ]);

    // تحديث حالة المتقدم في شيت Applicants ليصبح "Interviewed"
    const appSheet = ss.getSheetByName("Applicants");
    const appData = appSheet.getDataRange().getValues();

    // البحث عن ID المتقدم وتغيير حالته
    for (let i = 0; i < appData.length; i++) {
      // العمود الأول (index 0) هو ID المتقدم
      if (appData[i][0] == data.applicantId) {
        // نفترض أن عمود الحالة Status هو العمود رقم 8 (Index 7)
        // تأكد من رقم العمود في شيت Applicants
        appSheet.getRange(i + 1, 8).setValue("Interviewed");
        break;
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ==========================================================
// 🧠 دالة الذكاء الاصطناعي (المدير الخارق: بيانات + أكواد)
// ==========================================================

function askAI(userQuestion, selectedModel) {
  try {
    // 1. جلب مفتاح OpenRouter من إعدادات المشروع الآمنة
    const scriptProperties = PropertiesService.getScriptProperties();
    const API_KEY = scriptProperties.getProperty("OPENROUTER_API_KEY");

    if (!API_KEY) {
      return "⚠️ خطأ: مفتاح API غير موجود. تأكد من إضافته في Script Properties باسم OPENROUTER_API_KEY.";
    }

    // 2. 🕵️ جمع بيانات النظام (Context Gathering)

    // أ. بيانات الموظفين (ملخص لتقليل استهلاك التوكنز)
    const employeesData = getEmployeesData();
    const employeesStr =
      employeesData.length > 0
        ? employeesData
            .map(
              (e) =>
                `- [${e["EmployeeCode / كود الموظف"]}] ${e["FullName_AR / الاسم بالعربية"]} | ${e["JobTitle_AR / المسمى الوظيفي بالعربية"]} (${e["DepartmentName / الإدارة"]}) | راتب:${e["BasicSalary / الراتب الأساسي"]} | حالة:${e["Status / حالة الموظف (بالعمل/منتهي)"]}`
            )
            .join("\n")
        : "لا يوجد موظفين مسجلين.";

    // ب. إعدادات النظام الحالية
    const settings = getSystemSettings();
    const settingsStr = `اسم التطبيق: ${settings.appName}, لون الثيم: ${settings.themeColor}`;

    // ج. قائمة المديرين
    const sysUsers = getSystemUsers()
      .map((u) => `${u.username} (${u.role})`)
      .join(", ");

    // د. 🔥 قراءة الكود المصدري للمشروع (للمساعدة التقنية)
    const sourceCode = getProjectSourceCode();

    // 3. 📝 بناء التوجيه للنظام (System Prompt)
    const systemMessage = `
      أنت المساعد الذكي والمدير التقني لنظام (Smart HR System).
      مهمتك هي مساعدة الأدمن في إدارة الموظفين وأيضاً في التطوير البرمجي.

      📂 **لديك صلاحية الوصول للبيانات الحية:**
      1. **إعدادات النظام:** ${settingsStr}
      2. **المستخدمين (Admins):** ${sysUsers}
      3. **سجل الموظفين:**
      ${employeesStr}

      💻 **الكود المصدري للنظام (للقراءة والتحليل):**
      ${sourceCode}

      ⚠️ **قواعد الإجابة:**
      1. تحدث باللغة العربية بأسلوب محترف.
      2. إذا كان السؤال عن بيانات (رواتب، غياب)، استخرج الإجابة من سجل الموظفين بدقة.
      3. إذا كان السؤال تقنياً (تعديل كود، شرح دالة)، اعتمد على "الكود المصدري" المرفق.
      4. إذا طلب منك كوداً، اكتبه له وقل له "انسخ هذا الكود وضعه في الملف الفلاني".
      5. لا تذكر أنك نموذج ذكاء اصطناعي، تصرف كأنك جزء من النظام.
    `;

    // 4. إعداد الاتصال بـ OpenRouter
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const payload = {
      model: selectedModel || "mistralai/devstral-2512:free", // الموديل الافتراضي
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userQuestion },
      ],
      temperature: 0.5, // متوازن بين الدقة والإبداع
      // "max_tokens": 4000 // اختياري
    };

    const options = {
      method: "post",
      headers: {
        Authorization: "Bearer " + API_KEY,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://script.google.com",
        "X-Title": "Smart HR System",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    // 5. تنفيذ الطلب
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    const json = JSON.parse(responseText);

    // 6. معالجة الرد
    if (responseCode === 200 && json.choices && json.choices.length > 0) {
      return json.choices[0].message.content;
    } else {
      console.error("OpenRouter Error:", json);
      // محاولة استخراج رسالة الخطأ
      const errorMsg = json.error ? json.error.message : responseText;
      return `❌ حدث خطأ في الاتصال (كود ${responseCode}): ${errorMsg}`;
    }
  } catch (e) {
    console.error("askAI Exception:", e);
    return "❌ خطأ داخلي في النظام: " + e.message;
  }
}

// ==========================================
// 🕵️ دالة قراءة الكود المصدري (Helper Function)
// ==========================================
function getProjectSourceCode() {
  try {
    const scriptId = ScriptApp.getScriptId();
    const url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;

    const params = {
      method: "get",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, params);

    // إذا فشل الاتصال (غالباً بسبب عدم تفعيل API)
    if (response.getResponseCode() !== 200) {
      return "⚠️ (لم أتمكن من قراءة الكود. تأكد من تفعيل Google Apps Script API في إعدادات حسابك)";
    }

    const json = JSON.parse(response.getContentText());

    if (!json.files) return "لا توجد ملفات كود.";

    let fullCode = "";
    // تجميع الملفات المهمة فقط
    json.files.forEach((file) => {
      if (file.type === "SERVER_JS" || file.type === "HTML") {
        fullCode += `\n--- FILE: ${file.name} (${file.type}) ---\n`;
        fullCode += file.source + "\n";
      }
    });

    return fullCode;
  } catch (e) {
    console.warn("Source Code Error: " + e.message);
    return "تعذر قراءة الكود المصدري (Check Permissions).";
  }
}
// ==========================================
// 🚪 بوابة الموظف (Employee Portal Backend)
// ==========================================

/// === 1. دالة دخول الأدمن ===
function verifyUserLogin(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // تأكد أن لديك شيت بهذا الاسم "Users"
    const ws = ss.getSheetByName("Users");

    if (!ws)
      return {
        success: false,
        message: "خطأ: شيت Users غير موجود! أنشئه أولاً.",
      };

    const data = ws.getDataRange().getValues();
    // نفترض الصف الأول عناوين
    for (let i = 1; i < data.length; i++) {
      // العمود 0: المستخدم | العمود 1: الباسورد
      if (
        String(data[i][0]).toLowerCase() === String(username).toLowerCase() &&
        String(data[i][1]) === String(password)
      ) {
        return {
          success: true,
          name: data[i][2], // الاسم
          role: data[i][3], // الصلاحية (Admin)
          department: data[i][4],
        };
      }
    }
    return { success: false, message: "اسم المستخدم أو كلمة المرور خطأ" };
  } catch (e) {
    return { success: false, message: "خطأ في السيرفر: " + e.message };
  }
}

// === 2. دالة دخول الموظف ===
function loginEmployeeByCode(code) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // تأكد أن هذا هو اسم شيت الموظفين عندك

    const sheet = ss.getSheetByName(SHEET_NAME || "Employees Data");

    if (!sheet)
      return {
        success: false,
        message: "شيت الموظفين (" + SHEET_NAME + ") غير موجود",
      };

    const data = sheet.getDataRange().getDisplayValues();

    // البحث عن الكود في العمود الأول (Index 0)
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(code).trim()) {
        return {
          success: true,
          name: data[i][2], // الاسم (عادة في العمود الثالث، تأكد من ملفك)
          code: data[i][0],
        };
      }
    }
    return { success: false, message: "رقم الملف غير صحيح" };
  } catch (e) {
    return { success: false, message: "خطأ: " + e.message };
  }
}

// دالة لجلب رابط التطبيق للخروج
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}
// ==========================================
// 🚪 بوابة الموظف (Backend) - أضف هذا الجزء في Code.gs
// ==========================================

// 2. تقديم طلب إجازة جديد (الدالة التي تسبب الخطأ)
function submitLeaveRequest(form) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Leave_Requests");

    // إنشاء الشيت تلقائياً لو مش موجود
    if (!sheet) {
      sheet = ss.insertSheet("Leave_Requests");
      sheet.appendRow([
        "RequestID",
        "EmployeeCode",
        "EmployeeName",
        "LeaveType",
        "StartDate",
        "EndDate",
        "Reason",
        "Status",
        "RequestDate",
      ]);
    }

    const reqId = "L-" + Date.now();
    const reqDate = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm"
    );

    sheet.appendRow([
      reqId,
      form.empCode,
      form.empName,
      form.leaveType,
      form.startDate,
      form.endDate,
      form.reason,
      "قيد المراجعة",
      reqDate,
    ]);

    return { success: true, message: "تم إرسال الطلب بنجاح" };
  } catch (e) {
    return { success: false, message: "خطأ في السيرفر: " + e.message };
  }
}

// 3. جلب سجل طلبات الموظف
function getEmployeeRequests(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Leave_Requests");
  if (!sheet) return [];

  const data = sheet.getDataRange().getDisplayValues();
  const requests = [];

  // البحث عن طلبات هذا الموظف
  for (let i = 1; i < data.length; i++) {
    // العمود الثاني (Index 1) هو كود الموظف
    if (String(data[i][1]) === String(code)) {
      requests.push({
        id: data[i][0],
        type: data[i][3],
        start: data[i][4],
        end: data[i][5],
        status: data[i][7],
        date: data[i][8],
      });
    }
  }

  return requests.reverse(); // الأحدث أولاً
}
// ==========================================
// 👔 إدارة الإجازات (HR Admin Panel)
// ==========================================

// 1. جلب كل الطلبات (لصفحة الأدمن)
function getAllLeaveRequests() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Leave_Requests");
  if (!sheet) return [];

  const data = sheet.getDataRange().getDisplayValues();
  // تحويل البيانات لمصفوفة كائنات (تجاهل الهيدر)
  const requests = data.slice(1).map((row) => ({
    id: row[0],
    empCode: row[1],
    empName: row[2],
    type: row[3],
    start: row[4],
    end: row[5],
    reason: row[6],
    status: row[7],
    reqDate: row[8],
  }));

  // ترتيب: المعلق (Pending) يظهر أولاً، ثم الأحدث
  return requests.sort((a, b) => {
    if (a.status === "قيد المراجعة" && b.status !== "قيد المراجعة") return -1;
    if (a.status !== "قيد المراجعة" && b.status === "قيد المراجعة") return 1;
    return new Date(b.reqDate) - new Date(a.reqDate);
  });
}

// ==========================================
// 👔 معالجة الطلب (القبول/الرفض + تحديث الشيت + إيميل احترافي مع الرصيد)
// ==========================================
function processLeaveRequest(reqId, action, adminNote) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const leaveSheet = ss.getSheetByName("Leave_Requests");
    const leaveData = leaveSheet.getDataRange().getValues();

    // 1. البحث عن الطلب
    let rowIndex = -1;
    let requestData = null;

    for (let i = 1; i < leaveData.length; i++) {
      if (String(leaveData[i][0]).trim() === String(reqId).trim()) {
        rowIndex = i + 1;
        requestData = leaveData[i];
        break;
      }
    }

    if (rowIndex === -1) return { success: false, message: "الطلب غير موجود" };

    // 2. تحديث الحالة
    const newStatus = action === "approve" ? "مقبول" : "مرفوض";
    leaveSheet.getRange(rowIndex, 8).setValue(newStatus);

    // 3. تحديث الرصيد (في حالة القبول) + جلب الرصيد الحالي للعرض
    const empCode = requestData[1];

    if (action === "approve") {
      // تحديث الشيت أولاً
      updateEmployeeSheetBalance(empCode);
    }

    // جلب الرصيد الحالي (سواء تم الخصم أم لا) لعرضه في الإيميل
    const balance = getEmployeeBalance(empCode);

    // 4. إرسال الإيميل الاحترافي
    try {
      const empName = requestData[2];
      const leaveType = requestData[3];
      const start = Utilities.formatDate(
        new Date(requestData[4]),
        "GMT+3",
        "yyyy-MM-dd"
      );
      const end = Utilities.formatDate(
        new Date(requestData[5]),
        "GMT+3",
        "yyyy-MM-dd"
      );
      const email = getEmployeeEmail(empCode);

      if (email) {
        // تحديد الألوان والنصوص حسب الحالة
        const statusColor = action === "approve" ? "#2e7d32" : "#c62828"; // أخضر أو أحمر
        const statusIcon = action === "approve" ? "✅" : "❌";
        const bgHeader = action === "approve" ? "#e8f5e9" : "#ffebee";

        // قالب الإيميل الاحترافي
        const emailTemplate = `
           <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
              
              <div style="background-color: ${bgHeader}; padding: 20px; text-align: center; border-bottom: 3px solid ${statusColor};">
                  <h2 style="margin: 0; color: ${statusColor}; font-size: 24px;">${statusIcon} طلب الإجازة ${newStatus} </h2>
                  <p style="margin: 5px 0 0; color: #555;">مرحباً ${empName}</p>
              </div>

              <div style="padding: 20px;">
                  <h3 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 0;">📋 تفاصيل الطلب</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                      <tr>
                          <td style="padding: 8px; color: #666; width: 40%;">نوع الإجازة:</td>
                          <td style="padding: 8px; font-weight: bold; color: #333;">${leaveType}</td>
                      </tr>
                      <tr>
                          <td style="padding: 8px; color: #666;">من تاريخ:</td>
                          <td style="padding: 8px; font-weight: bold; color: #333;">${start}</td>
                      </tr>
                      <tr>
                          <td style="padding: 8px; color: #666;">إلى تاريخ:</td>
                          <td style="padding: 8px; font-weight: bold; color: #333;">${end}</td>
                      </tr>
                      <tr>
                          <td style="padding: 8px; color: #666;">ملاحظات الإدارة:</td>
                          <td style="padding: 8px; color: #555; background-color: #f9f9f9; border-radius: 4px;">${
                            adminNote || "لا يوجد"
                          }</td>
                      </tr>
                  </table>

                  <h3 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 25px;">📊 رصيد الإجازات الحالي</h3>
                  <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 15px;">
                      <div style="flex: 1; text-align: center; padding: 10px; background-color: #e3f2fd; border-radius: 8px; border: 1px solid #bbdefb;">
                          <div style="font-size: 12px; color: #1565c0;">الرصيد السنوي</div>
                          <div style="font-size: 18px; font-weight: bold; color: #0d47a1;">${
                            balance.total
                          }</div>
                      </div>
                      <div style="flex: 1; text-align: center; padding: 10px; background-color: #ffebee; border-radius: 8px; border: 1px solid #ffcdd2;">
                          <div style="font-size: 12px; color: #c62828;">المستهلك</div>
                          <div style="font-size: 18px; font-weight: bold; color: #b71c1c;">${
                            balance.used
                          }</div>
                      </div>
                      <div style="flex: 1; text-align: center; padding: 10px; background-color: #e8f5e9; border-radius: 8px; border: 1px solid #c8e6c9;">
                          <div style="font-size: 12px; color: #2e7d32;">المتبقي</div>
                          <div style="font-size: 18px; font-weight: bold; color: #1b5e20;">${
                            balance.remaining
                          }</div>
                      </div>
                  </div>
              </div>

              <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
                  <p style="font-size: 12px; color: #777;">إدارة الموارد البشرية - Smart HR System</p>
              </div>
           </div>
         `;

        MailApp.sendEmail({
          to: email,
          subject: `تحديث طلب إجازة - ${newStatus}`,
          htmlBody: emailTemplate,
        });
      }
    } catch (e) {
      console.log("خطأ الإيميل: " + e.message);
    }

    return { success: true, message: `تم ${newStatus} الطلب وتحديث الرصيد.` };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
// دالة مساعدة: جلب إيميل الموظف باستخدام الكود
function getEmployeeEmail(empCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("❌ Sheet غير موجود: " + SHEET_NAME);
    return null;
  }

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) {
    Logger.log("❌ الشيت فاضي أو مفيش بيانات");
    return null;
  }

  // استخدام الأسماء الكاملة من الشيت
  const emailIndex = getColumnIndex(sheet, "ايميل الموظف");
  const codeIndex = getColumnIndex(sheet, "EmployeeCode / كود الموظف");

  if (emailIndex === -1 || codeIndex === -1) {
    Logger.log(
      "❌ الأعمدة المطلوبة غير موجودة (emailIndex:" +
        emailIndex +
        ", codeIndex:" +
        codeIndex +
        ")"
    );
    return null;
  }

  // 🔎 البحث عن كود الموظف
  for (let i = 1; i < data.length; i++) {
    const sheetEmpCode = String(data[i][codeIndex]).trim();

    if (sheetEmpCode === String(empCode).trim()) {
      const email = String(data[i][emailIndex]).trim();
      Logger.log("✅ Found Email: " + email);

      return email && email.includes("@") ? email : null;
    }
  }

  Logger.log("⚠️ لم يتم العثور على الموظف بالكود: " + empCode);
  return null;
}
// ==========================================
// 💰 حساب الرصيد (ديناميكي من سجل الطلبات)
// ==========================================
function getEmployeeBalance(empCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_NAME || "Employees_DB");
  const leaveSheet = ss.getSheetByName("Leave_Requests");

  // 1. تحديد الرصيد السنوي (نبحث عنه في شيت الموظفين)
  let totalBalance = 21; // القيمة الافتراضية لو الخانة فاضية

  if (empSheet) {
    const data = empSheet.getDataRange().getValues();
    const headers = data[0];

    // البحث عن رقم عمود الرصيد السنوي وعمود الكود باستخدام الأسماء الكاملة
    const colTotalIdx = getColumnIndex(empSheet, "الرصيد السنوي");
    const colCodeIdx = getColumnIndex(empSheet, "EmployeeCode / كود الموظف");

    // جلب قيمة الرصيد السنوي للموظف
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colCodeIdx]).trim() === String(empCode).trim()) {
        if (colTotalIdx > -1) {
          totalBalance = parseFloat(data[i][colTotalIdx]) || 21;
        }
        break;
      }
    }
  }

  // 2. حساب الرصيد المستهلك (نجمع الأيام المقبولة من شيت الطلبات)
  let usedDays = 0;

  if (leaveSheet) {
    const reqData = leaveSheet.getDataRange().getValues();

    // التكرار على كل الطلبات
    for (let i = 1; i < reqData.length; i++) {
      const rowEmpCode = reqData[i][1]; // العمود الثاني هو كود الموظف
      const status = reqData[i][7]; // العمود الثامن هو الحالة
      const startDate = new Date(reqData[i][4]); // تاريخ البدء
      const endDate = new Date(reqData[i][5]); // تاريخ النهاية

      // الشرط: نفس الكود + الحالة "مقبول"
      if (
        String(rowEmpCode).trim() === String(empCode).trim() &&
        (status === "مقبول" || status === "Approved")
      ) {
        // حساب فرق الأيام
        const diffTime = Math.abs(endDate - startDate);
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        usedDays += days;
      }
    }
  }

  // 3. إرجاع النتيجة النهائية
  return {
    total: totalBalance,
    used: usedDays,
    remaining: totalBalance - usedDays,
  };
}
// ==========================================
// 🔄 دالة مساعدة: إعادة حساب وتحديث رصيد الموظف في الشيت
// ==========================================
function updateEmployeeSheetBalance(empCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const empSheet = ss.getSheetByName(SHEET_NAME || "Employees_DB");
  const leaveSheet = ss.getSheetByName("Leave_Requests");

  if (!empSheet || !leaveSheet) return;

  // 1. حساب إجمالي الأيام المستهلكة من سجل الإجازات (المصدر الموثوق)
  let totalUsedDays = 0;
  const leaveData = leaveSheet.getDataRange().getValues();

  // نفترض: Col 1=Code, Col 3=Type, Col 4=Start, Col 5=End, Col 7=Status
  for (let i = 1; i < leaveData.length; i++) {
    const rowCode = String(leaveData[i][1]).trim();
    const status = leaveData[i][7];

    // نحسب فقط الإجازات "المقبولة"
    if (
      rowCode === String(empCode).trim() &&
      (status === "مقبول" || status === "Approved")
    ) {
      const start = new Date(leaveData[i][4]);
      const end = new Date(leaveData[i][5]);
      // حساب فرق الأيام
      const diff = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
      totalUsedDays += diff;
    }
  }

  // 2. تحديث شيت الموظفين بالقيم الجديدة
  const empData = empSheet.getDataRange().getValues();
  const headers = empData[0];

  // تحديد أماكن الأعمدة باستخدام الأسماء الكاملة
  const colTotalIdx = getColumnIndex(empSheet, "الرصيد السنوي");
  const colUsedIdx = getColumnIndex(empSheet, "الرصيد المستهلك");
  const colRemainIdx = getColumnIndex(empSheet, "الرصيد المتبقي");
  const colCodeIdx = getColumnIndex(empSheet, "EmployeeCode / كود الموظف");

  // البحث عن الموظف وتحديث صفه
  for (let i = 1; i < empData.length; i++) {
    if (String(empData[i][colCodeIdx]).trim() === String(empCode).trim()) {
      // قراءة الرصيد السنوي (أو 21 كقيمة افتراضية)
      let annualBalance = 21;
      if (colTotalIdx > -1) {
        annualBalance = parseFloat(empData[i][colTotalIdx]) || 21;
      }

      // حساب المتبقي
      const remaining = annualBalance - totalUsedDays;

      // 🔥 الكتابة في الشيت (تعديل المستهلك والمتبقي)
      if (colUsedIdx > -1)
        empSheet.getRange(i + 1, colUsedIdx + 1).setValue(totalUsedDays);
      if (colRemainIdx > -1)
        empSheet.getRange(i + 1, colRemainIdx + 1).setValue(remaining);

      console.log(
        `✅ تم تحديث الرصيد للموظف ${empCode}: مستهلك=${totalUsedDays}, متبقي=${remaining}`
      );
      break;
    }
  }
}
// ==========================================
// ⚙️ نظام الإعدادات (Settings System)
// ==========================================

// حفظ الإعدادات (الاسم واللون)
function saveSystemSettings(settings) {
  const scriptProps = PropertiesService.getScriptProperties();
  scriptProps.setProperties({
    SYSTEM_NAME: settings.appName,
    THEME_COLOR: settings.themeColor, // سنحفظ اسم اللون (indigo, emerald, blue, etc.)
  });
  return { success: true };
}

// جلب الإعدادات عند التحميل
// ملاحظة: تم وضع نسخة موحدة من `getSystemSettings` في نهاية الملف (قراءة من شيت Settings).
// ==========================================
// 📂 مركز النماذج والمستندات (HR Docs Center)
// ==========================================

// 🔴 ضع ID مجلد جوجل درايف هنا
const DOCS_FOLDER_ID = "1V-jc5dUZkImZ7ZTi2i2J1Gc-LOSu_RrF";

function getCompanyDocs() {
  try {
    const folder = DriveApp.getFolderById(DOCS_FOLDER_ID);
    const files = folder.getFiles();
    const docs = [];

    while (files.hasNext()) {
      const file = files.next();
      docs.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(), // رابط المعاينة
        downloadUrl: file.getDownloadUrl(), // رابط التحميل المباشر
        type: file.getMimeType(),
        size: (file.getSize() / 1024).toFixed(1) + " KB",
        date: Utilities.formatDate(
          file.getLastUpdated(),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd"
        ),
      });
    }
    return docs;
  } catch (e) {
    // في حالة الخطأ (مثل ID خطأ) نرجع مصفوفة فارغة
    Logger.log(e.toString());
    return [];
  }
}

// ==========================================
// 🔐 نظام تسجيل الدخول (Code.gs)
// ==========================================
function checkLogin(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SystemUsers");
  if (!sheet) return { success: false, message: "شيت المستخدمين غير موجود" };

  const data = sheet.getDataRange().getDisplayValues();
  // نفترض الصف الأول عناوين
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // المطابقة: A=User, B=Pass
    if (
      String(row[0]).toLowerCase() === String(username).toLowerCase() &&
      String(row[1]) === String(password)
    ) {
      return {
        success: true,
        username: row[0],
        role: row[2], // Admin, Manager
        empCode: row[3],
        department: row[4], // العمود E: القسم المسؤول عنه
        permissions: {
          dashboard: row[5] === "TRUE", // F
          emp_view: row[6] === "TRUE", // G
          emp_edit: row[7] === "TRUE", // H
          penalties: row[8] === "TRUE", // I
          settings: row[9] === "TRUE", // J
          interview: row[10] === "TRUE", // K
        },
      };
    }
  }
  return { success: false, message: "بيانات الدخول غير صحيحة" };
}
// ==========================================
// 🛡️ إدارة المستخدمين والصلاحيات (Code.gs)
// ==========================================
const SHEET_USERS = "SystemUsers";

// 1. دالة جلب جميع المستخدمين (الدالة التي يشتكي منها الخطأ)
function getAllSystemUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("SystemUsers");
  if (!sheet) return [];
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row) => ({
    username: row[0],
    role: row[2],
    permissions: {
      dashboard: row[4] === "TRUE",
      emp_view: row[5] === "TRUE",
      emp_edit: row[6] === "TRUE",
      penalties: row[7] === "TRUE",
      settings: row[8] === "TRUE",
    },
  }));
}

function saveUserPermissions(username, newPerms) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SystemUsers");
  const data = sheet.getDataRange().getDisplayValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) return { success: false, message: "المستخدم غير موجود" };

  // Columns in SystemUsers sheet (1-based):
  // 1: Username, 2: Password, 3: Role, 4: EmpCode, 5: Department,
  // 6: Perm_Dashboard, 7: Perm_EmpView, 8: Perm_EmpEdit, 9: Perm_Penalties,
  // 10: Perm_Settings, 11: Perm_Interview, 12: Perm_Leaves, 13: Perm_Docs
  sheet.getRange(rowIndex, 6).setValue(newPerms.dashboard ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 7).setValue(newPerms.emp_view ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 8).setValue(newPerms.emp_edit ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 9).setValue(newPerms.penalties ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 10).setValue(newPerms.settings ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 11).setValue(newPerms.interview ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 12).setValue(newPerms.leaves ? "TRUE" : "FALSE");
  sheet.getRange(rowIndex, 13).setValue(newPerms.docs ? "TRUE" : "FALSE");

  return { success: true, message: "تم الحفظ بنجاح" };
}
// ==========================================
// 📊 إحصائيات الداشبورد (Code.gs) - ضعه في نهاية الملف
// ==========================================
function getDashboardStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Employees"); // تأكد أن اسم الشيت Employees

  // القيم الافتراضية عشان لو الشيت فاضي مايطلعش Error
  let stats = {
    total: 0,
    permanent: 0,
    contract: 0,
    turnover: 0,
    gender: { male: 0, female: 0 },
    finance: { gross: 0, net: 0, avg: 0, byDept: [] },
    depts: { labels: [], values: [] },
  };

  if (!sheet) return stats;

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return stats; // لو مفيش غير صف العناوين

  // =============================================
  // ⚠️ هام: تأكد أن أرقام الأعمدة تطابق ملفك (العد يبدأ من 0)
  // A=0, B=1, C=2, D=3, E=4 ...
  // =============================================
  const I_GENDER = 4; // العمود E (النوع)
  const I_DEPT = 7; // العمود H (الإدارة)
  const I_STATUS = 9; // العمود J (الحالة)
  const I_GROSS = 11; // العمود L (الراتب الإجمالي)
  const I_NET = 12; // العمود M (الراتب الصافي)
  // =============================================

  let activeCount = 0;
  let terminatedCount = 0;
  let totalGross = 0;
  let totalNet = 0;

  // تجميع بيانات الأقسام
  let deptMap = {};
  let deptSalaryMap = {};

  // لوب على كل الموظفين (تجاهل الصف الأول)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = (row[I_STATUS] || "").toString().toLowerCase(); // حالة الموظف

    // حساب المغادرين (Turnover)
    if (
      status.includes("منتهي") ||
      status.includes("terminated") ||
      status.includes("left")
    ) {
      terminatedCount++;
      continue; // لا نحسبهم في الرواتب الحالية
    }

    // نعد فقط الموظفين "بالعمل" أو "Active"
    activeCount++;

    // 1. النوع
    const gender = (row[I_GENDER] || "").toString().trim();
    if (gender === "ذكر" || gender === "Male") stats.gender.male++;
    else if (gender === "أنثى" || gender === "Female") stats.gender.female++;

    // 2. الرواتب (تحويل النص لرقم)
    const gross = parseFloat(row[I_GROSS]) || 0;
    const net = parseFloat(row[I_NET]) || 0;
    totalGross += gross;
    totalNet += net;

    // 3. الأقسام
    const dept = row[I_DEPT] || "غير محدد";
    if (!deptMap[dept]) {
      deptMap[dept] = 0;
      deptSalaryMap[dept] = 0;
    }
    deptMap[dept]++;
    deptSalaryMap[dept] += gross;
  }

  // ملء النتائج النهائية
  stats.total = activeCount;
  stats.finance.gross = totalGross;
  stats.finance.net = totalNet;
  stats.finance.avg =
    activeCount > 0 ? Math.round(totalGross / activeCount) : 0;

  // حساب نسبة الدوران (Turnover Rate)
  const totalHistory = activeCount + terminatedCount;
  stats.turnover =
    totalHistory > 0 ? ((terminatedCount / totalHistory) * 100).toFixed(1) : 0;

  // تحويل الأقسام لمصفوفات عشان الشارت
  stats.depts.labels = Object.keys(deptMap);
  stats.depts.values = Object.values(deptMap);
  stats.finance.byDept = Object.values(deptSalaryMap);

  // أرقام تقريبية لنوع العقد (يمكنك تعديلها لو عندك عمود خاص بنوع العقد)
  stats.permanent = activeCount;
  stats.contract = 0;

  return stats;
}
// دالة لجلب رابط السكريبت الحالي
function getScriptURL() {
  return ScriptApp.getService().getUrl();
}
// ==========================================
// 👤 إدارة الحساب الشخصي (Profile)
// ==========================================

// جلب بيانات المستخدم الحالي
function getCurrentUserProfile() {
  const email = Session.getActiveUser().getEmail(); // أو نعتمد على المتغيرات المخزنة لو بتستخدم نظام دخول مخصص
  // ملاحظة: بما أننا نستخدم نظام دخول مخصص (Custom Login)، سنعتمد على المستخدم النشط حالياً في الجلسة إذا كان متاحاً
  // أو يمكنك جلب البيانات بناءً على Username تم تخزينه في الـ Client Side

  // للتبسيط، سنعيد بيانات افتراضية أو نجلبها من شيت Users لو معنا الـ Username
  return {
    name: "Admin User", // يمكنك ربطها باسم الموظف الفعلي
    username: "Admin",
    role: "HR Manager",
    empCode: "101",
  };
}

// تغيير كلمة المرور للمستخدم
function changeUserPassword(oldPass, newPass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS); // تأكد أن اسم الشيت SystemUsers
  const data = sheet.getDataRange().getDisplayValues();

  // ملاحظة: في التطبيقات الحقيقية يجب تمرير اسم المستخدم من الـ Client
  // هنا سنفترض أننا نغير لأول مستخدم "Admin" كمثال،
  // **يجب عليك تعديل هذا الجزء ليعرف من هو المستخدم الحالي**
  // الحل الأبسط: اطلب من المستخدم إدخال اسم المستخدم أيضاً في الفورم، أو خزنه في variable في الـ JS

  // سأقوم بتحديث بسيط: البحث عن المستخدم ومطابقة الباسورد القديم
  let userFound = false;

  for (let i = 1; i < data.length; i++) {
    // العمود 1: Username, العمود 2: Password
    if (data[i][1] == oldPass) {
      sheet.getRange(i + 1, 2).setValue(newPass);
      return { success: true };
    }
  }

  return { success: false, message: "كلمة المرور القديمة غير صحيحة" };
}
// ==========================================
// 📂 دالة جلب بيانات الموظفين (Code.gs)
// ==========================================

// دالة مساعدة للعثور على index العمود بناءً على الاسم الكامل
function getColumnIndex(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === headerName) {
      return i;
    }
  }
  return -1; // not found
}

function getEmployeesData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // تأكد أن اسم الشيت يطابق الموجود عندك بالضبط
  const sheet =
    ss.getSheetByName("Employees_DB") || ss.getSheetByName("Employees");

  if (!sheet) {
    // في حالة عدم العثور على الشيت نرجع مصفوفة فارغة لتجنب الخطأ
    console.log("❌ خطأ: شيت Employees_DB غير موجود");
    return [];
  }

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return []; // لا توجد بيانات

  const headers = data[0]; // الصف الأول عناوين
  const result = [];

  // تحويل الصفوف إلى كائنات JSON (Array of Objects)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let obj = {};

    // populate object using exact header names ONLY (no short keys for simplicity)
    for (let j = 0; j < headers.length; j++) {
      const rawHeader = String(headers[j]).trim();
      const value = row[j];

      // set the exact header name as the key (callers must use the sheet header directly)
      obj[rawHeader] = value;
    }

    // إضافة حقول محسوبة (اختياري)
    // مثلاً: حساب حالة العقد أو التنبيهات هنا

    result.push(obj);
  }

  return result;
}

// ==========================================
// 🔐 دالة جلب الموظفين حسب الصلاحية (للمديرين)
// ==========================================
function getEmployeesDataForUser(userDept) {
  const allData = getEmployeesData(); // استدعاء الدالة الأساسية أعلاه

  // إذا لم يكن هناك قسم محدد (أدمن)، أرجع الكل
  if (!userDept || userDept === "" || userDept === "All") {
    return allData;
  }

  // فلترة حسب القسم
  return allData.filter(
    (emp) =>
      String(emp["DepartmentName / الإدارة"] || "").trim() ===
      String(userDept).trim()
  );
}
// ==========================================
// 👥 إدارة مستخدمي النظام (Backend Logic)
// ==========================================

// 1. دالة جلب كل المستخدمين
// في ملف Code.gs

function getSystemUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SystemUsers");
  if (!sheet) return [];

  const data = sheet.getDataRange().getDisplayValues();
  const users = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      users.push({
        username: row[0],
        password: row[1],
        role: row[2],
        empCode: row[3],
        department: row[4],
        permissions: {
          dashboard: row[5] === "TRUE",
          emp_view: row[6] === "TRUE",
          emp_edit: row[7] === "TRUE",
          penalties: row[8] === "TRUE",
          settings: row[9] === "TRUE",
          interview: row[10] === "TRUE",
          leaves: row[11] === "TRUE", // 🔥 جديد
          docs: row[12] === "TRUE", // 🔥 جديد
        },
      });
    }
  }
  return users;
}

function saveSystemUser(userData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("SystemUsers");

  if (!sheet) {
    sheet = ss.insertSheet("SystemUsers");
    // تحديث الهيدر ليشمل الأعمدة الجديدة
    sheet.appendRow([
      "Username",
      "Password",
      "Role",
      "EmpCode",
      "Department",
      "Perm_Dashboard",
      "Perm_EmpView",
      "Perm_EmpEdit",
      "Perm_Penalties",
      "Perm_Settings",
      "Perm_Interview",
      "Perm_Leaves",
      "Perm_Docs",
    ]);
  }

  // التأكد من أن الهيدر محدث (اختياري، لكن يفضل إضافة الأعمدة يدوياً في الشيت لو كان موجوداً)

  const data = sheet.getDataRange().getDisplayValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0]).toLowerCase() ===
      String(userData.username).toLowerCase()
    ) {
      rowIndex = i + 1;
      break;
    }
  }

  const newRow = [
    userData.username,
    userData.password,
    userData.role,
    userData.empCode,
    userData.department,
    userData.permissions.dashboard ? "TRUE" : "FALSE",
    userData.permissions.emp_view ? "TRUE" : "FALSE",
    userData.permissions.emp_edit ? "TRUE" : "FALSE",
    userData.permissions.penalties ? "TRUE" : "FALSE",
    userData.permissions.settings ? "TRUE" : "FALSE",
    userData.permissions.interview ? "TRUE" : "FALSE",
    userData.permissions.leaves ? "TRUE" : "FALSE", // 🔥 جديد
    userData.permissions.docs ? "TRUE" : "FALSE", // 🔥 جديد
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }

  return { success: true };
}

// 3. دالة حذف مستخدم
function deleteSystemUser(username) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SystemUsers");
  if (!sheet) return { success: false, message: "Sheet not found" };

  const data = sheet.getDataRange().getDisplayValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: "المستخدم غير موجود" };
}
// ==========================================
// 🛠️ دالة التهيئة الأولية (تشغيل مرة واحدة فقط)
// ==========================================
function setupFirstAdmin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("SystemUsers");

  // 1. إنشاء الشيت إذا لم يكن موجوداً
  if (!sheet) {
    sheet = ss.insertSheet("SystemUsers");
    // إضافة العناوين (Header)
    sheet.appendRow([
      "Username",
      "Password",
      "Role",
      "EmpCode",
      "Department",
      "Perm_Dashboard",
      "Perm_EmpView",
      "Perm_EmpEdit",
      "Perm_Penalties",
      "Perm_Settings",
      "Perm_Interview",
    ]);
    // تلوين العناوين
    sheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#e0e0e0");
    console.log("✅ تم إنشاء شيت SystemUsers بنجاح.");
  }

  // 2. التحقق هل يوجد أدمن بالفعل؟
  const data = sheet.getDataRange().getDisplayValues();
  let adminExists = false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "Admin") {
      adminExists = true;
      break;
    }
  }

  // 3. إضافة الأدمن الافتراضي إذا لم يكن موجوداً
  if (!adminExists) {
    //                               User     Pass   Role   Code Dept  Dash  View  Edit  Penal Set   Inter
    sheet.appendRow([
      "Admin",
      "123",
      "Admin",
      "100",
      "",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
      "TRUE",
    ]);
    console.log("✅ تم إنشاء حساب الأدمن الافتراضي (User: Admin / Pass: 123)");
  } else {
    console.log("ℹ️ حساب الأدمن موجود بالفعل.");
  }
}
// ==========================================
// ⚙️ إدارة الإعدادات (Backend: Code.gs)
// ==========================================

// 1. دالة الحفظ (تستقبل البيانات وتكتبها في الشيت)
function saveGeneralSettings(newSettings) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    // تسجيل البيانات الواصلة للسيرفر
    console.log("📥 البيانات المستلمة:", JSON.stringify(newSettings));

    const sheet = getSettingsSheet();
    const data = sheet.getDataRange().getValues();

    for (var key in newSettings) {
      let val = newSettings[key];
      // تحويل البوليان
      if (val === true) val = "true";
      if (val === false) val = "false";

      let found = false;
      for (var i = 1; i < data.length; i++) {
        // مقارنة المفاتيح وتسجيلها
        if (data[i][0] == key) {
          console.log(
            `✅ تم العثور على المفتاح: ${key}، جاري التحديث إلى: ${val}`
          );
          sheet.getRange(i + 1, 2).setValue(val);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`➕ مفتاح جديد: ${key}، جاري إضافته.`);
        sheet.appendRow([key, val]);
      }
    }

    return { success: true, message: "تم الحفظ" };
  } catch (e) {
    console.error("❌ خطأ:", e.toString());
    return { success: false, message: "خطأ: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// 2. دالة جلب الإعدادات (للقراءة عند الفتح)
function getSystemSettings() {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  let settings = {};

  for (let i = 1; i < data.length; i++) {
    let key = data[i][0];
    let val = data[i][1];
    settings[key] = val;
  }
  return settings;
}

// 3. دالة مساعدة لإنشاء/جلب الشيت
function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");
  if (!sheet) {
    sheet = ss.insertSheet("Settings");
    sheet.appendRow(["Setting Key", "Value"]); // Header
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#ddd");
    // قيم افتراضية أولية
    sheet.appendRow(["appName", "Smart HR System"]);
    sheet.appendRow(["themeColor", "#4f46e5"]);
    sheet.appendRow(["sidebarGradient", "true"]);
  }
  return sheet;
}
