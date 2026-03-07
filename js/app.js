// ================================================================
// NAILS STUDIO — app.js
// Lógica principal: servicios, reservas, carrito, calendario
// ================================================================

// 🔥 Imports de Firebase (desde el config global)
import { db, auth, provider } from './firebase-config.js';
import { collection, getDocs, addDoc, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ── Constantes de colecciones ─────────────────────────────────
const COL = {
  servicios: 'servicios',
  categorias: 'categorias',
  productos: 'productos',
  reservas: 'reservas',
  bloqueados: 'bloqueados',
  horarios: 'horarios'
};

// ── Estado global ─────────────────────────────────────────────
let allServices = [];
let allCategories = [];
let cart = [];
let selectedDate = null;
let selectedTime = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let blockedSlots = {};

// Horarios por día de semana (0=Dom,1=Lun,...,6=Sab)
const SCHEDULE = {
  1: { open: "09:00", close: "20:00" },
  2: { open: "09:00", close: "20:00" },
  3: { open: "09:00", close: "20:00" },
  4: { open: "09:00", close: "20:00" },
  5: { open: "09:00", close: "20:00" },
  6: { open: "08:00", close: "12:00" },
  0: null
};

// ── Inicialización ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadServices();
  loadProducts();
  renderCalendar();
  console.log('✅ Nails Studio App inicializada');
});

// ── Menú móvil ─────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── TOAST ──────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: '✦' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── CARGAR CATEGORÍAS ──────────────────────────────────────────
async function loadCategories() {
  try {
    const snap = await getDocs(query(collection(db, COL.categorias), orderBy('orden')));
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategoryTabs();
  } catch (e) {
    allCategories = [
      { id: 'manicura', nombre: 'Manicura' },
      { id: 'pedicura', nombre: 'Pedicura' }
    ];
    renderCategoryTabs();
  }
}

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  container.innerHTML = `<button class="cat-tab active" onclick="filterServices('all',this)">Todos</button>`;
  allCategories.forEach(cat => {
    container.innerHTML += `<button class="cat-tab" onclick="filterServices('${cat.id}',this)">${cat.nombre}</button>`;
  });
}

