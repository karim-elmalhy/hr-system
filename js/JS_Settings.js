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
