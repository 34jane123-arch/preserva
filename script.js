// ---------- SETTINGS ----------
// Paste a Formspree URL to receive real registrations and messages. Empty = demo mode.
const FORM_ENDPOINT = "";

// DEMO ONLY: first admin account, created in this browser. Change the password, and
// delete this once admin accounts live in your database (anyone can read this file).
const ADMIN_SEED = { name: "PRESERVA Admin", email: "admin@preserva.ph", password: "ChangeMe123" };

// ---------- SAMPLE DATA ----------
// Replace the phone numbers with real seller numbers. until = pickup deadline (24h clock).
const products = [
  { name: "Fresh Pechay", category: "Vegetables", price: 18, oldPrice: 25, unit: "bunch", qty: 12, until: 17, tag: "Sell today",
    seller: "Sample Seller A", phone: "09000000001", location: "Panabo Central Market",
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=700&q=80" },
  { name: "Fresh Sayote", category: "Vegetables", price: 25, oldPrice: 35, unit: "kg", qty: 8, until: 18, tag: "Ripe, sell soon",
    seller: "Sample Seller B", phone: "09000000002", location: "Panabo Central Market",
    image: "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=700&q=80" },
  { name: "Ripe Tomatoes", category: "Vegetables", price: 35, oldPrice: 50, unit: "kg", qty: 10, until: 16, tag: "Very ripe",
    seller: "Sample Seller C", phone: "09000000003", location: "Panabo Central Market",
    image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=700&q=80" },
  { name: "Fresh Carrots", category: "Vegetables", price: 45, oldPrice: 60, unit: "kg", qty: 15, until: 18, tag: "Sell today",
    seller: "Sample Seller A", phone: "09000000001", location: "Panabo Central Market",
    image: "https://images.unsplash.com/photo-1445282768818-728615cc910a?auto=format&fit=crop&w=700&q=80" },
  { name: "Ripe Bananas", category: "Fruits", price: 30, oldPrice: 45, unit: "kg", qty: 20, until: 17, tag: "Very ripe",
    seller: "Sample Seller D", phone: "09000000004", location: "Panabo Central Market",
    image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=700&q=80" },
  { name: "Fresh Mangoes", category: "Fruits", price: 55, oldPrice: 80, unit: "kg", qty: 9, until: 19, tag: "Ripe, sell soon",
    seller: "Sample Seller E", phone: "09000000005", location: "Panabo Central Market",
    image: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=700&q=80" }
];

const PRODUCE = [["Pechay","🥬"],["Sayote","🥒"],["Tomatoes","🍅"],["Carrots","🥕"],["Eggplant","🍆"],["Squash","🎃"],["Bananas","🍌"],["Mangoes","🥭"]];

// ---------- HELPERS ----------
const $ = id => document.getElementById(id);
const peso = n => "₱" + n.toLocaleString("en-PH");
const discount = p => Math.round((1 - p.price / p.oldPrice) * 100);
const hourLabel = h => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const norm = s => String(s).replace(/[\s-]/g, "").replace(/^\+63/, "0");
const phoneOk = v => /^(09|\+639)\d{9}$/.test(v.replace(/[\s-]/g, ""));
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const andList = a => a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3200);
}

// Sends a form to FORM_ENDPOINT. Returns "demo" when no endpoint is set.
async function submitTo(form) {
  if (!FORM_ENDPOINT) return "demo";
  const res = await fetch(FORM_ENDPOINT, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) });
  if (!res.ok) throw new Error(res.status);
  return "ok";
}

// ---------- PAGE NAVIGATION ----------
const validPages = ["home", "login", "products", "seller", "about", "contact", "admin"];