// ── CARGAR SERVICIOS ───────────────────────────────────────────
async function loadServices() {
  try {
    const snap = await getDocs(query(collection(db, COL.servicios), where('activo', '==', true)));
    if (snap.empty) {
      allServices = getDemoServices();
    } else {
      allServices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    renderServices(allServices);
  } catch (e) {
    allServices = getDemoServices();
    renderServices(allServices);
  }
}

function getDemoServices() {
  return [
    { id: 's1', nombre: 'Manicura Tradicional', categoria: 'manicura', precio: 20000, duracion: 45, descripcion: 'Limpieza, corte y esmaltado clásico.', activo: true },
    { id: 's2', nombre: 'Semipermanente Liso', categoria: 'manicura', precio: 45000, duracion: 60, descripcion: 'Esmalte semipermanente de larga duración.', activo: true },
    { id: 's3', nombre: 'Semipermanente Diseño y Apliques', categoria: 'manicura', precio: 50000, duracion: 75, descripcion: 'Semipermanente con diseño personalizado y apliques.', activo: true },
    { id: 's4', nombre: 'Dipping Liso', categoria: 'manicura', precio: 55000, duracion: 90, descripcion: 'Sistema en polvo acrílico liso, muy duradero.', activo: true },
    { id: 's5', nombre: 'Dipping Diseño y Apliques', categoria: 'manicura', precio: 60000, duracion: 100, descripcion: 'Dipping con diseño artístico y apliques decorativos.', activo: true },
    { id: 's6', nombre: 'Kapping Liso', categoria: 'manicura', precio: 65000, duracion: 90, descripcion: 'Kapping liso resistente y natural.', activo: true },
    { id: 's7', nombre: 'Kapping Diseño y Apliques', categoria: 'manicura', precio: 70000, duracion: 110, descripcion: 'Kapping con diseño y apliques a elección.', activo: true },
    { id: 's8', nombre: 'Builder Gel Liso', categoria: 'manicura', precio: 75000, duracion: 100, descripcion: 'Construcción en gel de alta resistencia, liso.', activo: true },
    { id: 's9', nombre: 'Builder Gel Diseño y Apliques', categoria: 'manicura', precio: 80000, duracion: 120, descripcion: 'Builder gel con diseño exclusivo y apliques.', activo: true },
    { id: 's10', nombre: 'Soft Gel', categoria: 'manicura', precio: 80000, duracion: 90, descripcion: 'Gel suave flexible de larga duración.', activo: true },
    { id: 's11', nombre: 'Pedicura Tradicional', categoria: 'pedicura', precio: 25000, duracion: 45, descripcion: 'Limpieza, corte, exfoliación y esmaltado de pies.', activo: true },
    { id: 's12', nombre: 'Pedicura Semipermanente', categoria: 'pedicura', precio: 45000, duracion: 60, descripcion: 'Pedicura completa con esmalte semipermanente.', activo: true },
  ];
}

function renderServices(services) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  if (!services.length) {
    grid.innerHTML = `<p style="color:var(--texto-muted);font-size:0.85rem;">No hay servicios disponibles.</p>`;
    return;
  }
  grid.innerHTML = services.map(s => {
    const inCart = cart.some(c => c.id === s.id);
    const hrs = Math.floor(s.duracion / 60);
    const mins = s.duracion % 60;
    const durLabel = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}min` : ''}` : `${mins} min`;
    const catName = allCategories.find(c => c.id === s.categoria)?.nombre || s.categoria;
    return `
    <div class="service-card" data-cat="${s.categoria}">
      <p class="service-cat-badge">✦ ${catName}</p>
      <p class="service-name">${s.nombre}</p>
      <p class="service-duration">⏱ ${durLabel}</p>
      <p class="service-price">$${Number(s.precio).toLocaleString('es-CO')} <small>COP</small></p>
      <button class="btn-add-service ${inCart ? 'added' : ''}" 
        id="cartBtn-${s.id}"
        onclick="toggleServiceCart('${s.id}')">
        ${inCart ? '✓ Agregado al carrito' : '+ Agregar a mi cita'}
      </button>
    </div>`;
  }).join('');
}

function filterServices(catId, btn) {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = catId === 'all' ? allServices : allServices.filter(s => s.categoria === catId);
  renderServices(filtered);
}

// ── CARRITO ────────────────────────────────────────────────────
function toggleServiceCart(serviceId) {
  const service = allServices.find(s => s.id === serviceId);
  if (!service) return;
  const idx = cart.findIndex(c => c.id === serviceId);
  if (idx > -1) {
    cart.splice(idx, 1);
    showToast(`"${service.nombre}" removido`, 'info');
  } else {
    cart.push({ id: service.id, name: service.nombre, price: service.precio, duration: service.duracion, type: 'service' });
    showToast(`"${service.nombre}" agregado ✦`, 'success');
  }
  updateCartUI();
}

function toggleProductCart(productId, name, price) {
  const idx = cart.findIndex(c => c.id === 'p_' + productId);
  if (idx > -1) {
    cart.splice(idx, 1);
    showToast(`Producto removido`, 'info');
  } else {
    cart.push({ id: 'p_' + productId, name, price, duration: 0, type: 'product' });
    showToast(`"${name}" agregado 🛒`, 'success');
  }
  updateCartUI();
}

function updateCartUI() {
  const count = cart.length;
  const fab = document.getElementById('cartFab');
  const badge = document.getElementById('cartBadge');
  if (fab) fab.style.display = count > 0 ? 'flex' : 'none';
  if (badge) badge.textContent = count;
  allServices.forEach(s => {
    const btn = document.getElementById(`cartBtn-${s.id}`);
    if (btn) {
      const inCart = cart.some(c => c.id === s.id);
      btn.className = `btn-add-service ${inCart ? 'added' : ''}`;
      btn.textContent = inCart ? '✓ Agregado al carrito' : '+ Agregar a mi cita';
    }
  });
}

