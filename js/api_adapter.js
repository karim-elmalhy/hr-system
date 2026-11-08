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

          const payload = {
            action: prop,
            params: args,
            token: localStorage.getItem("authToken") || ""
          };

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
              if (data && (data.status === "success" || data.success === true)) {
                 return success(data.result || data.data || data);
              }
              const apiError = (data && (data.error || data.message)) || "Unexpected response";
              if (apiError === "AUTH_REQUIRED") {
                localStorage.removeItem("authToken");
                localStorage.removeItem("currentUserRole");
                localStorage.removeItem("userPermissions");
                return failure(new Error("انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى."));
              }
              return failure(new Error(apiError));
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
