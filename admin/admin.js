// ================================================================
// NAILS STUDIO — admin.js
// Panel de administración completo
// ================================================================

let adminCategories = [];
let currentBlockDate = null;
let blockSlotState = {};

// ── AUTH ───────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    initAdmin();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  }
});

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) { showToast('Completa todos los campos', 'error'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    showToast('Credenciales incorrectas', 'error');
  }
}

async function doLogout() {
  await auth.signOut();
  showToast('Sesión cerrada', 'info');
}

function initAdmin() {
  loadDashboard();
  loadAdminCategories();
}

// ── NAVEGACIÓN ─────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');

  const loaders = {
    dashboard: loadDashboard,
    reservas: loadReservas,
    servicios: loadAdminServicios,
    categorias: loadAdminCategorias,
    productos: loadAdminProductos,
    horarios: loadHorarios,
    bloqueados: () => {}
  };
  loaders[page]?.();
}

// ── TOAST ──────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: '✦' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ── DASHBOARD ──────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const snap = await db.collection(COL.reservas).get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const hoy = new Date().toISOString().split('T')[0];

    document.getElementById('statTotal').textContent = all.length;
    document.getElementById('statPendientes').textContent = all.filter(r => r.estado === 'pendiente').length;
    document.getElementById('statHoy').textContent = all.filter(r => r.fecha === hoy).length;
    const ingresos = all.filter(r => r.estado !== 'cancelada').reduce((a, b) => a + (b.totalPrecio || 0), 0);
    document.getElementById('statIngresos').textContent = `$${ingresos.toLocaleString('es-CO')}`;

    const proximas = all
      .filter(r => r.fecha >= hoy && r.estado !== 'cancelada')
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
      .slice(0, 6);

    document.getElementById('proximas').innerHTML = proximas.length
      ? `<table class="data-table">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Servicios</th><th>Estado</th></tr></thead>
          <tbody>${proximas.map(r => `
            <tr>
              <td>${formatDateDisplay(r.fecha)}</td>
              <td style="color:var(--dorado)">${r.hora}</td>
              <td>${r.nombre}<br><span style="font-size:0.75rem;color:var(--texto-muted)">${r.telefono}</span></td>
              <td style="font-size:0.8rem">${(r.servicios||[]).map(s=>s.nombre).join(', ')}</td>
              <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : `<p style="color:var(--texto-muted);font-size:0.85rem;">No hay próximas reservas.</p>`;
  } catch (e) { console.error(e); }
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${months[m-1]} ${y}`;
}

// ── RESERVAS ───────────────────────────────────────────────────
async function loadReservas() {
  const tbody = document.getElementById('reservasTbody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--texto-muted);padding:20px;">Cargando...</td></tr>`;
  try {
    let query = db.collection(COL.reservas).orderBy('fecha', 'desc');
    const snap = await query.get();
    let reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const estado = document.getElementById('filterEstado').value;
    const fecha = document.getElementById('filterFecha').value;
    if (estado) reservas = reservas.filter(r => r.estado === estado);
    if (fecha) reservas = reservas.filter(r => r.fecha === fecha);

    if (!reservas.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay reservas.</td></tr>`;
      return;
    }

    tbody.innerHTML = reservas.map(r => `
      <tr>
        <td>${formatDateDisplay(r.fecha)}<br><span style="color:var(--dorado);font-weight:600;">${r.hora}</span></td>
        <td>
          <strong>${r.nombre}</strong><br>
          <a href="https://wa.me/${r.telefono?.replace(/\D/g,'')}" target="_blank" 
            style="color:var(--success);font-size:0.78rem;text-decoration:none;">
            📱 ${r.telefono}
          </a>
        </td>
        <td style="font-size:0.78rem;max-width:180px;">
          ${(r.servicios||[]).map(s=>`<span style="display:block;">💅 ${s.nombre}</span>`).join('')}
          ${(r.productos||[]).map(p=>`<span style="display:block;color:var(--texto-muted);">🛒 ${p.nombre}</span>`).join('')}
          ${r.notas ? `<em style="color:var(--texto-muted);font-size:0.72rem;">"${r.notas}"</em>` : ''}
        </td>
        <td style="color:var(--dorado);font-weight:600;">$${(r.totalPrecio||0).toLocaleString('es-CO')}</td>
        <td>${r.comprobante 
          ? `<img class="reserva-img" src="${r.comprobante}" onclick="verComprobante('${r.comprobante}')" title="Ver comprobante">` 
          : `<span style="color:var(--texto-muted);font-size:0.75rem;">Sin soporte</span>`}</td>
        <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
        <td>
          <div class="table-actions">
            ${r.estado === 'pendiente' ? `<button class="btn btn-sm" style="background:rgba(123,174,127,0.15);color:var(--success);border:1px solid var(--success);" onclick="cambiarEstado('${r.id}','confirmada')">✓</button>` : ''}
            ${r.estado !== 'cancelada' ? `<button class="btn btn-sm btn-danger" onclick="cancelarReserva('${r.id}','${r.nombre}','${r.telefono}','${r.fecha}','${r.hora}')">✕</button>` : ''}
            <button class="btn btn-sm btn-outline" onclick="notificarCliente('${r.telefono}','${r.nombre}','${r.fecha}','${r.hora}')">📱</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

function verComprobante(url) {
  document.getElementById('comprobanteImg').src = url;
  openModal('comprobanteModal');
}

async function cambiarEstado(id, nuevoEstado) {
  try {
    await db.collection(COL.reservas).doc(id).update({ estado: nuevoEstado });
    showToast(`Reserva ${nuevoEstado} ✓`, 'success');
    loadReservas();
  } catch { showToast('Error al actualizar', 'error'); }
}

async function cancelarReserva(id, nombre, telefono, fecha, hora) {
  if (!confirm(`¿Cancelar la cita de ${nombre} el ${fecha} a las ${hora}?`)) return;
  try {
    await db.collection(COL.reservas).doc(id).update({ estado: 'cancelada' });
    // Notificar al cliente por WhatsApp
    const msg = `Hola ${nombre}, lamentamos informarte que tu cita en Nails Studio del ${fecha} a las ${hora} ha sido cancelada. Por favor contáctanos para reagendar. 💅`;
    window.open(`https://wa.me/${telefono?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
    showToast('Reserva cancelada', 'info');
    loadReservas();
    loadDashboard();
  } catch { showToast('Error', 'error'); }
}

function notificarCliente(telefono, nombre, fecha, hora) {
  const msg = `Hola ${nombre} 💅 Te recordamos tu cita en Nails Studio el ${fecha} a las ${hora}. Diagonal 67 #3-57, Barrio Los Muiscas, Tunja. ¡Te esperamos!`;
  window.open(`https://wa.me/${telefono?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── CATEGORÍAS ─────────────────────────────────────────────────
async function loadAdminCategories() {
  try {
    const snap = await db.collection(COL.categorias).orderBy('orden').get();
    adminCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    adminCategories = [{ id: 'manicura', nombre: 'Manicura', orden: 1 }, { id: 'pedicura', nombre: 'Pedicura', orden: 2 }];
  }
  // Actualizar select de servicios
  const sel = document.getElementById('servicioCategoria');
  if (sel) {
    sel.innerHTML = `<option value="">Selecciona...</option>` +
      adminCategories.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }
}

async function loadAdminCategorias() {
  await loadAdminCategories();
  const list = document.getElementById('categoriasList');
  if (!adminCategories.length) { list.innerHTML = `<p style="color:var(--texto-muted);">No hay categorías.</p>`; return; }
  list.innerHTML = adminCategories.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--borde);">
      <div>
        <p style="color:var(--texto);font-weight:500;">🏷️ ${c.nombre}</p>
        <p style="color:var(--texto-muted);font-size:0.75rem;">Orden: ${c.orden}</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="openCatModal('${c.id}','${c.nombre}',${c.orden})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCat('${c.id}')">✕</button>
      </div>
    </div>`).join('');
}

function openCatModal(id='', nombre='', orden=1) {
  document.getElementById('catId').value = id;
  document.getElementById('catNombre').value = nombre;
  document.getElementById('catOrden').value = orden;
  document.getElementById('catModalTitle').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
  openModal('catModal');
}

async function saveCat() {
  const id = document.getElementById('catId').value;
  const nombre = document.getElementById('catNombre').value.trim();
  const orden = parseInt(document.getElementById('catOrden').value) || 1;
  if (!nombre) { showToast('Ingresa el nombre', 'error'); return; }
  const data = { nombre, orden };
  try {
    if (id) await db.collection(COL.categorias).doc(id).update(data);
    else await db.collection(COL.categorias).add(data);
    showToast('Categoría guardada ✓', 'success');
    closeModal('catModal');
    loadAdminCategorias();
  } catch (e) { showToast('Error al guardar', 'error'); }
}

async function deleteCat(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  await db.collection(COL.categorias).doc(id).delete();
  showToast('Categoría eliminada', 'info');
  loadAdminCategorias();
}

// ── SERVICIOS ──────────────────────────────────────────────────
async function loadAdminServicios() {
  await loadAdminCategories();
  const tbody = document.getElementById('serviciosTbody');
  try {
    const snap = await db.collection(COL.servicios).orderBy('nombre').get();
    const servicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tbody.innerHTML = servicios.map(s => {
      const catName = adminCategories.find(c => c.id === s.categoria)?.nombre || s.categoria;
      const hrs = Math.floor((s.duracion||60)/60), mins = (s.duracion||60)%60;
      const durLabel = hrs > 0 ? `${hrs}h${mins>0?` ${mins}min`:''}` : `${mins}min`;
      return `<tr>
        <td>${s.nombre}</td>
        <td>${catName}</td>
        <td style="color:var(--dorado);">$${(s.precio||0).toLocaleString('es-CO')}</td>
        <td>⏱ ${durLabel}</td>
        <td>
          <label class="toggle-switch" style="cursor:pointer;" title="${s.activo?'Deshabilitar':'Habilitar'}">
            <input type="checkbox" ${s.activo?'checked':''} onchange="toggleServicioActivo('${s.id}',this.checked)">
            <div class="toggle-track"></div>
          </label>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" onclick="openServicioModal('${s.id}','${s.nombre}','${s.categoria}',${s.precio},${s.duracion||60},'${(s.descripcion||'').replace(/'/g,'&#39;')}',${s.activo})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteServicio('${s.id}')">✕</button>
          </div>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay servicios. Crea uno.</td></tr>`;
  } catch (e) { console.error(e); }
}

function openServicioModal(id='',nombre='',categoria='',precio=0,duracion=60,descripcion='',activo=true) {
  document.getElementById('servicioId').value = id;
  document.getElementById('servicioNombre').value = nombre;
  document.getElementById('servicioCategoria').value = categoria;
  document.getElementById('servicioPrecio').value = precio || '';
  document.getElementById('servicioDuracion').value = duracion || '';
  document.getElementById('servicioDescripcion').value = descripcion || '';
  document.getElementById('servicioActivo').checked = activo !== false;
  document.getElementById('servicioModalTitle').textContent = id ? 'Editar Servicio' : 'Nuevo Servicio';
  openModal('servicioModal');
}

async function saveServicio() {
  const id = document.getElementById('servicioId').value;
  const data = {
    nombre: document.getElementById('servicioNombre').value.trim(),
    categoria: document.getElementById('servicioCategoria').value,
    precio: parseFloat(document.getElementById('servicioPrecio').value) || 0,
    duracion: parseInt(document.getElementById('servicioDuracion').value) || 60,
    descripcion: document.getElementById('servicioDescripcion').value.trim(),
    activo: document.getElementById('servicioActivo').checked
  };
  if (!data.nombre) { showToast('Ingresa el nombre', 'error'); return; }
  if (!data.categoria) { showToast('Selecciona una categoría', 'error'); return; }
  try {
    if (id) await db.collection(COL.servicios).doc(id).update(data);
    else await db.collection(COL.servicios).add(data);
    showToast('Servicio guardado ✓', 'success');
    closeModal('servicioModal');
    loadAdminServicios();
  } catch (e) { showToast('Error al guardar', 'error'); }
}

async function toggleServicioActivo(id, activo) {
  await db.collection(COL.servicios).doc(id).update({ activo });
  showToast(activo ? 'Servicio habilitado' : 'Servicio deshabilitado', 'info');
}

async function deleteServicio(id) {
  if (!confirm('¿Eliminar este servicio?')) return;
  await db.collection(COL.servicios).doc(id).delete();
  showToast('Servicio eliminado', 'info');
  loadAdminServicios();
}

// ── PRODUCTOS ──────────────────────────────────────────────────
async function loadAdminProductos() {
  const tbody = document.getElementById('productosTbody');
  try {
    const snap = await db.collection(COL.productos).get();
    const productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tbody.innerHTML = productos.map(p => {
      const stockClass = p.stock === 0 ? 'stock-out' : p.stock < 3 ? 'stock-low' : 'stock-ok';
      const stockLabel = p.stock === 0 ? 'Agotado' : p.stock < 3 ? 'Stock bajo' : 'En stock';
      return `<tr>
        <td>${p.emoji||'💅'} ${p.nombre}</td>
        <td style="color:var(--dorado);">$${(p.precio||0).toLocaleString('es-CO')}</td>
        <td>${p.stock} unidades</td>
        <td><span class="badge ${stockClass}">${stockLabel}</span></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" ${p.activo!==false?'checked':''} onchange="toggleProductoActivo('${p.id}',this.checked)">
            <div class="toggle-track"></div>
          </label>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" onclick="openProductoModal('${p.id}','${p.nombre}','${p.emoji||''}',${p.precio},${p.stock},'${(p.descripcion||'').replace(/'/g,'&#39;')}',${p.activo!==false})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProducto('${p.id}')">✕</button>
          </div>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay productos.</td></tr>`;
  } catch (e) { console.error(e); }
}

function openProductoModal(id='',nombre='',emoji='',precio=0,stock=0,descripcion='',activo=true) {
  document.getElementById('productoId').value = id;
  document.getElementById('productoNombre').value = nombre;
  document.getElementById('productoEmoji').value = emoji;
  document.getElementById('productoPrecio').value = precio || '';
  document.getElementById('productoStock').value = stock || '';
  document.getElementById('productoDescripcion').value = descripcion || '';
  document.getElementById('productoActivo').checked = activo !== false;
  document.getElementById('productoModalTitle').textContent = id ? 'Editar Producto' : 'Nuevo Producto';
  openModal('productoModal');
}

async function saveProducto() {
  const id = document.getElementById('productoId').value;
  const data = {
    nombre: document.getElementById('productoNombre').value.trim(),
    emoji: document.getElementById('productoEmoji').value.trim() || '💅',
    precio: parseFloat(document.getElementById('productoPrecio').value) || 0,
    stock: parseInt(document.getElementById('productoStock').value) || 0,
    descripcion: document.getElementById('productoDescripcion').value.trim(),
    activo: document.getElementById('productoActivo').checked
  };
  if (!data.nombre) { showToast('Ingresa el nombre', 'error'); return; }
  try {
    if (id) await db.collection(COL.productos).doc(id).update(data);
    else await db.collection(COL.productos).add(data);
    showToast('Producto guardado ✓', 'success');
    closeModal('productoModal');
    loadAdminProductos();
  } catch { showToast('Error al guardar', 'error'); }
}

async function toggleProductoActivo(id, activo) {
  await db.collection(COL.productos).doc(id).update({ activo });
  showToast(activo ? 'Producto visible' : 'Producto oculto', 'info');
}

async function deleteProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  await db.collection(COL.productos).doc(id).delete();
  showToast('Producto eliminado', 'info');
  loadAdminProductos();
}

// ── HORARIOS ───────────────────────────────────────────────────
const DAYS_CONFIG = [
  { key: 'lunes', label: 'Lunes', default: { activo: true, open: '09:00', close: '20:00' } },
  { key: 'martes', label: 'Martes', default: { activo: true, open: '09:00', close: '20:00' } },
  { key: 'miercoles', label: 'Miércoles', default: { activo: true, open: '09:00', close: '20:00' } },
  { key: 'jueves', label: 'Jueves', default: { activo: true, open: '09:00', close: '20:00' } },
  { key: 'viernes', label: 'Viernes', default: { activo: true, open: '09:00', close: '20:00' } },
  { key: 'sabado', label: 'Sábado', default: { activo: true, open: '08:00', close: '12:00' } },
  { key: 'domingo', label: 'Domingo', default: { activo: false, open: '09:00', close: '17:00' } },
];

let horariosData = {};

async function loadHorarios() {
  try {
    const snap = await db.collection(COL.horarios).doc('config').get();
    horariosData = snap.exists ? snap.data() : {};
  } catch { horariosData = {}; }

  const grid = document.getElementById('horariosGrid');
  grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">` +
    DAYS_CONFIG.map(day => {
      const d = horariosData[day.key] || day.default;
      return `<div style="background:var(--negro-soft);border:1px solid var(--borde);border-radius:8px;padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:0.85rem;font-weight:600;color:var(--texto);">${day.label}</span>
          <label class="toggle-switch">
            <input type="checkbox" id="h-activo-${day.key}" ${d.activo?'checked':''} onchange="toggleDayActive('${day.key}')">
            <div class="toggle-track"></div>
          </label>
        </div>
        <div id="h-times-${day.key}" style="${d.activo?'':'opacity:0.3;pointer-events:none;'}">
          <div style="margin-bottom:8px;">
            <label style="font-size:0.7rem;color:var(--madera);letter-spacing:1px;">APERTURA</label>
            <input type="time" class="form-input" id="h-open-${day.key}" value="${d.open}" style="padding:8px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:0.7rem;color:var(--madera);letter-spacing:1px;">CIERRE</label>
            <input type="time" class="form-input" id="h-close-${day.key}" value="${d.close}" style="padding:8px;margin-top:4px;">
          </div>
        </div>
      </div>`;
    }).join('') + `</div>`;
}

function toggleDayActive(key) {
  const activo = document.getElementById(`h-activo-${key}`).checked;
  const times = document.getElementById(`h-times-${key}`);
  times.style.opacity = activo ? '1' : '0.3';
  times.style.pointerEvents = activo ? 'all' : 'none';
}

async function saveHorarios() {
  const data = {};
  DAYS_CONFIG.forEach(day => {
    data[day.key] = {
      activo: document.getElementById(`h-activo-${day.key}`).checked,
      open: document.getElementById(`h-open-${day.key}`).value,
      close: document.getElementById(`h-close-${day.key}`).value
    };
  });
  try {
    await db.collection(COL.horarios).doc('config').set(data);
    showToast('Horarios guardados ✓', 'success');
  } catch { showToast('Error al guardar', 'error'); }
}

// ── BLOQUEAR HORAS ─────────────────────────────────────────────
async function loadBlockedDate() {
  const dateStr = document.getElementById('blockDate').value;
  if (!dateStr) return;
  currentBlockDate = dateStr;
  blockSlotState = {};

  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();
  const scheduleMap = { 0:null, 1:{o:'09:00',c:'20:00'}, 2:{o:'09:00',c:'20:00'}, 3:{o:'09:00',c:'20:00'}, 4:{o:'09:00',c:'20:00'}, 5:{o:'09:00',c:'20:00'}, 6:{o:'08:00',c:'12:00'} };
  const sched = scheduleMap[dow];

  const wrap = document.getElementById('blockSlotsWrap');
  if (!sched) {
    wrap.innerHTML = `<p style="color:var(--texto-muted);">Este día está cerrado.</p>`;
    wrap.style.display = 'block';
    return;
  }

  // Cargar slots ya bloqueados
  let existingBlocked = [];
  try {
    const snap = await db.collection(COL.bloqueados).doc(dateStr).get();
    if (snap.exists) existingBlocked = snap.data().slots || [];
  } catch {}

  // Generar todos los slots del día (cada 30 min)
  const slots = [];
  let cur = timeToMinutes(sched.o);
  const end = timeToMinutes(sched.c);
  while (cur < end) {
    slots.push(minutesToTime(cur));
    cur += 30;
  }

  slots.forEach(s => { blockSlotState[s] = existingBlocked.includes(s); });

  const container = document.getElementById('blockSlots');
  container.innerHTML = slots.map(s => `
    <div class="hora-block ${blockSlotState[s] ? 'blocked' : ''}" 
      id="slot-${s.replace(':','-')}"
      onclick="toggleBlockSlot('${s}')">
      ${s}
    </div>`).join('');

  wrap.style.display = 'block';
}

function toggleBlockSlot(time) {
  blockSlotState[time] = !blockSlotState[time];
  const el = document.getElementById(`slot-${time.replace(':','-')}`);
  el.classList.toggle('blocked', blockSlotState[time]);
}

async function saveBlockedSlots() {
  if (!currentBlockDate) return;
  const blocked = Object.keys(blockSlotState).filter(s => blockSlotState[s]);
  try {
    await db.collection(COL.bloqueados).doc(currentBlockDate).set({ slots: blocked, fecha: currentBlockDate });
    showToast(`${blocked.length} hora(s) bloqueada(s) ✓`, 'success');
  } catch { showToast('Error al guardar', 'error'); }
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  return `${Math.floor(mins/60).toString().padStart(2,'0')}:${(mins%60).toString().padStart(2,'0')}`;
}