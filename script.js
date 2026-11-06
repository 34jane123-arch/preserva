// ---------- SETTINGS ----------
// Paste your Formspree (or Google Forms proxy) URL to receive real registrations.
// Example: "https://formspree.io/f/abcdwxyz". Leave empty for demo mode.
const FORM_ENDPOINT = "";

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

const peso = n => "₱" + n.toLocaleString("en-PH");
const discount = p => Math.round((1 - p.price / p.oldPrice) * 100);
const hourLabel = h => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

// ---------- PAGE NAVIGATION ----------
const validPages = ["home", "products", "seller", "about"];

function showPage(pageId, moveFocus = true) {
  const target = document.getElementById(pageId);
  if (!target) return;

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  target.classList.add("active");

  document.querySelectorAll("nav [data-page]").forEach(link => {
    const active = link.dataset.page === pageId;
    link.classList.toggle("nav-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  window.scrollTo({ top: 0 });
  if (moveFocus) target.querySelector("h1")?.focus({ preventScroll: true });
}

document.querySelectorAll("[data-page]").forEach(el => {
  el.addEventListener("click", event => {
    event.preventDefault();
    const pageId = el.dataset.page;
    if (location.hash !== "#" + pageId) history.pushState(null, "", "#" + pageId);
    showPage(pageId);
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
  document.getElementById("impactKg").textContent = kg;
  document.getElementById("impactDeals").textContent = products.length;
  document.getElementById("impactSave").textContent = peso(saved);
}

// ---------- PRODUCT LISTINGS ----------
const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const productCount = document.getElementById("productCount");
let activeCategory = "All";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

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
  priceRow.append(
    el("span", "price", `${peso(p.price)} / ${p.unit}`),
    el("s", "old-price", peso(p.oldPrice))
  );

  const meta = el("ul", "meta");
  const qty = el("li", p.qty <= 8 ? "urgent" : "", `${p.qty} ${p.unit === "kg" ? "kg" : "bunches"} left`);
  meta.append(
    qty,
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

// ---------- SELLER REGISTRATION ----------
const sellerForm = document.getElementById("sellerForm");
const formMessage = document.getElementById("formMessage");
const sellerSuccess = document.getElementById("sellerSuccess");
const $ = id => document.getElementById(id);

function setMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", !!isError);
}

// Live preview card
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
  $("pvBadge").textContent = hasDeal
    ? `${Math.round((1 - price / old) * 100)}% off · Sell today`
    : "Sell today";
  $("pvQty").textContent = qty ? `${qty} ${plural} left` : "Quantity left";
  $("pvUntil").textContent = `Pickup until ${hourLabel(Number(sellerForm.until.value))} today`;
  $("pvStall").textContent =
    `${sellerForm.businessName.value.trim() || "Your stall"} · ${sellerForm.sellerLocation.value.trim() || "Your market"}`;
}
sellerForm.addEventListener("input", updatePreview);
sellerForm.addEventListener("change", updatePreview);

sellerForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage("");

  const required = ["sellerName", "sellerPhone", "businessName", "sellerLocation"]
    .map(name => sellerForm[name]);
  sellerForm.querySelectorAll(".invalid").forEach(f => f.classList.remove("invalid"));

  const empty = required.find(f => !f.value.trim());
  if (empty) {
    empty.classList.add("invalid");
    empty.focus();
    return setMessage("Please fill in your name, number, stall, and location.", true);
  }

  const phone = sellerForm.sellerPhone;
  if (!/^(09|\+639)\d{9}$/.test(phone.value.replace(/[\s-]/g, ""))) {
    phone.classList.add("invalid");
    phone.focus();
    return setMessage("Enter a valid mobile number, like 09123456789.", true);
  }

  const hasProduce = sellerForm.querySelector('input[name="produce"]:checked') ||
    sellerForm.otherProduce.value.trim();
  if (!hasProduce) {
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

  const name = sellerForm.sellerName.value.trim();
  const submitBtn = sellerForm.querySelector('button[type="submit"]');

  if (FORM_ENDPOINT) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(sellerForm)
      });
      if (!res.ok) throw new Error(res.status);
    } catch {
      return setMessage("We couldn't send your registration. Check your connection and try again.", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send registration";
    }
  }

  $("successName").textContent = name;
  $("successNote").textContent = FORM_ENDPOINT ? "" : "Demo mode: nothing was saved or sent.";
  sellerForm.hidden = true;
  sellerSuccess.hidden = false;
  window.scrollTo({ top: 0 });
});

$("addAnother").addEventListener("click", () => {
  sellerForm.reset();
  setMessage("");
  updatePreview();
  sellerSuccess.hidden = true;
  sellerForm.hidden = false;
  sellerForm.sellerName.focus();
});

updatePreview();

// ---------- SHRINKING HEADER ----------
const navbar = document.querySelector(".navbar");
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  if (y > 60) navbar.classList.add("scrolled");
  else if (y < 10) navbar.classList.remove("scrolled");
}, { passive: true });

// ---------- START ----------
const startPage = location.hash.slice(1);
showPage(validPages.includes(startPage) ? startPage : "home", false);
renderImpact();
renderProducts();