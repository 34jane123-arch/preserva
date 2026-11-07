/* PRESERVA admin dashboard (FRONTEND DEMO).
   Users come from PreservaAuth (auth.js). Products, orders, reports and feedback use the shared localStorage keys below.
   Every number on the dashboard is calculated from that stored data. Nothing is hard-coded.
   Replace the `repo` bodies and the Auth calls with API requests when your backend exists. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rd = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const mk = k => ({ all: () => rd(k), save: l => localStorage.setItem(k, JSON.stringify(l)) });
  const repo = { products: mk("preserva_products"), orders: mk("preserva_orders"), reports: mk("preserva_reports"), feedback: mk("preserva_feedback") };
  const peso = n => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const fmtT = iso => iso ? new Date(iso).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  /* ---------- access control (UI only; the server must enforce this for real) ---------- */
  const Auth = window.PreservaAuth, chk = Auth.requireRole("admin");
  if (!chk.ok) { // not signed in -> admin login; signed in as someone else -> their own dashboard
    location.replace(chk.reason === "login" ? "login.html#admin" : Auth.dashboardFor(chk.user.role));
    return;
  }
  const me = chk.user;
  const guard = () => { if (Auth.requireRole("admin").ok) return true; location.replace("login.html#admin"); return false; }; // re-checked before every change
  $("dashContent").hidden = false;
  $("uName").textContent = me.fullName;
  $("pfName").textContent = me.fullName; $("pfUser").textContent = me.username; $("pfEmail").textContent = me.email; $("pfSince").textContent = fmt(me.createdAt);
  const log = (action, detail) => Auth.logActivity(action, detail);

  let users = [];
  const load = () => (users = Auth.listUsers());
  const uname = id => (users.find(u => u.id === id) || {}).fullName || "Unknown";
  const prods = () => repo.products.all();
  const orders = () => repo.orders.all().filter(o => !o.demo); // demo orders from the seller screen never count
  const prodSt = p => p.status || "approved";
  const ST = { pending: "Pending", accepted: "Accepted", rejected: "Rejected", preparing: "Processing", ready: "Ready for Pickup", completed: "Completed", cancelled: "Cancelled" };
  const CATS = ["Fruits", "Vegetables", "Fish", "Others"], FRESH = ["Fresh", "Not So Fresh", "Unsold Yesterday", "Damaged but Still Usable"];
  const TYPE = { product: "Listing", account: "Account", message: "Message" };
  $("oStatus").insertAdjacentHTML("beforeend", Object.entries(ST).map(([k, v]) => `<option value="${k}">${v}</option>`).join(""));

  const toast = t => { const x = $("toast"); x.textContent = t; x.classList.add("show"); setTimeout(() => x.classList.remove("show"), 2400); };
  const table = (heads, rows, empty) => rows.length
    ? `<table class="dt"><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : `<p class="empty">${empty}</p>`;
  const pill = (t, k) => `<span class="pill ${k || ""}">${esc(t)}</span>`;
  const btn = (label, a, id, cls, extra) => `<button class="btn-sm ${cls || ""}" data-a="${a}" data-id="${esc(id)}" ${extra || ""}>${label}</button>`;
  const stars = n => "★".repeat(n) + "☆".repeat(5 - n);
  const avg = l => l.length ? l.reduce((s, f) => s + f.rating, 0) / l.length : 0;
  const visFb = () => repo.feedback.all().filter(f => f.status !== "hidden");

  function modal(html, btns, closeLabel) {
    if ($("dlg").open) $("dlg").close();
    $("dlgBody").innerHTML = html;
    const box = $("dlgBtns"); box.replaceChildren();
    (btns || []).concat([{ label: closeLabel || "Close", ghost: 1 }]).forEach(b => {
      const x = document.createElement("button");
      x.type = "button"; x.className = "btn-sm" + (b.cls ? " " + b.cls : "") + (b.ghost ? " ghost" : ""); x.textContent = b.label;
      x.onclick = () => { if (b.fn) { if (!guard()) return; if (b.fn() === false) return; } $("dlg").close(); };
      box.append(x);
    });
    $("dlg").showModal();
  }
  const confirmDo = (msg, fn, label) => modal(`<p>${esc(msg)}</p>`, [{ label: label || "Confirm", cls: "danger", fn }], "Cancel");
  const details = rows => "<dl>" + rows.map(([k, v]) => `<p><b>${esc(k)}:</b> ${v}</p>`).join("") + "</dl>";

  /* ---------- charts (plain HTML, no library) ---------- */
  const bars = items => { const max = Math.max(1, ...items.map(i => i[1]));
    return `<div class="bars">${items.map(([l, v]) => `<div class="bar"><b>${v}</b><i style="height:${v / max * 100}px"></i><span>${esc(l)}</span></div>`).join("")}</div>`; };
  function months6() { const n = new Date(), out = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
      out.push([d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), d.toLocaleString("en", { month: "short" })]); } return out; }
  const monthly = (list, f) => months6().map(([k, l]) => [l, list.filter(x => (f(x) || "").slice(0, 7) === k).length]);
  const catCounts = list => CATS.map(c => [c, list.filter(p => (p.category || "Others") === c).length]);
  const notAdmin = () => users.filter(u => u.role !== "admin");

  /* ---------- 1. dashboard overview ---------- */
  function rDash() {
    load(); const P = prods(), O = orders(), R = repo.reports.all(), ok = new Set(Auth.approvedSellerIds());
    const buyers = users.filter(u => u.role === "local" || u.role === "business"), vendors = users.filter(u => u.role === "seller");
    const live = p => prodSt(p) === "approved" && p.qty > 0 && ok.has(p.sellerId);
    const sold = O.filter(o => o.status === "completed").reduce((s, o) => s + o.qty, 0);
    const reported = new Set(R.filter(r => r.type === "product" && r.productId).map(r => r.productId)).size;
    const card = ([v, l]) => `<div class="stat-card"><strong>${v}</strong><span>${l}</span></div>`;
    $("stats").innerHTML = [[buyers.length, "Registered users (buyers)"], [vendors.length, "Registered vendors"], [P.length, "Product listings"],
      [P.filter(live).length, "Available products"], [sold, "Sold products (completed orders)"], [reported, "Reported listings"]].map(card).join("");
    $("stats2").innerHTML = [[vendors.filter(v => v.vendorStatus === "pending").length, "Vendors awaiting approval"], [P.filter(p => prodSt(p) === "pending").length, "Listings awaiting approval"],
      [R.filter(r => r.status === "open").length, "Open reports"], [O.length, "Total orders"]].map(card).join("");
    $("chUsers").innerHTML = bars(monthly(notAdmin(), u => u.createdAt));
    $("chProds").innerHTML = bars(monthly(P, p => p.createdAt));
    $("chTx").innerHTML = bars(monthly(O.filter(o => o.status === "completed"), o => o.createdAt));
    $("chCat").innerHTML = bars(catCounts(P));
  }

  /* ---------- 2. users ---------- */
  const statusPill = u => pill(u.status, u.status === "active" ? "" : u.status === "suspended" ? "bad" : "warn");
  const statusBtns = u => u.role === "admin" ? "" : (u.status === "active"
    ? btn("Deactivate", "ust", u.id, "ghost", 'data-s="deactivated"') + btn("Suspend", "ust", u.id, "danger", 'data-s="suspended"')
    : btn("Activate", "ust", u.id, "", 'data-s="active"'));
  function rUsers() {
    load(); const q = $("uSearch").value.toLowerCase().trim(), r = $("uRole").value, s = $("uStatus").value;
    const list = users.filter(u => u.role !== "seller" && (!r || u.role === r) && (!s || u.status === s) && [u.fullName, u.username, u.email].join(" ").toLowerCase().includes(q));
    $("userTable").innerHTML = table(["Name", "Username", "Email", "Type", "Registered", "Status", "Actions"], list.map(u =>
      `<tr><td>${esc(u.fullName)}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${pill(Auth.ROLES[u.role].label)}</td><td>${fmt(u.createdAt)}</td><td>${statusPill(u)}</td>
        <td class="row-actions">${btn("View", "uview", u.id, "ghost")}${statusBtns(u)}${u.role === "admin" ? "" : btn("Permissions", "uperm", u.id, "ghost")}</td></tr>`), "No users match your search.");
  }

  /* ---------- 3. vendors ---------- */
  function rVendors() {
    load(); const q = $("vSearch").value.toLowerCase().trim(), a = $("vApproval").value, s = $("vStatus").value, P = prods(), fb = visFb();
    const list = users.filter(u => u.role === "seller" && (!a || u.vendorStatus === a) && (!s || u.status === s) && [u.fullName, u.username, u.email].join(" ").toLowerCase().includes(q))
      .sort((x, y) => (y.vendorStatus === "pending") - (x.vendorStatus === "pending"));
    $("vendorTable").innerHTML = table(["Vendor", "Email", "Registered", "Registration", "Account", "Products", "Rating", "Actions"], list.map(u => {
      const f = fb.filter(x => x.sellerId === u.id), vs = u.vendorStatus;
      return `<tr><td>${esc(u.fullName)}<br><small>@${esc(u.username)}</small></td><td>${esc(u.email)}</td><td>${fmt(u.createdAt)}</td>
        <td>${pill(vs, vs === "approved" ? "" : vs === "rejected" ? "bad" : "warn")}</td><td>${statusPill(u)}</td><td>${P.filter(p => p.sellerId === u.id).length}</td>
        <td>${f.length ? `<span class="stars">★</span> ${avg(f).toFixed(1)} <small>(${f.length})</small>` : "—"}</td>
        <td class="row-actions">${btn("Review", "vview", u.id, "ghost")}${vs !== "approved" ? btn("Approve", "vapp", u.id) : ""}${vs !== "rejected" ? btn("Reject", "vrej", u.id, "ghost") : ""}${statusBtns(u)}</td></tr>`;
    }), "No vendors match. Vendors appear here after they sign up as a Seller.");
  }

  /* ---------- 4. products ---------- */
  const reportCount = id => repo.reports.all().filter(r => r.productId === id && r.status === "open").length;
  function rProducts() {
    load(); const q = $("pSearch").value.toLowerCase().trim(), c = $("pCat").value, f = $("pFresh").value, s = $("pStatus").value;
    const list = prods().filter(p => (!c || p.category === c) && (!f || p.freshness === f) && (!s || prodSt(p) === s) && [p.name, p.sellerName, uname(p.sellerId)].join(" ").toLowerCase().includes(q));
    $("prodTable").innerHTML = table(["", "Product", "Vendor", "Category", "Price", "Quantity", "Freshness", "Posted", "Status", "Actions"], list.slice().reverse().map(p => {
      const st = prodSt(p), d = p.discountPrice && p.discountPrice < p.price, rc = reportCount(p.id);
      return `<tr><td>${p.image ? `<img src="${esc(p.image)}" alt="">` : "🥬"}</td><td>${esc(p.name)}${rc ? `<br>${pill(rc + " report" + (rc > 1 ? "s" : ""), "bad")}` : ""}</td><td>${esc(p.sellerName || uname(p.sellerId))}</td><td>${esc(p.category)}</td>
        <td>${peso(d ? p.discountPrice : p.price)}${d ? `<br><s>${peso(p.price)}</s>` : ""}</td><td>${p.qty} ${esc(p.unit)}</td><td>${pill(p.freshness, p.freshness === "Fresh" ? "" : "warn")}</td><td>${fmt(p.createdAt)}</td>
        <td>${pill(st, st === "approved" ? "" : st === "rejected" ? "bad" : "warn")}</td>
        <td class="row-actions">${btn("View", "pview", p.id, "ghost")}${btn("Edit", "pedit", p.id, "ghost")}${st !== "approved" ? btn("Approve", "pset", p.id, "", 'data-s="approved"') : ""}${st !== "rejected" ? btn("Reject", "pset", p.id, "ghost", 'data-s="rejected"') : ""}${btn("Remove", "prem", p.id, "danger")}</td></tr>`;
    }), "No products match. Vendors add products from their dashboard.");
  }

  function rOrders() {
    load(); const q = $("oSearch").value.toLowerCase().trim(), s = $("oStatus").value;
    const list = orders().filter(o => (!s || o.status === s) && [o.id, o.buyerName, uname(o.sellerId), o.productName].join(" ").toLowerCase().includes(q));
    $("orderTable").innerHTML = table(["Order", "Buyer", "Vendor", "Product", "Qty", "Total", "Date", "Status", "Actions"], list.slice().reverse().map(o =>
      `<tr><td>${esc(o.id.slice(-6).toUpperCase())}</td><td>${esc(o.buyerName)}</td><td>${esc(uname(o.sellerId))}</td><td>${esc(o.productName)}</td><td>${o.qty}</td><td>${peso(o.total)}</td><td>${fmt(o.createdAt)}</td>
      <td>${pill(ST[o.status] || o.status, o.status === "completed" ? "" : o.status === "rejected" || o.status === "cancelled" ? "bad" : "warn")}</td>
      <td class="row-actions">${btn("Details", "oview", o.id, "ghost")}${["completed", "rejected", "cancelled"].includes(o.status) ? "" : btn("Cancel", "ocan", o.id, "danger")}</td></tr>`), "No orders yet.");
  }

  /* ---------- 5. reports and feedback ---------- */
  const aboutOf = r => r.type === "product" ? `${esc(r.productName || "Listing")}<br><small>${esc(uname(r.targetUserId))}</small>` : esc(uname(r.targetUserId));
  function rReports() {
    load(); const t = $("rType").value, s = $("rStatus").value;
    $("reportTable").innerHTML = table(["Type", "About", "Reason", "Reported by", "Date", "Status", "Actions"], repo.reports.all().filter(r => (!t || r.type === t) && (!s || r.status === s)).slice().reverse().map(r =>
      `<tr><td>${pill(TYPE[r.type] || r.type)}</td><td>${aboutOf(r)}</td><td>${esc(r.reason)}</td><td>${esc(r.reporterName)}</td><td>${fmt(r.createdAt)}</td>
      <td>${pill(r.status, r.status === "open" ? "warn" : r.status === "dismissed" ? "bad" : "")}</td>
      <td class="row-actions">${btn("Review", "rview", r.id, "ghost")}${r.status === "open" ? btn("Resolve", "rres", r.id) + btn("Dismiss", "rdis", r.id, "ghost") : ""}</td></tr>`), "No reports match. Nothing to moderate right now.");
    const fb = repo.feedback.all(), vis = fb.filter(f => f.status !== "hidden");
    const rows = users.filter(u => u.role === "seller" && vis.some(f => f.sellerId === u.id)).map(v => { const l = vis.filter(f => f.sellerId === v.id); return [v, avg(l), l.length]; }).sort((a, b) => b[1] - a[1]);
    $("ratingTable").innerHTML = table(["Vendor", "Average rating", "Ratings"], rows.map(([v, a, n]) => `<tr><td>${esc(v.fullName)}</td><td><span class="stars">${stars(Math.round(a))}</span> ${a.toFixed(1)}</td><td>${n}</td></tr>`),
      "No ratings yet. Buyers can rate a vendor after a completed order.");
    const q = $("fbSearch").value.toLowerCase().trim(), rt = $("fbRating").value;
    $("fbTable").innerHTML = table(["Date", "Buyer", "Vendor", "Product", "Rating", "Comment", "Status", "Actions"], fb.filter(f => (!rt || String(f.rating) === rt) && [f.buyerName, f.sellerName, f.productName, f.comment].join(" ").toLowerCase().includes(q)).slice().reverse().map(f =>
      `<tr><td>${fmt(f.createdAt)}</td><td>${esc(f.buyerName)}</td><td>${esc(f.sellerName)}</td><td>${esc(f.productName)}</td><td><span class="stars">${stars(f.rating)}</span></td><td>${esc(f.comment || "—")}</td>
      <td>${pill(f.status === "hidden" ? "hidden" : "visible", f.status === "hidden" ? "warn" : "")}</td>
      <td class="row-actions">${btn(f.status === "hidden" ? "Show" : "Hide", "fhide", f.id, "ghost")}${btn("Delete", "fdel", f.id, "danger")}</td></tr>`), "No feedback yet.");
  }

  /* ---------- analytics ---------- */
  function bounds() {
    const v = $("aRange").value, n = new Date(), d0 = +new Date(n.getFullYear(), n.getMonth(), n.getDate());
    if (v === "today") return [d0, Infinity];
    if (v === "week") return [d0 - n.getDay() * 864e5, Infinity];
    if (v === "month") return [+new Date(n.getFullYear(), n.getMonth(), 1), Infinity];
    if (v === "year") return [+new Date(n.getFullYear(), 0, 1), Infinity];
    if (v === "custom") { const f = $("aFrom").value, t = $("aTo").value; return [f ? +new Date(f) : 0, t ? +new Date(t) + 864e5 - 1 : Infinity]; }
    return [0, Infinity];
  }
  let csvRows = [];
  function rAnalytics() {
    load(); const [a, b] = bounds(), inR = x => { const t = +new Date(x); return t >= a && t <= b; };
    const U = notAdmin().filter(u => inR(u.createdAt)), P = prods().filter(p => inR(p.createdAt)), O = orders().filter(o => inR(o.createdAt)), F = visFb().filter(f => inR(f.createdAt));
    const rows = [["New users (buyers and vendors)", U.length], ["Active vendors", users.filter(u => u.role === "seller" && u.status === "active" && u.vendorStatus === "approved").length],
      ["New buyers", U.filter(u => u.role === "local" || u.role === "business").length], ["Product listings", P.length],
      ["Orders", O.length], ["Completed orders", O.filter(o => o.status === "completed").length],
      ["Completed sales value", peso(O.filter(o => o.status === "completed").reduce((s, o) => s + o.total, 0))],
      ["Average vendor rating", F.length ? avg(F).toFixed(1) + " (" + F.length + " ratings)" : "No ratings"]];
    csvRows = [["Metric", "Value"], ...rows, [], ["Category", "Listings"], ...catCounts(P)];
    $("anTable").innerHTML = table(["Metric", "Value"], rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`), "");
    $("anUsers").innerHTML = bars(monthly(notAdmin(), u => u.createdAt));
    $("anProds").innerHTML = bars(monthly(prods(), p => p.createdAt));
    $("anCat").innerHTML = table(["Category", "Listings"], catCounts(P).sort((x, y) => y[1] - x[1]).map(c => `<tr><td>${c[0]}</td><td>${c[1]}</td></tr>`), "");
  }
  $("aRange").addEventListener("change", () => { const c = $("aRange").value === "custom"; $("aFrom").hidden = $("aTo").hidden = !c; rAnalytics(); });
  ["aFrom", "aTo"].forEach(i => $(i).addEventListener("change", rAnalytics));
  $("exportCsv").addEventListener("click", () => {
    if (!guard()) return;
    const csv = csvRows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a"); a.download = "preserva-report.csv";
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.click(); URL.revokeObjectURL(a.href);
    log("Exported report", "Analytics CSV, range: " + $("aRange").value);
  });

  /* ---------- 6. activity logs ---------- */
  function rLogs() {
    const q = $("lSearch").value.toLowerCase().trim();
    const list = Auth.activityLog().filter(x => [x.adminName, x.adminEmail, x.action, x.detail].join(" ").toLowerCase().includes(q));
    $("logTable").innerHTML = table(["Date and time", "Administrator", "Action", "Details"], list.slice(0, 500).map(x =>
      `<tr><td>${fmtT(x.at)}</td><td>${esc(x.adminName)}<br><small>${esc(x.adminEmail)}</small></td><td>${pill(x.action, /fail/i.test(x.action) ? "bad" : "")}</td><td>${esc(x.detail || "—")}</td></tr>`), "No administrator activity recorded yet.") +
      (list.length > 500 ? `<p class="hint">Showing the latest 500 of ${list.length} entries.</p>` : "");
  }

  /* ---------- notifications (built from live data) ---------- */
  const readSet = () => new Set(rd("preserva_admin_read"));
  function notifs() {
    load(); const out = [];
    notAdmin().forEach(u => out.push({ id: "u:" + u.id, at: u.createdAt, text: `New ${Auth.ROLES[u.role].label} registered: ${u.fullName}` }));
    users.filter(u => u.vendorStatus === "pending").forEach(u => out.push({ id: "v:" + u.id, at: u.createdAt, text: `Vendor awaiting approval: ${u.fullName}` }));
    prods().forEach(p => { out.push({ id: "p:" + p.id, at: p.createdAt, text: `New product listed: ${p.name} by ${p.sellerName || uname(p.sellerId)}` });
      if (prodSt(p) === "pending") out.push({ id: "w:" + p.id, at: p.createdAt, text: `Awaiting approval: ${p.name}` }); });
    repo.reports.all().filter(r => r.status === "open").forEach(r => out.push({ id: "r:" + r.id, at: r.createdAt, text: `Reported ${TYPE[r.type] || r.type}: ${r.type === "product" ? r.productName : uname(r.targetUserId)} (${r.reason})` }));
    repo.feedback.all().filter(f => f.rating <= 2 && f.status !== "hidden").forEach(f => out.push({ id: "f:" + f.id, at: f.createdAt, text: `Low rating (${f.rating}★) for ${f.sellerName} from ${f.buyerName}` }));
    return out.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  function rNotifs() {
    const seen = readSet(), l = notifs();
    $("notifList").innerHTML = l.length ? l.map(n => `<div class="notif ${seen.has(n.id) ? "" : "unread"}" data-nid="${esc(n.id)}">${seen.has(n.id) ? "" : "● "}${esc(n.text)} <small>${fmt(n.at)}</small></div>`).join("") : `<p class="empty">No notifications.</p>`;
  }
  $("notifList").addEventListener("click", e => { const n = e.target.closest("[data-nid]"); if (!n) return; const s = readSet(); s.add(n.dataset.nid); localStorage.setItem("preserva_admin_read", JSON.stringify([...s])); refresh(); });
  $("readAll").addEventListener("click", () => { localStorage.setItem("preserva_admin_read", JSON.stringify(notifs().map(n => n.id))); refresh(); });
  function badges() {
    const s = readSet(), c = notifs().filter(n => !s.has(n.id)).length; $("bellN").textContent = c; $("bellN").hidden = !c;
    const pv = users.filter(u => u.vendorStatus === "pending").length, orp = repo.reports.all().filter(r => r.status === "open").length;
    $("vendN").textContent = pv; $("vendN").hidden = !pv; $("repN").textContent = orp; $("repN").hidden = !orp;
    $("pwWarn").hidden = !(Auth.currentUser() || {}).mustChangePassword;
  }
  $("bell").addEventListener("click", () => go("notifs"));

  /* ---------- profile / settings ---------- */
  function avatar() {
    const pic = localStorage.getItem("preserva_admin_pic_" + me.id);
    const h = pic ? `<img class="avatar" src="${pic}" alt="">` : `<span class="avatar">${esc(me.fullName[0])}</span>`;
    $("topAv").innerHTML = h; $("pfAv").innerHTML = h;
  }
  function rSettings() {
    const logins = Auth.activityLog().filter(x => x.adminId === me.id && x.action === "Admin login");
    $("pfLast").textContent = logins[1] ? fmtT(logins[1].at) : "This is your first sign-in";
  }
  $("picIn").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f || !guard()) return; const r = new FileReader();
    r.onload = () => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 120;
      c.getContext("2d").drawImage(i, 0, 0, 120, 120); localStorage.setItem("preserva_admin_pic_" + me.id, c.toDataURL("image/jpeg", .8)); avatar(); log("Changed profile picture", ""); toast("Profile picture saved"); }; i.src = r.result; };
    r.readAsDataURL(f);
  });
  $("pwForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!guard()) return;
    const r = await Auth.changePassword($("pwCur").value, $("pwNew").value, $("pwCf").value);
    $("pwMsg").textContent = r.ok ? "Password updated." : r.error; $("pwMsg").style.color = r.ok ? "var(--dark-green)" : "#b42318"; if (r.ok) { e.target.reset(); badges(); }
  });
  const logout = () => { Auth.logout(); location.assign("index.html"); };
  $("logoutBtn").addEventListener("click", logout); $("logoutBtn2").addEventListener("click", logout);

  /* ---------- navigation ---------- */
  const R = { dashboard: rDash, users: rUsers, vendors: rVendors, products: rProducts, orders: rOrders, reports: rReports, analytics: rAnalytics, logs: rLogs, notifs: rNotifs, settings: rSettings };
  const titles = { dashboard: "Dashboard", users: "User Management", vendors: "Vendor Management", products: "Product Management", orders: "Orders & Transactions", reports: "Reports & Feedback", analytics: "Analytics", logs: "Activity Logs", notifs: "Notifications", settings: "Profile & Settings" };
  let cur = "dashboard";
  const refresh = () => { R[cur](); load(); badges(); };
  function go(v) {
    if (!guard()) return;
    cur = v;
    document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x.id === "v-" + v));
    document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === v));
    $("viewTitle").textContent = titles[v]; $("sidebar").classList.remove("open"); refresh();
  }
  document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  ["uSearch", "uRole", "uStatus", "vSearch", "vApproval", "vStatus", "pSearch", "pCat", "pFresh", "pStatus", "oSearch", "oStatus", "rType", "rStatus", "fbSearch", "fbRating", "lSearch"].forEach(i => $(i).addEventListener("input", refresh));
  $("gSearch").addEventListener("keydown", e => {
    if (e.key !== "Enter") return; const q = e.target.value.trim().toLowerCase(); load();
    const hit = u => [u.fullName, u.username, u.email].join(" ").toLowerCase().includes(q);
    if (users.some(u => u.role === "seller" && hit(u))) { $("vSearch").value = q; go("vendors"); }
    else if (users.some(u => u.role !== "seller" && hit(u))) { $("uSearch").value = q; go("users"); }
    else { $("pSearch").value = q; go("products"); }
  });
  // sign out here too if the session ends in another tab or expires
  window.addEventListener("storage", e => { if (!guard()) return; if (e.key && e.key.startsWith("preserva_")) refresh(); });
  setInterval(guard, 30000);

  /* ---------- actions (each one is written to the activity log) ---------- */
  const setProd = (id, patch) => { const all = repo.products.all(), p = all.find(x => x.id === id); if (p) { Object.assign(p, patch); repo.products.save(all); } };
  const setRep = (id, status) => { const all = repo.reports.all(), r = all.find(x => x.id === id); if (r) { r.status = status; r.handledBy = me.fullName; r.handledAt = new Date().toISOString(); repo.reports.save(all); } };
  const upd = (id, patch) => Auth.adminUpdateUser(id, patch);
  const word = { active: "Activated", deactivated: "Deactivated", suspended: "Suspended" };
  const act = {
    uview(id) { const u = users.find(x => x.id === id), O = orders().filter(o => o.buyerId === id);
      modal(details([["Name", esc(u.fullName)], ["Username", esc(u.username)], ["Email", esc(u.email)], ["Account type", Auth.ROLES[u.role].label], ["Registered", fmt(u.createdAt)], ["Status", u.status],
        ["Can send messages", u.perms.message ? "Yes" : "No"], ...(u.role === "admin" ? [] : [["Orders placed", O.length], ["Total spent", peso(O.filter(o => !["rejected", "cancelled"].includes(o.status)).reduce((s, o) => s + o.total, 0))]])])); },
    ust(id, b) { const s = b.dataset.s, u = users.find(x => x.id === id), verb = { active: "Activate", deactivated: "Deactivate", suspended: "Suspend" }[s];
      confirmDo(`${verb} ${u.fullName}'s account?`, () => { const r = upd(id, { status: s }); if (r.ok) log(word[s] + (u.role === "seller" ? " vendor" : " user"), `${u.fullName} (${u.email})`); toast(r.ok ? "Account " + s : r.error); refresh(); }, verb); },
    uperm(id) { const u = users.find(x => x.id === id);
      modal(`<h3>Permissions: ${esc(u.fullName)}</h3>${u.role === "seller" ? `<p><label><input type="checkbox" id="pmSell" ${u.perms.sell ? "checked" : ""}> Can list products</label></p>` : ""}<p><label><input type="checkbox" id="pmMsg" ${u.perms.message ? "checked" : ""}> Can send messages</label></p>`,
        [{ label: "Save", fn() { const r = upd(id, { perms: { sell: $("pmSell") ? $("pmSell").checked : u.perms.sell, message: $("pmMsg").checked } });
          if (r.ok) log("Changed permissions", `${u.fullName}: listing ${$("pmSell") ? ($("pmSell").checked ? "on" : "off") : "n/a"}, messaging ${$("pmMsg").checked ? "on" : "off"}`); toast(r.ok ? "Permissions saved" : r.error); refresh(); } }], "Cancel"); },
    vview(id) { const u = users.find(x => x.id === id), P = prods().filter(p => p.sellerId === id), O = orders().filter(o => o.sellerId === id), f = visFb().filter(x => x.sellerId === id);
      modal(details([["Name", esc(u.fullName)], ["Username", esc(u.username)], ["Email", esc(u.email)], ["Registered", fmt(u.createdAt)], ["Registration", u.vendorStatus + (u.vendorNote ? " (" + esc(u.vendorNote) + ")" : "")], ["Account status", u.status],
        ["Products listed", P.length], ["Approved products", P.filter(p => prodSt(p) === "approved").length], ["Orders received", O.length], ["Completed sales", peso(O.filter(o => o.status === "completed").reduce((s, o) => s + o.total, 0))],
        ["Rating", f.length ? avg(f).toFixed(1) + " from " + f.length + " rating(s)" : "No ratings yet"], ["Open reports against this vendor", repo.reports.all().filter(r => r.targetUserId === id && r.status === "open").length]])); },
    vapp(id) { const u = users.find(x => x.id === id), r = upd(id, { vendorStatus: "approved" }); if (r.ok) log("Approved vendor", `${u.fullName} (${u.email})`); toast(r.ok ? "Vendor approved" : r.error); refresh(); },
    vrej(id) { const u = users.find(x => x.id === id);
      modal(`<h3>Reject ${esc(u.fullName)}?</h3><label for="vrWhy">Reason (shown to the vendor)</label><textarea id="vrWhy" rows="3" maxlength="300"></textarea>`,
        [{ label: "Reject vendor", cls: "danger", fn() { const why = $("vrWhy").value.trim(), r = upd(id, { vendorStatus: "rejected", vendorNote: why });
          if (r.ok) log("Rejected vendor", `${u.fullName} (${u.email})${why ? ": " + why : ""}`); toast(r.ok ? "Vendor rejected" : r.error); refresh(); } }], "Cancel"); },
    pview(id) { const p = prods().find(x => x.id === id);
      modal((p.image ? `<img src="${esc(p.image)}" alt="" style="max-width:100%;border-radius:10px">` : "") + details([["Product", esc(p.name)], ["Vendor", esc(p.sellerName || uname(p.sellerId))], ["Category", esc(p.category)],
        ["Freshness", esc(p.freshness)], ["Price", peso(p.price) + (p.discountPrice ? " → " + peso(p.discountPrice) : "")], ["Quantity", p.qty + " " + esc(p.unit)], ["Posted", fmt(p.createdAt)], ["Status", prodSt(p)], ["Description", esc(p.description || "—")]])); },
    pset(id, b) { const s = b.dataset.s, p = prods().find(x => x.id === id); setProd(id, { status: s }); log(s === "approved" ? "Approved product" : "Rejected product", `${p.name} by ${p.sellerName || uname(p.sellerId)}`); toast("Listing " + s); refresh(); },
    pedit(id) { const p = prods().find(x => x.id === id);
      modal(`<h3>Edit listing</h3><div class="dform">
        <div class="full"><label for="peName">Name</label><input id="peName" value="${esc(p.name)}"></div>
        <div><label for="peCat">Category</label><select id="peCat">${CATS.map(c => `<option ${c === p.category ? "selected" : ""}>${c}</option>`).join("")}</select></div>
        <div><label for="peFresh">Freshness</label><select id="peFresh">${FRESH.map(c => `<option ${c === p.freshness ? "selected" : ""}>${c}</option>`).join("")}</select></div>
        <div><label for="pePrice">Price (₱)</label><input id="pePrice" type="number" min="1" step="0.01" value="${p.price}"></div>
        <div><label for="peDisc">Discounted (₱)</label><input id="peDisc" type="number" min="1" step="0.01" value="${p.discountPrice || ""}"></div>
        <div><label for="peQty">Quantity</label><input id="peQty" type="number" min="0" value="${p.qty}"></div>
        <div class="full"><label for="peDesc">Description</label><textarea id="peDesc" rows="3">${esc(p.description || "")}</textarea></div>
        <p class="full" id="peErr" style="color:#b42318;margin:0" role="alert"></p></div>`,
        [{ label: "Save changes", fn() {
          const n = $("peName").value.trim(), pr = Number($("pePrice").value), d = Number($("peDisc").value), q = Number($("peQty").value);
          const err = !n ? "Enter a product name." : !(pr > 0) ? "Enter a valid price." : d && d >= pr ? "The discounted price must be lower than the price." : ($("peQty").value === "" || q < 0 || !Number.isInteger(q)) ? "Enter a whole quantity of 0 or more." : "";
          if (err) { $("peErr").textContent = err; return false; }
          setProd(id, { name: n, category: $("peCat").value, freshness: $("peFresh").value, price: pr, discountPrice: d || null, qty: q, description: $("peDesc").value.trim() });
          log("Edited product", `${n} by ${p.sellerName || uname(p.sellerId)}`); toast("Listing updated"); refresh(); } }], "Cancel"); },
    prem(id) { const p = prods().find(x => x.id === id);
      confirmDo(`Permanently remove “${p.name}”? This can't be undone.`, () => { repo.products.save(prods().filter(x => x.id !== id)); log("Removed product", `${p.name} by ${p.sellerName || uname(p.sellerId)}`); toast("Listing removed"); refresh(); }, "Remove"); },
    oview(id) { const o = repo.orders.all().find(x => x.id === id);
      modal(details([["Order", o.id.slice(-6).toUpperCase()], ["Buyer", esc(o.buyerName) + " (" + (o.buyerType === "business" ? "Business" : "Local") + ")"], ["Vendor", esc(uname(o.sellerId))], ["Product", esc(o.productName)],
        ["Quantity", o.qty], ["Total", peso(o.total)], ["Placed", fmt(o.createdAt)], ["Status", ST[o.status] || o.status]])); },
    ocan(id) { confirmDo("Cancel this order? The buyer and vendor will see it as cancelled.", () => {
      const all = repo.orders.all(), o = all.find(x => x.id === id); if (!o.demo) { const ps = prods(), pr = ps.find(x => x.id === o.productId); if (pr) { pr.qty += o.qty; repo.products.save(ps); } }
      o.status = "cancelled"; o.cancelledBy = "admin"; repo.orders.save(all); log("Cancelled order", `${o.id.slice(-6).toUpperCase()}: ${o.productName} for ${o.buyerName}`); toast("Order cancelled"); refresh(); }, "Cancel order"); },
    rview(id) { const r = repo.reports.all().find(x => x.id === id), p = r.productId && prods().find(x => x.id === r.productId), tu = users.find(u => u.id === r.targetUserId && u.role !== "admin"), bs = [];
      if (r.status === "open") bs.push({ label: "Resolve", fn() { setRep(id, "resolved"); log("Resolved report", `${TYPE[r.type]}: ${r.reason}`); toast("Report resolved"); refresh(); } },
        { label: "Dismiss", ghost: 1, fn() { setRep(id, "dismissed"); log("Dismissed report", `${TYPE[r.type]}: ${r.reason}`); toast("Report dismissed"); refresh(); } });
      if (p) bs.push({ label: "Reject listing", ghost: 1, fn() { setProd(p.id, { status: "rejected" }); setRep(id, "resolved"); log("Rejected reported product", p.name); toast("Listing rejected and hidden"); refresh(); } },
        { label: "Remove listing", cls: "danger", fn() { repo.products.save(prods().filter(x => x.id !== p.id)); setRep(id, "resolved"); log("Removed reported product", p.name); toast("Listing removed"); refresh(); } });
      if (tu && tu.status !== "suspended") bs.push({ label: "Suspend account", cls: "danger", fn() { const x = upd(tu.id, { status: "suspended" }); if (x.ok) { setRep(id, "resolved"); log("Suspended reported account", `${tu.fullName} (${tu.email})`); } toast(x.ok ? "Account suspended" : x.error); refresh(); } });
      modal(details([["Type", TYPE[r.type] || r.type], ["Reported", r.type === "product" ? esc(r.productName || "Listing") + (p ? "" : " (no longer listed)") : esc(uname(r.targetUserId))], ["Account", esc(uname(r.targetUserId))], ["Reported by", esc(r.reporterName) + (r.reporterRole ? " (" + esc(r.reporterRole) + ")" : "")],
        ["Reason", esc(r.reason)], ["Details", esc(r.details || "—")], ...(r.excerpt ? [["Reported message", esc(r.excerpt)]] : []), ["Date", fmtT(r.createdAt)], ["Status", r.status + (r.handledBy ? " by " + esc(r.handledBy) : "")]]), bs); },
    rres(id) { const r = repo.reports.all().find(x => x.id === id); setRep(id, "resolved"); log("Resolved report", `${TYPE[r.type]}: ${r.reason}`); toast("Report resolved"); refresh(); },
    rdis(id) { const r = repo.reports.all().find(x => x.id === id); setRep(id, "dismissed"); log("Dismissed report", `${TYPE[r.type]}: ${r.reason}`); toast("Report dismissed"); refresh(); },
    fhide(id) { const all = repo.feedback.all(), f = all.find(x => x.id === id); f.status = f.status === "hidden" ? "visible" : "hidden"; repo.feedback.save(all); log(f.status === "hidden" ? "Hid feedback" : "Restored feedback", `${f.buyerName} about ${f.sellerName}`); refresh(); },
    fdel(id) { const f = repo.feedback.all().find(x => x.id === id);
      confirmDo(`Delete this ${f.rating}-star feedback from ${f.buyerName}? This can't be undone.`, () => { repo.feedback.save(repo.feedback.all().filter(x => x.id !== id)); log("Deleted feedback", `${f.buyerName} about ${f.sellerName}`); toast("Feedback deleted"); refresh(); }, "Delete"); }
  };
  document.querySelector(".dmain").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && guard()) { load(); act[b.dataset.a](b.dataset.id, b); } });

  load(); avatar(); go("dashboard");
})();
