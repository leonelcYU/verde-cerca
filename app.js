const SUPABASE_URL = "https://fgxruntnfbtfvvaqkrto.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Cs0mVLcvlNLMIhyevNgW4A_Y9ShzrT2";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const ingredients = [
  { id: "lechuga", name: "Lechuga", icon: "🥬" }, { id: "choclo", name: "Choclo", icon: "🌽" },
  { id: "apio", name: "Apio", icon: "🌿" }, { id: "tomate", name: "Tomate", icon: "🍅" },
  { id: "pepino", name: "Pepino", icon: "🥒" }, { id: "zanahoria", name: "Zanahoria", icon: "🥕" },
  { id: "repollo", name: "Repollo", icon: "🟣" }, { id: "betarraga", name: "Betarraga", icon: "🫜" },
  { id: "porotos-verdes", name: "Porotos verdes", icon: "🫛" }
];
const unitPrice = 1000;
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(value);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
let quantity = 1;
let selectedIngredients = [];
let ordersChannel = null;
let pageScrollPosition = 0;

function lockPageScroll() {
  if (document.body.classList.contains("modal-open")) return;
  pageScrollPosition = window.scrollY;
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
}

function unlockPageScroll() {
  if (document.querySelector("dialog[open]")) return;
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  window.scrollTo(0, pageScrollPosition);
}

function openModal(dialog) {
  lockPageScroll();
  dialog.showModal();
}

function renderIngredients() {
  $("#ingredientGrid").innerHTML = ingredients.map((item) => `<label class="ingredient-option"><input type="checkbox" value="${item.id}"><span class="ingredient-tile"><b aria-hidden="true">${item.icon}</b><strong>${item.name}</strong><i>✓</i></span></label>`).join("");
  document.querySelectorAll("#ingredientGrid input").forEach((input) => input.addEventListener("change", handleIngredient));
}

function handleIngredient(event) {
  if (event.target.checked && selectedIngredients.length >= 3) { event.target.checked = false; showToast("Puedes elegir un máximo de 3 ingredientes."); return; }
  selectedIngredients = [...document.querySelectorAll("#ingredientGrid input:checked")].map((input) => input.value);
  $("#selectionCount").textContent = `${selectedIngredients.length} de 3`;
  $("#selectionHelp").textContent = selectedIngredients.length ? `Tu mezcla: ${ingredientNames(selectedIngredients).join(" + ")}` : "Selecciona al menos uno para continuar.";
}

function ingredientNames(ids) { return ids.map((id) => ingredients.find((item) => item.id === id)?.name || id); }
function localDate(offset = 0) { const date = new Date(); date.setDate(date.getDate() + offset); return date.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }); }
function setBusy(button, busy, text) { button.disabled = busy; button.dataset.label ||= button.textContent; button.textContent = busy ? text : button.dataset.label; }
function updateTotal() { $("#quantity").value = quantity; $("#orderTotal").textContent = money(unitPrice * quantity); }

function openReservation() {
  quantity = 1; selectedIngredients = [];
  document.querySelectorAll("#ingredientGrid input").forEach((input) => { input.checked = false; });
  $("#selectionCount").textContent = "0 de 3"; $("#selectionHelp").textContent = "Selecciona al menos uno para continuar.";
  $("#pickupDay").innerHTML = `<option value="Hoy — ${localDate(0)}">Hoy — ${localDate(0)}</option><option value="Mañana — ${localDate(1)}">Mañana — ${localDate(1)}</option>`;
  updateTotal(); openModal($("#reserveDialog"));
}

async function submitOrder(event) {
  event.preventDefault();
  if (!selectedIngredients.length) { showToast("Elige al menos un ingrediente."); $("#ingredientGrid input").item(0)?.focus(); return; }
  const button = event.submitter; setBusy(button, true, "Guardando...");
  const tomorrow = $("#pickupDay").selectedIndex === 1;
  const pickupDate = new Date(); pickupDate.setDate(pickupDate.getDate() + (tomorrow ? 1 : 0));
  const order = { ingredients: [...selectedIngredients], unit_price: unitPrice, quantity, customer_name: $("#customerName").value.trim(), phone: $("#phone").value.trim(), pickup_label: $("#pickupDay").value, pickup_date: pickupDate.toLocaleDateString("en-CA"), notes: $("#notes").value.trim() || null };
  const { error } = await db.from("orders").insert(order);
  setBusy(button, false);
  if (error) { console.error(error); showToast("No pudimos guardar la reserva. Intenta nuevamente."); return; }
  $("#reserveDialog").close(); $("#reserveForm").reset(); showToast("¡Reserva confirmada! Te contactaremos por WhatsApp.");
}

