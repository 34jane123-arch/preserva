/* =========================================================================
   PRESERVA authentication (FRONTEND DEMO)

   Everything lives in the browser's localStorage until your database exists.
   The file has three layers so a backend can replace the demo part later:

     1. CONFIG + storage adapters  -> swap localStorage for API calls
     2. Auth service (window.PreservaAuth) -> register / login / logout / ...
        Keep these function names and return shapes; change only the insides.
     3. Page controllers -> navbar, login, register, dashboards (UI only)

   SECURITY NOTE: role checks in the browser are for the demo experience only.
   Anyone can edit localStorage. With a real backend, enforce roles on the server.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- 1. CONFIG ---------- */
  const CONFIG = {
    USERS_KEY: "preserva_users",
    SESSION_KEY: "preserva_session",
    FLASH_KEY: "preserva_flash",
    // DEMO ONLY: the one admin account. Admins cannot register publicly.
    // Change the password, and delete this once admins live in your database.
    ADMIN_SEED: { fullName: "PRESERVA Admin", email: "admin@preserva.demo", username: "admin", password: "Admin12345" }
  };

  const ROLES = {
    local:    { label: "Local Buyer",    dashboard: "dashboard-local.html" },
    business: { label: "Business Buyer", dashboard: "dashboard-business.html" },
    seller:   { label: "Seller",         dashboard: "dashboard-seller.html" },
    admin:    { label: "Admin",          dashboard: "dashboard-admin.html" }
  };
  const PUBLIC_ROLES = ["local", "business", "seller"]; // admin is never self-registered

  /* ---------- storage adapters (replace with API calls later) ---------- */
  const storage = {
    read(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
      catch (e) { return fallback; }
    },
    write(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    remove(key) { localStorage.removeItem(key); }
  };
  const usersRepo = {
    all: () => storage.read(CONFIG.USERS_KEY, []),
    save: list => storage.write(CONFIG.USERS_KEY, list)
  };
  const flash = {
    set(type, text) { try { sessionStorage.setItem(CONFIG.FLASH_KEY, JSON.stringify({ type, text })); } catch (e) { /* ignore */ } },
    take() {
      try {
        const v = JSON.parse(sessionStorage.getItem(CONFIG.FLASH_KEY));
        sessionStorage.removeItem(CONFIG.FLASH_KEY);
        return v;
      } catch (e) { return null; }
    }
  };

  /* ---------- password hashing (demo level) ----------
     Passwords are salted and hashed so they are never stored as plain text.
     A real backend should hash on the server with bcrypt or argon2. */
  const cryptoObj = globalThis.crypto;
  function randomHex(bytes) {
    const a = new Uint8Array(bytes || 16);
    cryptoObj.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
  }
  function cyrb53(str) { // tiny fallback hash for browsers without crypto.subtle
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  async function hashWith(alg, password, salt) {
    if (alg === "sha256") {
      const bytes = new TextEncoder().encode(salt + password);
      const digest = await cryptoObj.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    }
    return cyrb53(salt + password);
  }
  async function hashPassword(password, salt) {
    const alg = cryptoObj && cryptoObj.subtle ? "sha256" : "demo";
    return alg + ":" + await hashWith(alg, password, salt);
  }
  async function verifyPassword(password, user) {
    const [alg, expected] = String(user.passHash).split(":");
    if (alg === "sha256" && !(cryptoObj && cryptoObj.subtle)) return false;
    return (await hashWith(alg, password, user.salt)) === expected;
  }

  /* ---------- 2. AUTH SERVICE ---------- */
  const norm = s => String(s || "").trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;
  const bad = (field, error) => ({ ok: false, field, error });
  const publicUser = u => ({ id: u.id, fullName: u.fullName, email: u.email, username: u.username, role: u.role, createdAt: u.createdAt });

  // Creates the demo admin the first time the site runs.
  const ready = (async () => {
    if (usersRepo.all().some(u => u.role === "admin")) return;
    const a = CONFIG.ADMIN_SEED;
    const salt = randomHex();
    usersRepo.save([...usersRepo.all(), {
      id: "u_admin", fullName: a.fullName, email: norm(a.email), username: a.username, role: "admin",
      salt, passHash: await hashPassword(a.password, salt), createdAt: new Date().toISOString()
    }]);
  })().catch(err => console.error("PRESERVA: could not create demo admin", err));

  async function register(input) {
    await ready;
    const d = {
      fullName: String(input.fullName || "").trim().replace(/\s+/g, " "),
      email: norm(input.email),
      username: String(input.username || "").trim(),
      password: String(input.password || ""),
      confirmPassword: String(input.confirmPassword || ""),
      role: String(input.role || "")
    };
    if (d.fullName.length < 2) return bad("fullName", "Enter your full name.");
    if (!EMAIL_RE.test(d.email)) return bad("email", "Enter a valid email address.");
    if (!USERNAME_RE.test(d.username)) return bad("username", "Use 3 to 20 characters: letters, numbers, dots, or underscores.");
    if (d.password.length < 8 || !/[a-zA-Z]/.test(d.password) || !/\d/.test(d.password)) {
      return bad("password", "Use at least 8 characters, with a letter and a number.");
    }
    if (d.password !== d.confirmPassword) return bad("confirmPassword", "The passwords don't match.");
    if (d.role === "admin") return bad("role", "Admin accounts can't be created here.");
    if (!PUBLIC_ROLES.includes(d.role)) return bad("role", "Choose an account type.");

    const existing = usersRepo.all();
    if (existing.some(u => norm(u.email) === d.email)) return bad("email", "An account with this email already exists.");
    if (existing.some(u => norm(u.username) === norm(d.username))) return bad("username", "That username is taken. Try another one.");

    const salt = randomHex();
    const user = {
      id: "u_" + Date.now().toString(36) + randomHex(4),
      fullName: d.fullName, email: d.email, username: d.username, role: d.role,
      salt, passHash: await hashPassword(d.password, salt), createdAt: new Date().toISOString()
    };
    usersRepo.save([...usersRepo.all(), user]);
    return { ok: true, user: publicUser(user) };
  }

  async function login(input) {
    await ready;
    const id = norm(input.identifier);
    const password = String(input.password || "");
    if (!id || !password) return { ok: false, error: "Enter your username or email and your password." };
    const user = usersRepo.all().find(u => norm(u.email) === id || norm(u.username) === id);
    if (!user || !(await verifyPassword(password, user))) {
      return { ok: false, error: "Incorrect username, email, or password." };
    }
    storage.write(CONFIG.SESSION_KEY, { userId: user.id, at: Date.now() });
    return { ok: true, user: publicUser(user) };
  }

  function logout() { storage.remove(CONFIG.SESSION_KEY); }

  // The role always comes from the saved account, never from the session record.
  function currentUser() {
    const s = storage.read(CONFIG.SESSION_KEY, null);
    if (!s) return null;
    const u = usersRepo.all().find(x => x.id === s.userId);
    return u ? publicUser(u) : null;
  }

  function requireRole(role) {
    const user = currentUser();
    if (!user) return { ok: false, reason: "login", user: null };
    if (user.role !== role) return { ok: false, reason: "forbidden", user };
    return { ok: true, user };
  }

  function listUsers() { // admin only
    const me = currentUser();
    return me && me.role === "admin" ? usersRepo.all().map(publicUser) : [];
  }

  const Auth = {
    ready, ROLES, PUBLIC_ROLES, register, login, logout, currentUser, requireRole, listUsers,
    dashboardFor: role => (ROLES[role] || ROLES.local).dashboard
  };
  globalThis.PreservaAuth = Auth;

  /* ---------- 3. PAGE CONTROLLERS (UI) ---------- */
  if (typeof document === "undefined") return; // allows testing the service without a browser

  const $ = id => document.getElementById(id);

  function h(tag, props) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === "className") node.className = v;
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    });
    for (let i = 2; i < arguments.length; i++) node.append(...[].concat(arguments[i]));
    return node;
  }

  function setAlert(box, type, text) {
    if (!box) return;
    box.className = "alert alert-" + type;
    box.textContent = text || "";
    box.hidden = !text;
  }
  function clearErrors(form) {
    form.querySelectorAll(".field").forEach(f => {
      f.classList.remove("has-error");
      const p = f.querySelector(".field-error");
      if (p) p.textContent = "";
    });
  }
  function fieldError(form, name, message) {
    const wrap = form.querySelector('[data-field="' + name + '"]');
    if (!wrap) return;
    wrap.classList.add("has-error");
    const p = wrap.querySelector(".field-error");
    if (p) p.textContent = message;
    const input = wrap.querySelector("input");
    if (input) input.focus();
  }
  function setBusy(button, busy, idleText) {
    button.disabled = busy;
    button.textContent = busy ? "Please wait..." : idleText;
  }

  // Navbar: Log in / Sign up, or Dashboard / Log out
  function renderNav() {
    const host = $("authNav");
    if (!host) return;
    const user = currentUser();
    const here = location.pathname.split("/").pop();
    const link = (text, href, cls) => {
      const a = h("a", { href, className: cls || "" }, text);
      if (here && href === here) a.classList.add("nav-active");
      return a;
    };
    host.replaceChildren();
    if (user) {
      const out = h("a", { href: "index.html", className: "nav-cta" }, "Log out");
      out.title = "Signed in as " + user.fullName;
      out.addEventListener("click", e => { e.preventDefault(); logout(); location.assign("index.html"); });
      host.append(link("Dashboard", ROLES[user.role].dashboard), out);
    } else {
      host.append(link("Log in", "login.html"), link("Sign up", "register.html", "nav-cta"));
    }
  }

  function initPasswordToggles() {
    document.querySelectorAll(".pw-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = $(btn.dataset.target);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-pressed", show);
        btn.setAttribute("aria-label", (show ? "Hide" : "Show") + " password");
      });
    });
  }

  function initLogin() {
    const form = $("loginForm");
    if (!form) return;
    const existing = currentUser();
    if (existing) { location.replace(ROLES[existing.role].dashboard); return; }

    const box = $("formAlert");
    const notice = flash.take();
    if (notice) setAlert(box, notice.type, notice.text);

    form.addEventListener("submit", async e => {
      e.preventDefault();
      clearErrors(form);
      setAlert(box, "", "");
      const identifier = form.identifier.value.trim();
      const password = form.password.value;
      if (!identifier) return fieldError(form, "identifier", "Enter your username or email.");
      if (!password) return fieldError(form, "password", "Enter your password.");

      const btn = form.querySelector('button[type="submit"]');
      setBusy(btn, true);
      const res = await login({ identifier, password });
      if (!res.ok) {
        setBusy(btn, false, "Log in");
        setAlert(box, "error", res.error);
        form.password.value = "";
        form.password.focus();
        return;
      }
      const role = ROLES[res.user.role];
      setAlert(box, "success", "Welcome back, " + res.user.fullName + "! Signed in as " + role.label + ". Opening your dashboard...");
      setTimeout(() => location.assign(role.dashboard), 900);
    });
  }

  function initRegister() {
    const form = $("registerForm");
    if (!form) return;
    const existing = currentUser();
    if (existing) { location.replace(ROLES[existing.role].dashboard); return; }

    const wanted = new URLSearchParams(location.search).get("type");
    const preset = form.querySelector('input[name="role"][value="' + wanted + '"]');
    if (preset) preset.checked = true;

    const box = $("formAlert");
    form.addEventListener("input", e => {
      const wrap = e.target.closest(".field");
      if (wrap) { wrap.classList.remove("has-error"); const p = wrap.querySelector(".field-error"); if (p) p.textContent = ""; }
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      clearErrors(form);
      setAlert(box, "", "");
      const picked = form.querySelector('input[name="role"]:checked');
      const btn = form.querySelector('button[type="submit"]');
      setBusy(btn, true);
      const res = await register({
        fullName: form.fullName.value, email: form.email.value, username: form.username.value,
        password: form.password.value, confirmPassword: form.confirmPassword.value, role: picked ? picked.value : ""
      });
      if (!res.ok) {
        setBusy(btn, false, "Create account");
        fieldError(form, res.field, res.error);
        setAlert(box, "error", res.error);
        return;
      }
      flash.set("success", "Account created! Log in with your username or email to continue.");
      setAlert(box, "success", "Account created as " + ROLES[res.user.role].label + ". Taking you to log in...");
      setTimeout(() => location.assign("login.html"), 1200);
    });
  }

  function initDashboard() {
    const required = document.body.dataset.role;
    const check = requireRole(required);
    if (!check.ok && check.reason === "login") {
      flash.set("info", "Please log in to open your dashboard.");
      location.replace("login.html");
      return;
    }
    if (!check.ok) { // signed in, but this dashboard belongs to another role
      $("gateText").textContent = "This dashboard is only for " + ROLES[required].label +
        " accounts. You are signed in as " + ROLES[check.user.role].label + ".";
      $("gateBtn").href = ROLES[check.user.role].dashboard;
      $("dashGate").hidden = false;
      return;
    }

    const user = check.user;
    $("dashTitle").textContent = "Welcome, " + user.fullName.split(" ")[0];
    $("dashSub").textContent = ROLES[user.role].label + " dashboard";
    $("kvName").textContent = user.fullName;
    $("kvUser").textContent = user.username;
    $("kvEmail").textContent = user.email;
    $("kvRole").textContent = ROLES[user.role].label;
    $("kvSince").textContent = new Date(user.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    $("logoutBtn").addEventListener("click", () => { logout(); location.assign("index.html"); });
    if (user.role === "admin") renderAdminPanel();
    $("dashContent").hidden = false;
  }

  function renderAdminPanel() {
    const users = listUsers();
    const count = role => users.filter(u => u.role === role).length;
    $("adminStats").replaceChildren(...["local", "business", "seller", "admin"].map(role =>
      h("div", { className: "stat" }, h("strong", {}, String(count(role))), h("span", {}, ROLES[role].label + "s"))));

    const rows = $("adminRows");
    rows.replaceChildren(...users.map(u => h("tr", {},
      h("td", {}, u.fullName), h("td", {}, u.username), h("td", {}, u.email),
      h("td", {}, h("span", { className: "role-badge" }, ROLES[u.role].label)),
      h("td", {}, new Date(u.createdAt).toLocaleDateString("en-PH")))));

    $("exportUsers").addEventListener("click", () => {
      const a = h("a", { download: "preserva-accounts.json" });
      a.href = URL.createObjectURL(new Blob([JSON.stringify(users, null, 2)], { type: "application/json" }));
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // Same shrinking header as script.js, for pages that don't load script.js
  function initHeaderShrink() {
    const bar = document.querySelector(".navbar");
    if (!bar || document.body.dataset.page === undefined) return;
    window.addEventListener("scroll", () => {
      if (window.scrollY > 60) bar.classList.add("scrolled");
      else if (window.scrollY < 10) bar.classList.remove("scrolled");
    }, { passive: true });
  }

  renderNav();
  initPasswordToggles();
  initHeaderShrink();
  const page = document.body.dataset.page;
  if (page === "login") initLogin();
  if (page === "register") initRegister();
  if (page === "dashboard") initDashboard();
})();