function showPage(pageId, moveFocus = true) {
  if (pageId === "admin" && currentUser()?.role !== "admin") pageId = "login";
  const target = $(pageId);
  if (!target) return;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  target.classList.add("active");

  document.querySelectorAll("nav [data-page]").forEach(link => {
    const active = link.dataset.page === pageId;
    link.classList.toggle("nav-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("authLink").classList.toggle("nav-active", pageId === "login" || pageId === "admin");

  window.scrollTo({ top: 0 });
  if (moveFocus) target.querySelector("h1")?.focus({ preventScroll: true });
  if (pageId === "admin") renderAdmin();
}

function go(pageId) {
  if (location.hash !== "#" + pageId) history.pushState(null, "", "#" + pageId);
  showPage(pageId);
}

document.querySelectorAll("[data-page]").forEach(node => {
  node.addEventListener("click", event => {
    event.preventDefault();
    go(node.dataset.page);
  });
});

window.addEventListener("popstate", () => {
  const page = location.hash.slice(1);
  showPage(validPages.includes(page) ? page : "home");
});

// ---------- IMPACT COUNTERS ----------
function renderImpact() {
  const kg = products.filter(p => p.unit === "kg").reduce((s, p) => s + p.qty, 0);
  const saved = products.reduce((s, p) => s + (p.oldPrice - p.price) * p.qty, 0);
  $("impactKg").textContent = kg;
  $("impactDeals").textContent = products.length;
  $("impactSave").textContent = peso(saved);
}

// ---------- PRODUCT LISTINGS ----------
const productGrid = $("productGrid");
const searchInput = $("searchInput");
const sortSelect = $("sortSelect");
const productCount = $("productCount");
let activeCategory = "All";

function actionLink(label, href, className, external) {
  const a = el("a", "btn " + className, label);
  a.href = href;
  if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  return a;
}

function buildCard(p) {
  const card = el("article", "product-card");

  const img = el("img");
  img.src = p.image;
  img.alt = p.name;
  img.loading = "lazy";
  img.onerror = () => { img.removeAttribute("src"); img.alt = ""; };

  const info = el("div", "product-info");
  const priceRow = el("div", "price-row");
  priceRow.append(el("span", "price", `${peso(p.price)} / ${p.unit}`), el("s", "old-price", peso(p.oldPrice)));

  const meta = el("ul", "meta");
  meta.append(
    el("li", p.qty <= 8 ? "urgent" : "", `${p.qty} ${p.unit === "kg" ? "kg" : "bunches"} left`),
    el("li", "", `Pickup until ${hourLabel(p.until)} today`),
    el("li", "", `${p.seller} · ${p.location}`)
  );

  const mapUrl = "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${p.location}, Panabo City, Davao del Norte`);
  const smsText = encodeURIComponent(`Hi, is the ${p.name} still available on PRESERVA?`);

  const actions = el("div", "actions");
  actions.append(
    actionLink("Call seller", `tel:${p.phone}`, ""),
    actionLink("Text seller", `sms:${p.phone}?&body=${smsText}`, "btn-outline"),
    actionLink("Get directions", mapUrl, "btn-outline", true)
  );

  info.append(el("span", "product-category", p.category), el("h3", "", p.name), priceRow, meta, actions);
  card.append(el("span", "badge", `${discount(p)}% off · ${p.tag}`), img, info);
  return card;
}

function renderProducts() {
  const term = searchInput.value.toLowerCase().trim();
  const list = products.filter(p =>
    (activeCategory === "All" || p.category === activeCategory) &&
    [p.name, p.category, p.seller, p.location].join(" ").toLowerCase().includes(term)
  );
  const sorters = {
    discount: (a, b) => discount(b) - discount(a),
    price: (a, b) => a.price - b.price,
    ending: (a, b) => a.until - b.until
  };
  if (sorters[sortSelect.value]) list.sort(sorters[sortSelect.value]);

  productCount.textContent = `${list.length} deal${list.length === 1 ? "" : "s"} found`;
  productGrid.replaceChildren();
  if (!list.length) {
    productGrid.append(el("p", "", "No deals match your search. Try a different word or choose All."));
    return;
  }
  list.forEach(p => productGrid.append(buildCard(p)));
}

searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);
document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    activeCategory = btn.dataset.category;
    document.querySelectorAll(".filter").forEach(f => {
      f.classList.toggle("active", f === btn);
      f.setAttribute("aria-pressed", f === btn);
    });
    renderProducts();
  });
});

