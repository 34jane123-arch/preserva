/* PRESERVA buyer dashboards (Local Buyer + Business Buyer share this file; role comes from <body data-role>).
   Shared keys: preserva_products, preserva_orders (same shapes as seller/admin), preserva_cart_<userId>.
   FRONTEND DEMO: the `P`, `O` and cart helpers are the only storage code; swap them for API calls later. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const peso = n => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const wr = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---------- access control (UI only; a server must enforce this) ---------- */
  const role = document.body.dataset.role, Auth = window.PreservaAuth, PM = window.PreservaMessages;
  const chk = Auth.requireRole(role);
  if (!chk.ok) {
    if (chk.reason === "login") { location.replace("login.html"); return; }
    $("gateText").textContent = "This dashboard is for " + Auth.ROLES[role].label + " accounts. You are signed in as " + Auth.ROLES[chk.user.role].label + ".";
    $("gateBtn").href = Auth.dashboardFor(chk.user.role); $("dashGate").hidden = false; return;
  }
  const me = chk.user;
  $("dashContent").hidden = false; $("uName").textContent = me.fullName;
  $("pfName").textContent = me.fullName; $("pfUser").textContent = me.username; $("pfEmail").textContent = me.email; $("pfSince").textContent = fmt(me.createdAt);
  $("logoutBtn").addEventListener("click", () => { Auth.logout(); location.assign("index.html"); });
  PM.badges(me.id);

  /* ---------- data layer ---------- */
  const P = { all: () => rd("preserva_products", []), save: l => wr("preserva_products", l) };
  const O = { all: () => rd("preserva_orders", []), save: l => wr("preserva_orders", l) };
  const CK = "preserva_cart_" + me.id, cart = () => rd(CK, []), saveCart = l => { wr(CK, l); $("cartN").textContent = l.length; $("cartN").hidden = !l.length; };
  const ST = { pending: "Pending", accepted: "Accepted", rejected: "Rejected", preparing: "Processing", ready: "Ready for Pickup", completed: "Completed", cancelled: "Cancelled" };
  let _sc = 0, _ss = null; // approved + active sellers, refreshed once per second
  const sellerOk = id => { if (!_ss || Date.now() - _sc > 1000) { _ss = new Set(Auth.approvedSellerIds()); _sc = Date.now(); } return _ss.has(id); };
  const avail = p => (p.status || "approved") === "approved" && p.qty > 0 && sellerOk(p.sellerId); // admin-approved, in stock, from an approved active seller
  const cur = p => p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
  const mineOrders = () => O.all().filter(o => o.buyerId === me.id);
  const find = id => P.all().find(p => p.id === id);
  const toast = t => { const x = $("toast"); x.textContent = t; x.classList.add("show"); setTimeout(() => x.classList.remove("show"), 2400); };
  const pill = (t, k) => `<span class="pill ${k || ""}">${esc(t)}</span>`;
  const table = (h, rows, e) => rows.length ? `<table class="dt"><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : `<p class="empty">${e}</p>`;
  function modal(html, btns, closeLabel) {
    if ($("dlg").open) $("dlg").close();
    $("dlgBody").innerHTML = html; const box = $("dlgBtns"); box.replaceChildren();
    (btns || []).concat([{ label: closeLabel || "Close", ghost: 1 }]).forEach(b => {
      const x = document.createElement("button"); x.type = "button"; x.className = "btn-sm" + (b.ghost ? " ghost" : ""); x.textContent = b.label;
      x.onclick = () => { if (b.fn && b.fn() === false) return; $("dlg").close(); }; box.append(x);
    });
    $("dlg").showModal();
  }
  const partner = (id, name) => ({ id, name: name || "Seller", role: "seller" });

  /* ---------- product cards ---------- */
  function card(p) {
    const d = cur(p) < p.price;
    return `<article class="pcard"><div class="pimg">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : "🥬"}</div><div class="pbody">
      <h3>${esc(p.name)}</h3><div>${pill(p.category)} ${pill(p.freshness, p.freshness === "Fresh" ? "" : "warn")}</div>
      <div class="pprice"><b>${peso(cur(p))}</b>/${esc(p.unit)} ${d ? `<s>${peso(p.price)}</s>` : ""}</div>
      <small>${p.qty} ${esc(p.unit)} left · ${esc(p.sellerName || "Seller")}</small><small>${esc((p.description || "").slice(0, 70))}</small>
      <button class="btn-sm" data-a="view" data-id="${p.id}">View details</button></div></article>`;
  }
  function rBrowse() {
    const q = $("fSearch").value.toLowerCase().trim(), c = $("fCat").value, f = $("fFresh").value, [lo, hi] = ($("fPrice").value || "0-").split("-").map(Number), s = $("fSort").value;
    const list = P.all().filter(p => avail(p) && (!c || p.category === c) && (!f || p.freshness === f) && p.name.toLowerCase().includes(q) && cur(p) >= lo && (!hi || cur(p) <= hi));
    list.sort(s === "low" ? (a, b) => cur(a) - cur(b) : s === "high" ? (a, b) => cur(b) - cur(a) : (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    $("grid").innerHTML = list.length ? list.map(card).join("") : `<p class="empty">No products match. Products appear here once a seller lists them and an admin approves them.</p>`;
  }
  ["fSearch", "fCat", "fFresh", "fPrice", "fSort"].forEach(i => $(i).addEventListener("input", rBrowse));

  /* ---------- cart ---------- */
  function addToCart(id, qty) {
    const p = find(id), l = cart(), line = l.find(x => x.productId === id), have = line ? line.qty : 0;
    if (!p || !avail(p)) return "This product is no longer available.";
    if (!(qty >= 1) || !Number.isInteger(qty)) return "Enter a whole quantity of 1 or more.";
    if (have + qty > p.qty) return `Only ${p.qty} ${p.unit} available${have ? " (" + have + " already in your cart)" : ""}.`;
    if (line) line.qty += qty; else l.push({ productId: id, qty });
    saveCart(l); return "";
  }
  function rCart() {
    const l = cart(); let total = 0, bad = false;
    const rows = l.map(x => { const p = find(x.productId), ok = p && avail(p), qty = ok ? Math.min(x.qty, p.qty) : 0; if (!ok || qty !== x.qty) bad = true; const sub = ok ? qty * cur(p) : 0; total += sub;
      return `<tr><td>${p ? esc(p.name) : "Removed product"}${ok ? "" : "<br>" + pill("No longer available", "bad")}</td><td>${p ? esc(p.sellerName || "Seller") : ""}</td><td>${ok ? peso(cur(p)) : "—"}</td>
        <td>${ok ? `<span class="qty-ctl"><button class="btn-sm ghost" data-a="dec" data-id="${x.productId}">−</button>${x.qty}<button class="btn-sm ghost" data-a="inc" data-id="${x.productId}">+</button></span>` : "—"}</td>
        <td>${peso(sub)}</td><td><button class="btn-sm danger" data-a="rm" data-id="${x.productId}">Remove</button></td></tr>`; });
    $("cartBox").innerHTML = table(["Product", "Seller", "Price", "Qty", "Subtotal", ""], rows, "Your cart is empty. Browse products to add some.") +
      (l.length ? `<p style="text-align:right;font-size:1.1rem">Total: <b>${peso(total)}</b></p><p style="text-align:right">${bad ? '<span class="hint">Remove unavailable items before checkout.</span> ' : ""}<button class="btn" id="checkoutBtn" ${bad ? "disabled" : ""}>Checkout</button></p>` : "");
  }
  let placing = false; // blocks double submission
  function place() {
    if (placing) return; placing = true;
    try {
      const l = cart(), prods = P.all(), orders = O.all(), now = new Date().toISOString(), made = [];
      for (const x of l) { const p = prods.find(y => y.id === x.productId);
        if (!p || !avail(p) || x.qty > p.qty) { toast("Some items are no longer available in that quantity. Please review your cart."); rCart(); return; }
        made.push({ p, x }); }
      made.forEach(({ p, x }, i) => { p.qty -= x.qty;
        orders.push({ id: "o_" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5), sellerId: p.sellerId, sellerName: p.sellerName || "Seller", productId: p.id, productName: p.name, unit: p.unit, qty: x.qty,
          total: x.qty * cur(p), buyerId: me.id, buyerName: me.fullName, buyerType: role, status: "pending", createdAt: now }); });
      P.save(prods); O.save(orders); saveCart([]); toast("Order placed!"); go("orders");
    } finally { placing = false; }
  }

  /* ---------- orders ---------- */
  function rOrders() {
    $("orderTable").innerHTML = table(["Order", "Product", "Seller", "Qty", "Total", "Date", "Status", ""], mineOrders().slice().reverse().map(o =>
      `<tr><td>${esc(o.id.slice(-6).toUpperCase())}</td><td>${esc(o.productName)}</td><td>${esc(o.sellerName || "Seller")}</td><td>${o.qty}${esc(o.unit || "")}</td><td>${peso(o.total)}</td><td>${fmt(o.createdAt)}</td>
      <td>${pill(ST[o.status] || o.status, o.status === "completed" || o.status === "accepted" ? "" : o.status === "rejected" || o.status === "cancelled" ? "bad" : "warn")}</td>
      <td class="row-actions"><button class="btn-sm ghost" data-a="oview" data-id="${o.id}">Details</button>${o.status === "pending" ? `<button class="btn-sm danger" data-a="ocan" data-id="${o.id}">Cancel</button>` : ""}${o.status === "completed" ? (fbOf(o.id) ? pill("Rated " + fbOf(o.id).rating + "★") : `<button class="btn-sm" data-a="rate" data-id="${o.id}">Rate seller</button>`) : ""}<button class="btn-sm ghost" data-a="orep" data-id="${o.id}">Report</button><button class="btn-sm" data-a="contact" data-id="${o.sellerId}" data-n="${esc(o.sellerName || "Seller")}">Contact seller</button></td></tr>`), "You haven't placed any orders yet.");
  }
  function rDash() {
    const os = mineOrders(), week = Date.now() - 7 * 864e5, prods = P.all().filter(avail).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const stats = [[os.length, "Total orders"], [os.filter(o => o.status === "pending").length, "Pending orders"], [os.filter(o => o.status === "completed").length, "Completed orders"]];
    stats.push(role === "business" ? [peso(os.filter(o => !["rejected", "cancelled"].includes(o.status)).reduce((s, o) => s + o.total, 0)), "Total spending"] : [prods.filter(p => +new Date(p.createdAt) > week).length, "Added this week"]);
    $("stats").innerHTML = stats.map(([n, l]) => `<div class="stat-card"><strong>${n}</strong><span>${l}</span></div>`).join("");
    $("newGrid").innerHTML = prods.length ? prods.slice(0, 4).map(card).join("") : `<p class="empty">No products available yet.</p>`;
    $("recentOrders").innerHTML = table(["Product", "Qty", "Total", "Status"], os.slice(-4).reverse().map(o => `<tr><td>${esc(o.productName)}</td><td>${o.qty}</td><td>${peso(o.total)}</td><td>${pill(ST[o.status] || o.status)}</td></tr>`), "No orders yet.");
  }

  /* ---------- navigation ---------- */
  const R = { dashboard: rDash, browse: rBrowse, cart: rCart, orders: rOrders, msgs: () => {}, profile: () => {} };
  const titles = { dashboard: "Dashboard", browse: "Browse Products", cart: "Shopping Cart", orders: "My Orders", msgs: "Messages", profile: "My Profile" };
  let curView = "dashboard";
  function go(v, with_) {
    curView = v;
    document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x.id === "v-" + v));
    document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === v));
    $("viewTitle").textContent = titles[v]; $("sidebar").classList.remove("open"); R[v]();
    if (v === "msgs") PM.mount($("msgHost"), me, with_);
  }
  document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  window.addEventListener("storage", e => { if (curView !== "msgs" && e.key && e.key.startsWith("preserva_") && !e.key.includes("message") && !e.key.includes("conv")) R[curView](); });

  /* ---------- reports and feedback (read by the admin dashboard) ---------- */
  const REASONS = ["Spoiled or not as described", "Wrong price or misleading listing", "Suspicious or fake listing", "Rude or abusive behaviour", "Other"];
  const FB = { all: () => rd("preserva_feedback", []), save: l => wr("preserva_feedback", l) };
  const RP = { all: () => rd("preserva_reports", []), save: l => wr("preserva_reports", l) };
  const fbOf = oid => FB.all().find(f => f.orderId === oid && f.buyerId === me.id);
  const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function reportModal(t) {
    modal(`<h3>Report ${esc(t.label)}</h3><label for="rpReason">Reason</label><select id="rpReason">${REASONS.map(r => `<option>${r}</option>`).join("")}</select>
      <label for="rpText" style="display:block;margin-top:10px">Details</label><textarea id="rpText" rows="3" maxlength="500" placeholder="Tell the admin what happened"></textarea>
      <p id="rpErr" style="color:#b42318;margin:6px 0 0" role="alert"></p>`,
      [{ label: "Send report", fn() {
        const text = $("rpText").value.trim(), reason = $("rpReason").value;
        if (reason === "Other" && !text) { $("rpErr").textContent = "Please describe the problem."; return false; }
        const all = RP.all();
        if (all.some(r => r.status === "open" && r.reporterId === me.id && r.type === t.type && r.targetUserId === t.targetUserId && (r.productId || "") === (t.productId || ""))) { toast("You already reported this. An admin will review it."); return; }
        all.push({ id: rid("r_"), type: t.type, targetUserId: t.targetUserId, productId: t.productId || "", productName: t.productName || "", reporterId: me.id, reporterName: me.fullName,
          reporterRole: role, reason, details: text, status: "open", createdAt: new Date().toISOString() });
        RP.save(all); toast("Report sent to the administrators"); } }], "Cancel");
  }
  function rateModal(o) {
    modal(`<h3>Rate ${esc(o.sellerName || "Seller")}</h3><p>Order ${esc(o.id.slice(-6).toUpperCase())}: ${esc(o.productName)}</p><label for="rtVal">Rating</label>
      <select id="rtVal">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${"★".repeat(n)}${"☆".repeat(5 - n)} (${n})</option>`).join("")}</select>
      <label for="rtText" style="display:block;margin-top:10px">Comment (optional)</label><textarea id="rtText" rows="3" maxlength="400"></textarea>`,
      [{ label: "Submit", fn() {
        const all = FB.all(); if (all.some(f => f.orderId === o.id && f.buyerId === me.id)) { toast("You already rated this order."); return; }
        all.push({ id: rid("f_"), orderId: o.id, buyerId: me.id, buyerName: me.fullName, buyerType: role, sellerId: o.sellerId, sellerName: o.sellerName || "Seller", productName: o.productName,
          rating: Number($("rtVal").value), comment: $("rtText").value.trim(), status: "visible", createdAt: new Date().toISOString() });
        FB.save(all); toast("Thanks for your feedback"); rOrders(); } }], "Cancel");
  }

  /* ---------- actions ---------- */
  const act = {
    view(id) { const p = find(id); if (!p || !avail(p)) return toast("This product is no longer available."), rBrowse();
      modal(`${p.image ? `<img src="${esc(p.image)}" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px">` : ""}<h3>${esc(p.name)}</h3>
        <p>${pill(p.category)} ${pill(p.freshness, p.freshness === "Fresh" ? "" : "warn")}</p><p>${esc(p.description || "No description.")}</p>
        <p><b>${peso(cur(p))}</b>/${esc(p.unit)} ${cur(p) < p.price ? `<s>${peso(p.price)}</s> ${pill(Math.round((1 - cur(p) / p.price) * 100) + "% off")}` : ""}</p>
        <p>Available: <b>${p.qty} ${esc(p.unit)}</b><br>Seller: <b>${esc(p.sellerName || "Seller")}</b></p>
        <label for="dQty">Quantity</label> <input id="dQty" type="number" min="1" max="${p.qty}" value="1" style="width:80px"><p id="dErr" style="color:#b42318;margin:6px 0 0" role="alert"></p>`,
        [{ label: "Add to cart", fn() { const m = addToCart(id, Number($("dQty").value)); if (m) { $("dErr").textContent = m; return false; } toast("Added to cart"); } },
         { label: "Contact seller", fn() { go("msgs", partner(p.sellerId, p.sellerName)); } },
         { label: "Report listing", ghost: 1, fn() { reportModal({ type: "product", targetUserId: p.sellerId, productId: p.id, productName: p.name, label: p.name }); return false; } }]); },
    inc(id) { const m = addToCart(id, 1); if (m) toast(m); rCart(); },
    dec(id) { const l = cart(), x = l.find(y => y.productId === id); if (x && --x.qty < 1) l.splice(l.indexOf(x), 1); saveCart(l); rCart(); },
    rm(id) { saveCart(cart().filter(x => x.productId !== id)); rCart(); },
    oview(id) { const o = mineOrders().find(x => x.id === id);
      modal(`<h3>Order ${esc(o.id.slice(-6).toUpperCase())}</h3><p>Product: <b>${esc(o.productName)}</b></p><p>Seller: <b>${esc(o.sellerName || "Seller")}</b></p><p>Quantity: <b>${o.qty} ${esc(o.unit || "")}</b></p><p>Total: <b>${peso(o.total)}</b></p><p>Placed: <b>${fmt(o.createdAt)}</b></p><p>Status: <b>${ST[o.status] || o.status}</b></p>`); },
    ocan(id) { modal("<p>Cancel this pending order? The items go back on sale.</p>", [{ label: "Cancel order", fn() {
      const os = O.all(), o = os.find(x => x.id === id && x.buyerId === me.id);
      if (!o || o.status !== "pending") { toast("Only pending orders can be cancelled."); rOrders(); return; }
      const ps = P.all(), p = ps.find(x => x.id === o.productId); if (p) { p.qty += o.qty; P.save(ps); }
      o.status = "cancelled"; O.save(os); toast("Order cancelled"); rOrders(); } }], "Keep order"); },
    orep(id) { const o = mineOrders().find(x => x.id === id); if (o) reportModal({ type: "account", targetUserId: o.sellerId, productId: o.productId, productName: o.productName, label: o.sellerName || "seller" }); },
    rate(id) { const o = mineOrders().find(x => x.id === id); if (!o || o.status !== "completed") return toast("You can rate a seller after the order is completed."); rateModal(o); },
    contact(id, b) { go("msgs", partner(id, b.dataset.n)); }
  };
  document.querySelector(".dmain").addEventListener("click", e => {
    if (e.target.id === "checkoutBtn") { const l = cart(), total = l.reduce((s, x) => s + x.qty * cur(find(x.productId) || { price: 0 }), 0);
      return modal(`<h3>Confirm order</h3>${l.map(x => { const p = find(x.productId); return `<p>${esc(p.name)} × ${x.qty} ${esc(p.unit)} = ${peso(x.qty * cur(p))}</p>`; }).join("")}<p><b>Total: ${peso(total)}</b></p><p class="hint">You pay the seller at pickup.</p>`, [{ label: "Place order", fn: place }], "Back"); }
    const b = e.target.closest("[data-a]"); if (b && act[b.dataset.a]) act[b.dataset.a](b.dataset.id, b);
  });

  saveCart(cart()); go("dashboard");
})();