function openCartModal() {
  const list = document.getElementById('cartItemsList');
  const total = document.getElementById('cartTotalDisplay');
  if (!cart.length) {
    list.innerHTML = `<p style="color:var(--texto-muted);text-align:center;padding:20px;">Tu carrito está vacío</p>`;
    total.textContent = '$0';
  } else {
    list.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">$${Number(item.price).toLocaleString('es-CO')}</span>
        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">✕</button>
      </div>`).join('');
    const sum = cart.reduce((a, b) => a + b.price, 0);
    total.textContent = `$${sum.toLocaleString('es-CO')} COP`;
  }
  openModal('cartModal');
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  updateCartUI();
  openCartModal();
}

// ── PRODUCTOS ──────────────────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  try {
    const snap = await getDocs(query(collection(db, COL.productos), where('activo', '==', true)));
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!products.length) products = getDemoProducts();
    renderProducts(products);
  } catch {
    renderProducts(getDemoProducts());
  }
}

function getDemoProducts() {
  return [
    { id: 'p1', nombre: 'Esmalte Semipermanente', precio: 18000, stock: 15, emoji: '💅', activo: true },
    { id: 'p2', nombre: 'Base Coat Fortalecedor', precio: 22000, stock: 8, emoji: '✨', activo: true },
    { id: 'p3', nombre: 'Top Coat Brillo', precio: 20000, stock: 12, emoji: '🌟', activo: true },
    { id: 'p4', nombre: 'Quitaesmalte sin Acetona', precio: 12000, stock: 0, emoji: '🧴', activo: true },
    { id: 'p5', nombre: 'Kit Lima y Pulidora', precio: 15000, stock: 6, emoji: '🔧', activo: true },
    { id: 'p6', nombre: 'Aceite Cutícula Rosas', precio: 14000, stock: 9, emoji: '🌹', activo: true },
  ];
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img">${p.emoji || '💅'}</div>
      <div class="product-body">
        <p class="product-name">${p.nombre}</p>
        <p class="product-stock ${p.stock === 0 ? 'agotado' : ''}">
          ${p.stock === 0 ? '● Agotado' : `● ${p.stock} disponibles`}
        </p>
        <p class="product-price">$${Number(p.precio).toLocaleString('es-CO')}</p>
        ${p.stock > 0 ? `<button class="btn-add-service" style="margin-top:10px;" onclick="toggleProductCart('${p.id}','${p.nombre}',${p.precio})">+ Comprar</button>` : ''}
      </div>
    </div>`).join('');
}

// ── CALENDARIO ─────────────────────────────────────────────────
function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  const grid = document.getElementById('calGrid');
  if (!label || !grid) return;

  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  label.textContent = `${months[currentMonth]} ${currentYear}`;

  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html = dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0,0,0,0);

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const dow = date.getDay();
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSunday = dow === 0;
    const dateStr = formatDate(date);
    const isSelected = selectedDate === dateStr;

    let cls = 'cal-day';
    if (isPast) cls += ' past';
    else if (isSunday) cls += ' sunday';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';

    const clickable = !isPast && !isSunday;
    html += `<div class="${cls}" ${clickable ? `onclick="selectDate('${dateStr}',${dow})"` : ''}>${d}</div>`;
  }

  grid.innerHTML = html;
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

async function selectDate(dateStr, dow) {
  selectedDate = dateStr;
  selectedTime = null;
  const btnStep1 = document.getElementById('btnStep1');
  if (btnStep1) btnStep1.disabled = true;
  renderCalendar();
  await loadTimeSlots(dateStr, dow);
  const timeSlotsWrap = document.getElementById('timeSlotsWrap');
  if (timeSlotsWrap) timeSlotsWrap.style.display = 'block';
}