// ---------- ACCOUNTS (stored in this browser until your database is ready) ----------
// Each account: { id, role, ...profile fields, email, salt, passHash, createdAt }.
// Roles: "local" | "business" | "seller" | "admin". Keep this shape when you move to a database.
const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const users = () => load("preserva_users") || [];
const saveUsers = list => localStorage.setItem("preserva_users", JSON.stringify(list));
const currentUser = () => users().find(u => u.id === localStorage.getItem("preserva_session")) || null;
const randomHex = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, "0")).join("");

// Demo-level hashing so passwords aren't stored as plain text. A real database should
// hash on the server with bcrypt or argon2 instead.
async function hashPw(password, salt) {
  const bytes = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function seedAdmin() {
  if (!window.crypto?.subtle || users().some(u => u.role === "admin")) return;
  const salt = randomHex();
  saveUsers([...users(), {
    id: "admin-" + randomHex(), role: "admin", name: ADMIN_SEED.name, contact: "", address: "",
    email: ADMIN_SEED.email.toLowerCase(), salt, passHash: await hashPw(ADMIN_SEED.password, salt),
    createdAt: new Date().toISOString()
  }]);
}

const FIELD = {
  name:      { label: "Name",       ph: "Enter your Name",       auto: "name" },
  storeName: { label: "Store Name", ph: "Enter your Store Name", auto: "organization" },
  contact:   { label: "Contact",    ph: "Enter your Contact",    auto: "tel", type: "tel" },
  address:   { label: "Address",    ph: "Enter your Address",    auto: "street-address" },
  email:     { label: "Email",      ph: "Enter your Email",      auto: "email", type: "email" },
  password:  { label: "Password",   ph: "Enter your Password",   type: "password" }
};
const BUYER_FIELDS = ["name", "contact", "address", "email", "password"];
const ROLES = {
  local:    { label: "Local Buyer",    fields: BUYER_FIELDS, loginBy: "Contact or Email" },
  business: { label: "Business Buyer", fields: BUYER_FIELDS, loginBy: "Contact or Email" },
  seller:   { label: "Seller",         fields: ["storeName", "contact", "address", "password"], loginBy: "Contact" },
  admin:    { label: "Admin",          fields: [], loginOnly: true, loginBy: "Email" }
};

let auth = { role: null, mode: "signup" };
const authForm = $("authForm");

function authSay(text, isError) {
  $("authMsg").textContent = text;
  $("authMsg").classList.toggle("error", !!isError);
}

function showPicker() {
  $("rolePick").hidden = false;
  $("authPanel").hidden = true;
  authSay("");
}

function authRow(name, label, placeholder, type, autocomplete) {
  const row = el("div", "auth-row");
  const lab = el("label", "", label);
  lab.htmlFor = "auth_" + name;
  const input = el("input");
  Object.assign(input, { id: "auth_" + name, name, type, placeholder, autocomplete });
  row.append(lab, input);
  return row;
}

function openAuth(role, mode = "signup") {
  const r = ROLES[role];
  if (!r) return;
  if (r.loginOnly) mode = "login";
  auth = { role, mode };

  $("rolePick").hidden = true;
  $("authPanel").hidden = false;
  $("authTitle").textContent = `Continue as ${r.label}`;
  $("tabSignup").hidden = !!r.loginOnly;
  $("tabSignup").setAttribute("aria-selected", mode === "signup");
  $("tabLogin").setAttribute("aria-selected", mode === "login");

  authForm.replaceChildren();
  if (mode === "signup") {
    $("authIntro").textContent = `Please confirm ${andList(r.fields.map(k => FIELD[k].label))}`;
    r.fields.forEach(k => {
      const f = FIELD[k];
      authForm.append(authRow(k, f.label, f.ph, f.type || "text", k === "password" ? "new-password" : f.auto || "off"));
    });
  } else {
    $("authIntro").textContent = `Log in with your ${r.loginBy.toLowerCase()} and password.`;
    authForm.append(
      authRow("login", r.loginBy, `Enter your ${r.loginBy}`, "text", "username"),
      authRow("password", "Password", "Enter your Password", "password", "current-password")
    );
  }
  authForm.append(el("button", "btn", mode === "signup" ? "Create account" : "Log in"));
  authForm.lastChild.type = "submit";
  authSay("");

  go("login");
  authForm.elements[0]?.focus();
}

document.querySelectorAll(".role").forEach(btn => btn.addEventListener("click", () => openAuth(btn.dataset.role)));
document.querySelectorAll("[data-auth]").forEach(btn => btn.addEventListener("click", () => openAuth(btn.dataset.auth, "signup")));
$("tabSignup").addEventListener("click", () => openAuth(auth.role, "signup"));
$("tabLogin").addEventListener("click", () => openAuth(auth.role, "login"));
$("authBack").addEventListener("click", showPicker);

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  authSay("");
  authForm.querySelectorAll(".invalid").forEach(n => n.classList.remove("invalid"));
  const fail = (name, text) => {
    const input = authForm.elements[name];
    input.closest(".auth-row").classList.add("invalid");
    input.focus();
    authSay(text, true);
  };
  if (!window.crypto?.subtle) return authSay("Accounts need a secure page. Open the site over https or localhost.", true);

  const d = {};
  new FormData(authForm).forEach((v, k) => { d[k] = k === "password" ? v : String(v).trim(); });
  const { role, mode } = auth;

  if (mode === "login") {
    if (!d.login) return fail("login", `Enter your ${ROLES[role].loginBy.toLowerCase()}.`);
    if (!d.password) return fail("password", "Enter your password.");
    const user = users().find(u => u.role === role && (norm(u.contact) === norm(d.login) || u.email === d.login.toLowerCase()));
    const ok = user && await hashPw(d.password, user.salt) === user.passHash;
    if (!ok) return fail("password", "That contact, email, or password doesn't match an account.");
    return finishAuth(user);
  }

  const keys = ROLES[role].fields;
  const missing = keys.find(k => !d[k]);
  if (missing) return fail(missing, `Please enter your ${FIELD[missing].label.toLowerCase()}.`);
  if (!phoneOk(d.contact)) return fail("contact", "Enter a valid mobile number, like 09123456789.");
  if (d.email && !emailOk(d.email)) return fail("email", "Enter a valid email address.");
  if (d.password.length < 8) return fail("password", "Use at least 8 characters for your password.");

  const email = (d.email || "").toLowerCase();
  const all = users();
  if (all.some(u => u.role === role && (norm(u.contact) === norm(d.contact) || (email && u.email === email)))) {
    return fail("contact", "An account with this contact or email already exists. Try logging in.");
  }

  const salt = randomHex();
  const user = { id: Date.now().toString(36) + randomHex(), role, createdAt: new Date().toISOString(), salt, email, passHash: await hashPw(d.password, salt) };
  keys.forEach(k => { if (k !== "password") user[k] = d[k]; });
  saveUsers([...all, user]);
  finishAuth(user);
});

