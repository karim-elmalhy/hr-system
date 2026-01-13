/*
  Adapter that provides a `google.script.run`-like interface when the frontend
  is hosted outside Apps Script (e.g. GitHub Pages).
*/
(function () {
  if (window.google && window.google.script && window.google.script.run) return;
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  const base =
    (typeof APPS_SCRIPT_URL !== "undefined" ? APPS_SCRIPT_URL : "") || "";

  function createInvoker() {
    let success = () => {};
    let failure = (e) => {
      console.error(e);
    };

    const handler = {
      get(_, prop) {
        if (prop === "withSuccessHandler")
          return (fn) => {
            success = fn || (() => {});
            return proxy;
          };
        if (prop === "withFailureHandler")
          return (fn) => {
            failure = fn || (() => {});
            return proxy;
          };

        // method call -> returns a function that performs the fetch
        return (...args) => {
          if (!base) {
            setTimeout(
              () => failure(new Error("APPS_SCRIPT_URL is not configured")),
              0
            );
            return proxy;
          }

          const payload = { action: prop, params: args };

          // === التغيير هنا ===
          // تم استخدام fetch بدون headers خاصة لتجنب Preflight CORS
          fetch(base, {
            method: "POST",
            body: JSON.stringify(payload), 
            // تم حذف headers: { "Content-Type": "application/json" }
            // تم حذف credentials: "omit" (غالباً لا تحتاجها إلا إذا كانت تسبب مشاكل إضافية)
          })
            .then((resp) => resp.json())
            .then((data) => {
              if (data && data.status === "success" || data.success) { 
                 // ملاحظة: تأكد أن السكربت يرجع success أو status حسب كودك
                 return success(data.result || data.data || data); 
              }
              return failure(data || new Error("Unexpected response"));
            })
            .catch((err) => failure(err));

          return proxy;
        };
      },
    };

    const proxy = new Proxy({}, handler);
    return proxy;
  }

  window.google.script.run = createInvoker();
})();
function safeSetValue(elementId, value) {
  var el = document.getElementById(elementId);
  if (el) {
    el.value = value || "";
  }
}