async function loadTimeSlots(dateStr, dow) {
  const grid = document.getElementById('timeGrid');
  const schedule = SCHEDULE[dow];
  if (!schedule) { grid.innerHTML = `<p style="color:var(--texto-muted);">Cerrado este día.</p>`; return; }

  const totalDuration = cart.filter(c => c.type === 'service').reduce((a, b) => a + (b.duration || 60), 0) || 60;

  let blocked = [];
  try {
    const docRef = doc(db, COL.bloqueados, dateStr);
    const snap = await getDoc(docRef);
    if (snap.exists) blocked = snap.data().slots || [];
    
    const q = query(collection(db, COL.reservas),
      where('fecha', '==', dateStr),
      where('estado', 'in', ['pendiente', 'confirmada'])
    );
    const rSnap = await getDocs(q);
    rSnap.docs.forEach(d => {
      const r = d.data();
      const slotTime = timeToMinutes(r.hora);
      for (let m = 0; m < r.duracionTotal; m += 30) {
        blocked.push(minutesToTime(slotTime + m));
      }
    });
  } catch (err) {
    console.log('Error loading slots:', err);
  }

  const slots = generateSlots(schedule.open, schedule.close, 30, totalDuration, blocked);
  grid.innerHTML = slots.map(slot => `
    <div class="time-slot ${slot.blocked ? 'blocked' : ''}" 
      ${!slot.blocked ? `onclick="selectTime('${slot.time}',this)"` : ''}>
      ${slot.time}
    </div>`).join('');
}

function generateSlots(open, close, interval, duration, blocked) {
  const slots = [];
  let current = timeToMinutes(open);
  const end = timeToMinutes(close);
  while (current + duration <= end) {
    const timeStr = minutesToTime(current);
    let isBlocked = false;
    for (let m = 0; m < duration; m += 30) {
      if (blocked.includes(minutesToTime(current + m))) { isBlocked = true; break; }
    }
    slots.push({ time: timeStr, blocked: isBlocked });
    current += interval;
  }
  return slots;
}

function selectTime(time, el) {
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  selectedTime = time;
  const btnStep1 = document.getElementById('btnStep1');
  if (btnStep1) btnStep1.disabled = false;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const date = new Date(y, m-1, d);
  return `${days[date.getDay()]}, ${d} de ${months[m-1]} de ${y}`;
}

// ── WIZARD PASOS ───────────────────────────────────────────────
function goStep(step) {
  if (step === 2 && (!selectedDate || !selectedTime)) {
    showToast('Selecciona fecha y hora primero', 'error'); return;
  }
  if (step === 3) {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    if (!name) { showToast('Ingresa tu nombre completo', 'error'); return; }
    if (!phone) { showToast('Ingresa tu número de WhatsApp', 'error'); return; }
    if (!cart.filter(c => c.type === 'service').length) {
      showToast('Agrega al menos un servicio', 'error'); return;
    }
    renderSummary();
  }
  if (step === 2) {
    renderStep2Services();
  }

  [1,2,3].forEach(i => {
    const stepEl = document.getElementById(`step${i}`);
    if (stepEl) stepEl.style.display = i === step ? 'block' : 'none';
    const dot = document.getElementById(`s${i}`);
    if (dot) {
      if (i < step) { dot.className = 'step-num done'; dot.textContent = '✓'; }
      else if (i === step) { dot.className = 'step-num active'; dot.textContent = i; }
      else { dot.className = 'step-num'; dot.textContent = i; }
    }
    if (i < 3) {
      const conn = document.getElementById(`sc${i}`);
      if (conn) conn.className = `step-connector ${i < step ? 'done' : ''}`;
    }
  });

  const labels = ['','Paso 1 de 3 — Elige fecha y hora','Paso 2 de 3 — Tus datos','Paso 3 de 3 — Confirmar reserva'];
  const label = document.getElementById('bookingStepLabel');
  if (label) label.textContent = labels[step];
}