function finishAuth(user) {
  localStorage.setItem("preserva_session", user.id);
  showPicker();
  updateAuthUI();
  toast(`Welcome, ${user.name || user.storeName}!`);
  go({ seller: "seller", admin: "admin" }[user.role] || "products");
}

function logout() {
  localStorage.removeItem("preserva_session");
  updateAuthUI();
  toast("You're logged out.");
  go("home");
}

$("authLink").addEventListener("click", event => {
  event.preventDefault();
  if (currentUser()) return logout();
  showPicker();
  go("login");
});

function updateAuthUI() {
  const u = currentUser();
  $("authLink").textContent = u ? "Log out" : "Log in";
  $("authLink").title = u ? `Signed in as ${u.name || u.storeName}` : "";
  $("sellerGate").hidden = u?.role === "seller";
  if (u?.role === "seller") {
    if (!sellerForm.businessName.value) sellerForm.businessName.value = u.storeName;
    if (!sellerForm.sellerPhone.value) sellerForm.sellerPhone.value = u.contact;
    if (!sellerForm.sellerLocation.value) sellerForm.sellerLocation.value = u.address;
    updatePreview();
  }
}

// ---------- ADMIN DASHBOARD ----------
function renderAdmin() {
  const list = users().filter(u => u.role !== "admin");
  const stats = $("adminStats");
  stats.replaceChildren(...[["local", "Local buyers"], ["business", "Business buyers"], ["seller", "Sellers"]].map(([role, label]) => {
    const box = el("div", "stat");
    box.append(el("strong", "", String(list.filter(u => u.role === role).length)), el("span", "", label));
    return box;
  }));

  const rows = $("adminRows");
  rows.replaceChildren();
  if (!list.length) {
    const tr = el("tr");
    const td = el("td", "empty", "No accounts yet.");
    td.colSpan = 6;
    tr.append(td);
    rows.append(tr);
    return;
  }
  list.forEach(u => {
    const tr = el("tr");
    [u.name || u.storeName, ROLES[u.role]?.label || u.role, u.contact, u.email || "-", u.address,
     new Date(u.createdAt).toLocaleDateString("en-PH")].forEach(v => tr.append(el("td", "", v)));
    rows.append(tr);
  });
}