async function requestOrdersPanel() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { $("#loginError").textContent = ""; openModal($("#loginDialog")); return; }
  await openOrdersPanel();
}

async function login(event) {
  event.preventDefault(); const button = $("#loginButton"); setBusy(button, true, "Ingresando..."); $("#loginError").textContent = "";
  const { error } = await db.auth.signInWithPassword({ email: $("#adminEmail").value.trim(), password: $("#adminPassword").value });
  setBusy(button, false);
  if (error) { $("#loginError").textContent = "Correo o contraseña incorrectos."; return; }
  $("#loginDialog").close(); $("#adminPassword").value = ""; await openOrdersPanel();
}

async function openOrdersPanel() {
  openModal($("#ordersDialog")); await renderOrders();
  if (ordersChannel) await db.removeChannel(ordersChannel);
  ordersChannel = db.channel("orders-panel").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, renderOrders).subscribe();
}

async function renderOrders() {
  $("#orderList").innerHTML = `<p class="empty">Cargando pedidos...</p>`;
  const { data: orders, error } = await db.from("orders").select("*").order("pickup_date").order("created_at");
  if (error) { console.error(error); $("#orderList").innerHTML = `<p class="empty">No se pudieron cargar los pedidos.</p>`; return; }
  const active = orders.filter((order) => !order.done);
  const totalSalads = active.reduce((sum, order) => sum + order.quantity, 0);
  const sales = active.reduce((sum, order) => sum + order.unit_price * order.quantity, 0);
  $("#orderSummary").innerHTML = `<div class="summary-card"><strong>${active.length}</strong><span>pedidos pendientes</span></div><div class="summary-card"><strong>${totalSalads}</strong><span>ensaladas a preparar</span></div><div class="summary-card"><strong>${money(sales)}</strong><span>venta estimada</span></div>`;
  const totals = {}; active.forEach((order) => order.ingredients.forEach((id) => { totals[id] = (totals[id] || 0) + order.quantity; }));
  const ingredientRows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  $("#ingredientSummary").innerHTML = ingredientRows.length ? `<h3>Ingredientes que necesitarás</h3><div>${ingredientRows.map(([id, count]) => `<span><b>${count}</b> porciones de ${ingredientNames([id])[0]}</span>`).join("")}</div>` : "";
  $("#orderList").innerHTML = orders.length ? orders.map((order) => `<article class="order-item ${order.done ? "done" : ""}"><input class="order-check" type="checkbox" data-order-id="${order.id}" ${order.done ? "checked" : ""}><div><h4>${order.quantity}× ${ingredientNames(order.ingredients).join(" + ")}</h4><p><strong>${escapeHtml(order.customer_name)}</strong> · ${escapeHtml(order.pickup_label)} · ${escapeHtml(order.phone)}${order.notes ? ` · ${escapeHtml(order.notes)}` : ""}</p></div><span class="order-price">${money(order.unit_price * order.quantity)}</span></article>`).join("") : `<p class="empty">Todavía no hay reservas. Los pedidos aparecerán aquí automáticamente.</p>`;
  document.querySelectorAll(".order-check").forEach((check) => check.addEventListener("change", () => toggleOrder(check.dataset.orderId, check.checked)));
}

async function toggleOrder(id, done) { const { error } = await db.from("orders").update({ done }).eq("id", id); if (error) { showToast("No se pudo actualizar el pedido."); await renderOrders(); } }
async function clearCompleted() { const { error } = await db.from("orders").delete().eq("done", true); if (error) showToast("No se pudieron borrar los pedidos."); else { showToast("Pedidos entregados eliminados."); await renderOrders(); } }
async function logout() { if (ordersChannel) await db.removeChannel(ordersChannel); ordersChannel = null; await db.auth.signOut(); $("#ordersDialog").close(); showToast("Sesión cerrada."); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200); }

$("#minus").addEventListener("click", () => { quantity = Math.max(1, quantity - 1); updateTotal(); });
$("#plus").addEventListener("click", () => { quantity = Math.min(10, quantity + 1); updateTotal(); });
$("#reserveForm").addEventListener("submit", submitOrder); $("#loginForm").addEventListener("submit", login); $("#startOrder").addEventListener("click", openReservation);
$("[data-close]").addEventListener("click", () => $("#reserveDialog").close()); $("[data-close-login]").addEventListener("click", () => $("#loginDialog").close()); $("[data-close-orders]").addEventListener("click", () => $("#ordersDialog").close());
$("#openOrders").addEventListener("click", requestOrdersPanel); $("#clearCompleted").addEventListener("click", clearCompleted); $("#logoutButton").addEventListener("click", logout);
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("close", () => requestAnimationFrame(unlockPageScroll)));
$("#year").textContent = new Date().getFullYear(); renderIngredients();