function renderStep2Services() {
  const services = cart.filter(c => c.type === 'service');
  const products = cart.filter(c => c.type === 'product');
  let html = '';
  if (!services.length) html += `<p style="color:var(--error);font-size:0.82rem;">⚠ No has seleccionado ningún servicio. Cierra y agrega desde el catálogo.</p>`;
  services.forEach(s => html += `<div class="cart-item"><span class="cart-item-name">💅 ${s.name}</span><span class="cart-item-price">$${Number(s.price).toLocaleString('es-CO')}</span></div>`);
  products.forEach(p => html += `<div class="cart-item"><span class="cart-item-name">🛒 ${p.name}</span><span class="cart-item-price">$${Number(p.price).toLocaleString('es-CO')}</span></div>`);
  const list = document.getElementById('step2ServicesList');
  if (list) list.innerHTML = html;
}

function renderSummary() {
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const total = cart.reduce((a, b) => a + b.price, 0);

  const summaryDateTime = document.getElementById('summaryDateTime');
  const summaryClient = document.getElementById('summaryClient');
  const summaryTotal = document.getElementById('summaryTotal');
  const summaryServices = document.getElementById('summaryServices');

  if (summaryDateTime) summaryDateTime.textContent = `${formatDateDisplay(selectedDate)} a las ${selectedTime}`;
  if (summaryClient) summaryClient.textContent = `${name} · ${phone}`;
  if (summaryTotal) summaryTotal.textContent = `$${total.toLocaleString('es-CO')} COP`;

  const svcHtml = cart.map(c => `<p style="color:var(--texto);font-size:0.85rem;margin-bottom:3px;">• ${c.name} — $${Number(c.price).toLocaleString('es-CO')}</p>`).join('');
  if (summaryServices) summaryServices.innerHTML = svcHtml;
}

// ── CONFIRMAR RESERVA ──────────────────────────────────────────
async function confirmBooking() {
  const btn = document.getElementById('btnConfirm');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const notes = document.getElementById('clientNotes').value.trim();
  const fileInput = document.getElementById('paymentProof');
  const services = cart.filter(c => c.type === 'service');
  const products = cart.filter(c => c.type === 'product');
  const totalDuration = services.reduce((a, b) => a + (b.duration || 60), 0);
  const totalPrice = cart.reduce((a, b) => a + b.price, 0);

  try {
    let paymentUrl = null;
    if (fileInput && fileInput.files[0]) {
      paymentUrl = 'pendiente-envio-whatsapp';
    }

    const reservaData = {
      nombre: name,
      telefono: phone,
      fecha: selectedDate,
      hora: selectedTime,
      servicios: services.map(s => ({ id: s.id, nombre: s.name, precio: s.price, duracion: s.duration })),
      productos: products.map(p => ({ id: p.id, nombre: p.name, precio: p.price })),
      duracionTotal: totalDuration,
      totalPrecio: totalPrice,
      notas: notes,
      comprobante: paymentUrl,
      estado: 'pendiente',
      creadoEn: new Date().toISOString()
    };

    await addDoc(collection(db, COL.reservas), reservaData);

    sendWhatsAppConfirmation({
      name, phone, date: selectedDate, time: selectedTime,
      services, products, total: totalPrice,
      hasProof: !!(fileInput && fileInput.files[0])
    });

    showToast('¡Reserva confirmada! 🎉 Revisa tu WhatsApp para detalles.', 'success');
    
    cart = [];
    updateCartUI();
    selectedDate = null;
    selectedTime = null;
    const timeSlotsWrap = document.getElementById('timeSlotsWrap');
    if (timeSlotsWrap) timeSlotsWrap.style.display = 'none';
    closeModal('bookingModal');
    
    const clientName = document.getElementById('clientName');
    const clientPhone = document.getElementById('clientPhone');
    const clientNotes = document.getElementById('clientNotes');
    const paymentProof = document.getElementById('paymentProof');
    const filePreview = document.getElementById('filePreview');
    
    if (clientName) clientName.value = '';
    if (clientPhone) clientPhone.value = '';
    if (clientNotes) clientNotes.value = '';
    if (paymentProof) paymentProof.value = '';
    if (filePreview) filePreview.style.display = 'none';

  } catch (e) {
    console.error('Error confirmBooking:', e);
    showToast('Error al guardar. Verifica tu conexión e intenta de nuevo.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✦ Confirmar Cita';
    }
  }
}