$("exportUsers").addEventListener("click", () => {
  const data = users().map(({ passHash, salt, ...rest }) => rest);
  const a = el("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "preserva-users.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- SELLER DEAL FORM ----------
const sellerForm = $("sellerForm");
const formMessage = $("formMessage");
const sellerSuccess = $("sellerSuccess");

$("chips").append(...PRODUCE.map(([name, emoji]) => {
  const label = el("label", "chip");
  const input = el("input");
  Object.assign(input, { type: "checkbox", name: "produce", value: name });
  input.dataset.emoji = emoji;
  label.append(input, el("span", "", `${emoji} ${name}`));
  return label;
}));

function setMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", !!isError);
}

function updatePreview() {
  const chips = [...sellerForm.querySelectorAll('input[name="produce"]:checked')];
  const other = sellerForm.otherProduce.value.trim();
  const names = chips.map(c => c.value).concat(other ? [other] : []);
  const price = Number(sellerForm.price.value);
  const old = Number(sellerForm.oldPrice.value);
  const unit = sellerForm.unit.value;
  const qty = sellerForm.qty.value;
  const hasDeal = price > 0 && old > price;
  const plural = { kg: "kg", bunch: "bunches", piece: "pieces" }[unit];

  $("pvImg").textContent = chips[0]?.dataset.emoji || "🥬";
  $("pvName").textContent = names.length ? names.join(", ") : "Your produce";
  $("pvPrice").textContent = price ? `${peso(price)} / ${unit}` : "Set your price";
  $("pvOld").textContent = hasDeal ? peso(old) : "";
  $("pvBadge").textContent = hasDeal ? `${Math.round((1 - price / old) * 100)}% off · Sell today` : "Sell today";
  $("pvQty").textContent = qty ? `${qty} ${plural} left` : "Quantity left";
  $("pvUntil").textContent = `Pickup until ${hourLabel(Number(sellerForm.until.value))} today`;
  $("pvStall").textContent = `${sellerForm.businessName.value.trim() || "Your stall"} · ${sellerForm.sellerLocation.value.trim() || "Your market"}`;
}
sellerForm.addEventListener("input", updatePreview);
sellerForm.addEventListener("change", updatePreview);

sellerForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage("");
  sellerForm.querySelectorAll(".invalid").forEach(f => f.classList.remove("invalid"));

  const empty = ["sellerName", "sellerPhone", "businessName", "sellerLocation"].map(n => sellerForm[n]).find(f => !f.value.trim());
  if (empty) {
    empty.classList.add("invalid");
    empty.focus();
    return setMessage("Please fill in your name, number, stall, and location.", true);
  }
  if (!phoneOk(sellerForm.sellerPhone.value)) {
    sellerForm.sellerPhone.classList.add("invalid");
    sellerForm.sellerPhone.focus();
    return setMessage("Enter a valid mobile number, like 09123456789.", true);
  }
  if (!sellerForm.querySelector('input[name="produce"]:checked') && !sellerForm.otherProduce.value.trim()) {
    sellerForm.querySelector('input[name="produce"]').focus();
    return setMessage("Pick at least one kind of produce.", true);
  }
  const price = Number(sellerForm.price.value);
  const old = Number(sellerForm.oldPrice.value);
  if (price && old && price >= old) {
    sellerForm.price.classList.add("invalid");
    sellerForm.price.focus();
    return setMessage("The rescue price should be lower than the usual price.", true);
  }

  const btn = sellerForm.querySelector('button[type="submit"]');
  let result;
  btn.disabled = true;
  btn.textContent = "Sending...";
  try {
    result = await submitTo(sellerForm);
  } catch {
    return setMessage("We couldn't send your registration. Check your connection and try again.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Send registration";
  }

  $("successName").textContent = sellerForm.sellerName.value.trim();
  $("successNote").textContent = result === "demo" ? "Demo mode: nothing was saved or sent." : "";
  sellerForm.hidden = true;
  sellerSuccess.hidden = false;
  window.scrollTo({ top: 0 });
});

$("addAnother").addEventListener("click", () => {
  sellerForm.reset();
  setMessage("");
  sellerSuccess.hidden = true;
  sellerForm.hidden = false;
  updateAuthUI();
  updatePreview();
  sellerForm.sellerName.focus();
});

// ---------- CONTACT FORM ----------
const contactForm = $("contactForm");
const contactMsg = $("contactMsg");
const say = (text, isError) => { contactMsg.textContent = text; contactMsg.classList.toggle("error", !!isError); };

contactForm.addEventListener("submit", async event => {
  event.preventDefault();
  say("");
  contactForm.querySelectorAll(".invalid").forEach(f => f.classList.remove("invalid"));
  const bad = (field, text) => { field.classList.add("invalid"); field.focus(); say(text, true); };
  const f = contactForm.elements;

  if (!f.name.value.trim()) return bad(f.name, "Please enter your name.");
  if (!emailOk(f.email.value.trim())) return bad(f.email, "Enter a valid email so we can reply.");
  if (!f.message.value.trim()) return bad(f.message, "Please write a message.");

  try {
    const result = await submitTo(contactForm);
    say(result === "demo" ? "Thanks! (Demo mode: your message wasn't sent.)" : "Thanks! We got your message and will reply by email.");
    contactForm.reset();
  } catch {
    say("We couldn't send your message. Check your connection and try again.", true);
  }
});

// ---------- SHRINKING HEADER ----------
const navbar = document.querySelector(".navbar");
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  if (y > 60) navbar.classList.add("scrolled");
  else if (y < 10) navbar.classList.remove("scrolled");
}, { passive: true });

// ---------- START ----------
seedAdmin();
updateAuthUI();
const startPage = location.hash.slice(1);
showPage(validPages.includes(startPage) ? startPage : "home", false);
renderImpact();
renderProducts();
updatePreview();