function sendWhatsAppConfirmation(data) {
  const businessPhone = '573001234567'; // ← CAMBIA POR TU NÚMERO REAL
  const dateDisplay = formatDateDisplay(data.date);
  
  const svcList = data.services.map(s => `• ${s.nombre} ($${Number(s.precio).toLocaleString('es-CO')})`).join('%0A');
  const prodList = data.products.length 
    ? `%0A%0A🛒 *Productos:*%0A` + data.products.map(p => `• ${p.nombre} ($${Number(p.precio).toLocaleString('es-CO')})`).join('%0A') 
    : '';

  let businessMsg = `✨ *NUEVA RESERVA — Nails Studio*%0A%0A` +
    `👤 *Cliente:* ${data.name}%0A` +
    `📱 *Teléfono:* ${data.phone}%0A` +
    `📅 *Fecha:* ${dateDisplay}%0A` +
    `🕐 *Hora:* ${data.time}%0A%0A` +
    `💅 *Servicios:*%0A${svcList}${prodList}%0A%0A` +
    `💰 *Total:* $${Number(data.total).toLocaleString('es-CO')} COP`;

  if (data.hasProof) {
    businessMsg += `%0A%0A📎 *El cliente adjuntará comprobante de pago en el siguiente mensaje.*`;
  }

  const businessURL = `https://wa.me/${businessPhone}?text=${businessMsg}`;
  
  if (data.hasProof) {
    setTimeout(() => {
      alert('✅ Reserva guardada. Ahora envía tu comprobante de pago por WhatsApp al negocio.');
      window.open(businessURL, '_blank');
    }, 500);
  } else {
    window.open(businessURL, '_blank');
  }

  const clientMsg = `✨ *¡Tu cita está reservada en Nails Studio!* ✨%0A%0A` +
    `👤 *Hola ${data.name}, tu reserva:*%0A` +
    `📅 *Fecha:* ${dateDisplay}%0A` +
    `🕐 *Hora:* ${data.time}%0A` +
    `💅 *Servicios:* ${data.services.map(s => s.nombre).join(', ')}%0A%0A` +
    `📍 *Dirección:* Diagonal 67 # 3-57, Barrio Los Muiscas, Tunja, Boyacá%0A%0A` +
    `⚠️ *Política:* Cancela hasta 2 horas antes sin costo.%0A` +
    `📲 Cualquier cambio, escríbenos por este medio. ¡Te esperamos! 💅`;

  const clientPhone = data.phone.replace(/\D/g, '');
  if (clientPhone.length >= 10) {
    setTimeout(() => {
      window.open(`https://wa.me/57${clientPhone}?text=${clientMsg}`, '_blank');
    }, 2000);
  }
}

// ── MODALES ────────────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function openBookingModal() {
  goStep(1);
  openModal('bookingModal');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── FILE PREVIEW ───────────────────────────────────────────────
function previewFile(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      const previewImg = document.getElementById('filePreviewImg');
      const filePreview = document.getElementById('filePreview');
      if (previewImg) previewImg.src = e.target.result;
      if (filePreview) {
        filePreview.style.display = 'flex';
        filePreview.style.alignItems = 'center';
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

window.addEventListener('scroll', () => {
  const header = document.querySelector('.site-header');
  if (header) {
    if (window.scrollY > 50) header.style.background = 'rgba(13,11,9,0.98)';
    else header.style.background = 'rgba(13,11,9,0.92)';
  }
});

// ── EXPORTAR FUNCIONES GLOBALES ────────────────────────────────
window.toggleServiceCart = toggleServiceCart;
window.toggleProductCart = toggleProductCart;
window.removeFromCart = removeFromCart;
window.openCartModal = openCartModal;
window.filterServices = filterServices;
window.selectTime = selectTime;
window.selectDate = selectDate;
window.changeMonth = changeMonth;
window.goStep = goStep;
window.confirmBooking = confirmBooking;
window.openModal = openModal;
window.closeModal = closeModal;
window.openBookingModal = openBookingModal;
window.previewFile = previewFile;
window.toggleMenu = toggleMenu;