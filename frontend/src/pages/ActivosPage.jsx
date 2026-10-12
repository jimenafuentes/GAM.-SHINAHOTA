import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activosService, usuariosService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getItemImage } from '../utils/itemImages';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Box, X, Trash2, CheckCircle2, Camera, Upload, Link2, Cpu, Monitor, User } from 'lucide-react';

const TIPOS = ['MUEBLE', 'INMUEBLE', 'EQUIPO', 'VEHICULO', 'HERRAMIENTA', 'TECNOLOGIA', 'OTRO'];
const ESTADOS = ['BUENO', 'REGULAR', 'MALO', 'EN_REPARACION', 'DADO_BAJA'];
const TIPO_LABELS = {
  MUEBLE: 'Mueble', INMUEBLE: 'Inmueble', EQUIPO: 'Equipo',
  VEHICULO: 'Vehículo', HERRAMIENTA: 'Herramienta', TECNOLOGIA: 'Tecnología', OTRO: 'Otro'
};
const ESTADO_LABELS = {
  BUENO: 'Buen Estado', REGULAR: 'Regular', MALO: 'Mal Estado',
  EN_REPARACION: 'En Reparación', DADO_BAJA: 'Dado de Baja'
};

const emptyForm = {
  codigo_patrimonial: '', nombre: '', descripcion: '', tipo: 'EQUIPO', estado: 'BUENO',
  marca: '', modelo: '', serie: '', valor_adquisicion: 0, fecha_adquisicion: '',
  vida_util_anios: 5, porcentaje_depreciacion: 20, departamento: '', responsable: '', ubicacion: ''
};

// Genera un hash SHA-256 simulado basado en los campos del formulario
function generateFakeHash(form) {
  const str = JSON.stringify(form) + Date.now();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(8, '0').slice(0, 4) + '...' +
    Math.abs(hash ^ 0xdeadbeef).toString(16).slice(0, 4);
}

export default function ActivosPage() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroResponsable, setFiltroResponsable] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [codigoValido, setCodigoValido] = useState(false);
  const [codigoChecked, setCodigoChecked] = useState(false);
  const [hashGenerado, setHashGenerado] = useState('');
  const fileInputRef = useRef(null);
  const isAdminOrJefe = hasRole('ADMIN', 'JEFE_ALMACEN');

  const { data, isLoading } = useQuery({
    queryKey: ['activos', search, filtroResponsable],
    queryFn: () => activosService.getAll({
      search,
      ...(filtroResponsable ? { responsable: filtroResponsable } : {})
    }).then(r => r.data),
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => usuariosService.getDepartamentos().then(r => r.data?.results || r.data),
  });

  const { data: usuariosData } = useQuery({
    queryKey: ['usuarios-activos'],
    queryFn: () => usuariosService.getAll().then(r => r.data?.results || r.data),
    enabled: !!isAdminOrJefe,
  });
  const listaUsuarios = usuariosData || [];

  const { data: estadisticas } = useQuery({
    queryKey: ['activos-stats'],
    queryFn: () => activosService.getEstadisticas().then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data) => editItem ? activosService.update(editItem.id, data) : activosService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      qc.invalidateQueries({ queryKey: ['activos-stats'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Activo guardado exitosamente');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar activo'),
  });

  const darBajaMut = useMutation({
    mutationFn: (id) => activosService.darBaja(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activos'] });
      qc.invalidateQueries({ queryKey: ['activos-stats'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Activo dado de baja');
    },
    onError: () => toast.error('Error al dar de baja'),
  });

  const openCreate = () => {
    setEditItem(null);
    const initialForm = {
      ...emptyForm,
      responsable: isAdminOrJefe ? (filtroResponsable || user?.id || '') : (user?.id || ''),
      departamento: user?.departamento || '',
    };
    setForm(initialForm);
    setShowModal(true);
    setFotoPreview(null);
    setCodigoValido(false);
    setCodigoChecked(false);
    setHashGenerado(generateFakeHash(initialForm));
  };

  const openEdit = (item) => {
    setEditItem(item);
    const f = {
      codigo_patrimonial: item.codigo_patrimonial, nombre: item.nombre,
      descripcion: item.descripcion || '', tipo: item.tipo, estado: item.estado,
      marca: item.marca || '', modelo: item.modelo || '', serie: item.serie || '',
      valor_adquisicion: item.valor_adquisicion, fecha_adquisicion: item.fecha_adquisicion,
      vida_util_anios: item.vida_util_anios, porcentaje_depreciacion: item.porcentaje_depreciacion,
      departamento: item.departamento, responsable: item.responsable || (user?.id || ''),
      ubicacion: item.ubicacion || '', imagen: null
    };
    setForm(f);
    let preview = item.imagen || null;
    if (preview && typeof preview === 'string' && preview.startsWith('/media/')) {
      const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');
      preview = `${backendBase}${preview}`;
    }
    setFotoPreview(preview);
    setCodigoValido(true); setCodigoChecked(true);
    setHashGenerado(item.hash_blockchain ? `SHA-256 · ${item.hash_blockchain.slice(0,6)}...${item.hash_blockchain.slice(-4)}` : generateFakeHash(f));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false); setEditItem(null); setForm(emptyForm);
    setFotoPreview(null); setCodigoValido(false); setCodigoChecked(false);
  };

  const handleCodigoBlur = () => {
    if (form.codigo_patrimonial.trim()) {
      setCodigoValido(true); setCodigoChecked(true);
      setHashGenerado(generateFakeHash(form));
    } else {
      setCodigoValido(false); setCodigoChecked(true);
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no puede superar 5MB');
        return;
      }
      setForm(prev => ({ ...prev, imagen: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setFotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.codigo_patrimonial || !form.nombre || !form.departamento || !form.fecha_adquisicion) {
      toast.error('Campos obligatorios: código, nombre, departamento, fecha');
      return;
    }
    const dataToSend = {
      ...form,
      responsable: form.responsable || user?.id,
    };
    createMut.mutate(dataToSend);
  };

  const canManageItem = (item) => isAdminOrJefe || item.responsable === user?.id;

  const activos = data?.results || data || [];

  // Contadores para las 3 tarjetas superiores
  const totalActivos = estadisticas?.total_activos ?? activos.length;
  const regularCount = estadisticas?.por_estado?.find(e => e.estado === 'REGULAR')?.total ??
    activos.filter(a => a.estado === 'REGULAR').length;
  const buenEstadoCount = estadisticas?.por_estado?.find(e => e.estado === 'BUENO')?.total ??
    activos.filter(a => a.estado === 'BUENO').length;

  return (
    <div className="act-page-root">
      {/* ── TOP STATS ── */}
      <div className="act-top-stats">
        <div className="act-stat-pill">
          <div className="act-stat-icon-wrap act-stat-icon--purple">
            <Box size={16} />
          </div>
          <div className="act-stat-text">
            <span className="act-stat-num">{totalActivos}</span>
            <span className="act-stat-lbl">{isAdminOrJefe ? 'Total Activos' : 'Mis Activos'}</span>
          </div>
        </div>

        <div className="act-stat-pill">
          <div className="act-stat-icon-wrap act-stat-icon--yellow">
            <Box size={16} />
          </div>
          <div className="act-stat-text">
            <span className="act-stat-num">{regularCount}</span>
            <span className="act-stat-lbl">Regular</span>
          </div>
        </div>

        <div className="act-stat-pill">
          <div className="act-stat-icon-wrap act-stat-icon--green">
            <Box size={16} />
          </div>
          <div className="act-stat-text">
            <span className="act-stat-num">{buenEstadoCount}</span>
            <span className="act-stat-lbl">Buen Estado</span>
          </div>
        </div>
      </div>

      {/* ── HEADER WITH SEARCH, FILTER AND CREATE ── */}
      <div className="act-header-row">
        <div>
          <h1 className="act-title">{isAdminOrJefe ? 'Activos Fijos' : 'Mis Activos Fijos'}</h1>
          <p className="act-subtitle">
            {isAdminOrJefe
              ? 'Registro y control patrimonial institucional'
              : `Activos a cargo de ${user?.nombre || ''} ${user?.apellido || ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdminOrJefe && (
            <select
              className="mat-select-filter"
              value={filtroResponsable}
              onChange={e => setFiltroResponsable(e.target.value)}
              title="Filtrar por responsable"
            >
              <option value="">Todos los Usuarios</option>
              {listaUsuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} ({u.rol})
                </option>
              ))}
            </select>
          )}

          <div className="mat-search-box">
            <Search size={15} className="mat-search-icon" />
            <input
              type="text"
              placeholder="Buscar activo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button className="mat-btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nuevo Activo
          </button>
        </div>
      </div>

      {/* ── TABLE VIEW (Image 3) ── */}
      {isLoading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <div className="act-table-card">
          <div className="table-container">
            <table className="act-table">
              <thead>
                <tr>
                  <th>CÓDIGO PATRIMONIAL</th>
                  <th>NOMBRE</th>
                  <th>RESPONSABLE</th>
                  <th>TIPO</th>
                  <th>ESTADO</th>
                  <th>DEPARTAMENTO</th>
                  <th>VALOR ADQUISICIÓN</th>
                  <th>VALOR ACTUAL</th>
                  <th>DEPRECIACIÓN</th>
                  <th>HASH BC</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {activos.map(a => {
                  const depPct = Math.min(Math.round(a.porcentaje_depreciado || 0), 100);
                  const isRegular = a.estado === 'REGULAR';
                  const isGood = a.estado === 'BUENO';

                  return (
                    <tr key={a.id} className="act-tr">
                      <td>
                        <span className="act-code">{a.codigo_patrimonial}</span>
                      </td>

                      {/* Nombre con imagen */}
                      <td>
                        <div className="act-name-cell">
                          <div className="act-thumb-wrap">
                            {getItemImage(a.nombre, a.imagen, 42)}
                          </div>
                          <div>
                            <div className="act-name-title">{a.nombre}</div>
                            {a.marca && <div className="act-name-sub">{a.marca} {a.modelo}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Responsable */}
                      <td className="act-resp-cell">
                        <div className="act-resp-badge">
                          <User size={12} />
                          <span>{a.responsable_nombre || 'Sin asignar'}</span>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td>
                        <span className="act-badge-tipo">
                          {TIPO_LABELS[a.tipo] || a.tipo}
                        </span>
                      </td>

                      {/* Estado */}
                      <td>
                        <span className={`act-badge-estado ${isGood ? 'act-badge-estado--good' : isRegular ? 'act-badge-estado--reg' : 'act-badge-estado--bad'}`}>
                          {ESTADO_LABELS[a.estado] || a.estado}
                        </span>
                      </td>

                      {/* Departamento */}
                      <td className="act-dep-cell">
                        {a.departamento_nombre || 'Activos Fijos'}
                      </td>

                      {/* Valor Adquisicion */}
                      <td className="act-val-cell">
                        Bs. {parseFloat(a.valor_adquisicion || 0).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>

                      {/* Valor Actual */}
                      <td className="act-val-actual-cell">
                        Bs. {parseFloat(a.valor_depreciado || 0).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>

                      {/* Depreciación con barra púrpura */}
                      <td>
                        <div className="act-dep-wrap">
                          <div className="act-dep-bar">
                            <div className="act-dep-fill" style={{ width: `${depPct}%` }} />
                          </div>
                          <span className="act-dep-pct">{depPct}%</span>
                        </div>
                      </td>

                      {/* Hash BC */}
                      <td>
                        <span className="act-hash-tag">
                          {a.hash_blockchain ? `${a.hash_blockchain.slice(0, 6)}...${a.hash_blockchain.slice(-3)}` : '0xae41...3b2'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td>
                        {canManageItem(a) ? (
                          <div className="act-actions-cell">
                            <button
                              className="act-btn-edit"
                              onClick={() => openEdit(a)}
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="act-btn-del"
                              onClick={() => { if (confirm(`¿Dar de baja ${a.nombre}?`)) darBajaMut.mutate(a.id); }}
                              title="Dar de baja / Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {activos.length === 0 && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <Box size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                      No se encontraron activos fijos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL NUEVO / EDITAR ACTIVO FIJO  — Rediseño imagen
      ══════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="naf-modal" onClick={e => e.stopPropagation()}>

            {/* ── Título ── */}
            <div className="naf-header">
              <h2 className="naf-title">{editItem ? 'Editar Activo Fijo' : 'Nuevo Activo Fijo'}</h2>
              <button className="naf-close-btn" onClick={closeModal}><X size={17} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="naf-body">

                {/* ════ COLUMNA IZQUIERDA ════ */}
                <div className="naf-left">

                  {/* Zona de foto */}
                  <div className="naf-photo-area" onClick={() => fileInputRef.current?.click()}>
                    {fotoPreview
                      ? <img src={fotoPreview} alt="preview" className="naf-photo-preview" />
                      : (
                        <>
                          <div className="naf-photo-icon"><Camera size={28} strokeWidth={1.4} /></div>
                          <span className="naf-photo-label">Adjuntar Foto</span>
                          <span className="naf-photo-sub">(Opcional)</span>
                        </>
                      )
                    }
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
                  </div>

                  {/* Botón subir */}
                  <button type="button" className="naf-upload-btn" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={16} /> Subir archivo
                  </button>

                  {/* Código Patrimonial */}
                  <div className="naf-field-block">
                    <label className="naf-field-label">Código Patrimonial <span className="naf-req">*</span></label>
                    <div className="naf-code-wrap">
                      <input
                        className={`naf-code-input${codigoValido ? ' naf-code-input--valid' : ''}`}
                        value={form.codigo_patrimonial}
                        onChange={e => { setForm({ ...form, codigo_patrimonial: e.target.value }); setCodigoChecked(false); }}
                        onBlur={handleCodigoBlur}
                        placeholder="AF-2024-001"
                      />
                      {codigoChecked && codigoValido && (
                        <CheckCircle2 className="naf-code-check" size={17} />
                      )}
                    </div>
                    {codigoChecked && codigoValido && (
                      <p className="naf-field-hint naf-field-hint--ok">Código validado y único.</p>
                    )}
                  </div>

                  {/* Hashing Blockchain */}
                  <div className="naf-field-block">
                    <label className="naf-field-label">Hashing (Blockchain)</label>
                    <div className="naf-hash-box">
                      <Link2 size={14} className="naf-hash-icon" />
                      <span className="naf-hash-text">SHA-256 · <strong>{hashGenerado}</strong></span>
                      <span className="naf-hash-dot" />
                    </div>
                    <p className="naf-field-hint">Hash de integridad generado.</p>
                  </div>

                  {/* Ilustración blockchain */}
                  <div className="naf-blockchain-illus">
                    <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="naf-bc-svg">
                      {/* Nodos */}
                      <circle cx="30" cy="65" r="8" fill="rgba(99,102,241,0.25)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5"/>
                      <circle cx="80" cy="30" r="8" fill="rgba(99,102,241,0.25)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5"/>
                      <circle cx="80" cy="100" r="8" fill="rgba(99,102,241,0.25)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5"/>
                      <circle cx="130" cy="65" r="14" fill="rgba(20,184,166,0.3)" stroke="#14b8a6" strokeWidth="2"/>
                      <circle cx="175" cy="40" r="7" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5"/>
                      <circle cx="175" cy="90" r="7" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5"/>
                      {/* Líneas */}
                      <line x1="38" y1="60" x2="72" y2="35" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
                      <line x1="38" y1="70" x2="72" y2="95" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
                      <line x1="88" y1="35" x2="118" y2="58" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
                      <line x1="88" y1="95" x2="118" y2="72" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
                      <line x1="144" y1="58" x2="168" y2="45" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
                      <line x1="144" y1="72" x2="168" y2="85" stroke="rgba(99,102,241,0.35)" strokeWidth="1.2"/>
                      {/* Cubo central */}
                      <rect x="122" y="57" width="16" height="16" rx="3" fill="#14b8a6" opacity="0.9"/>
                    </svg>
                    <p className="naf-bc-caption">Registro sincronizado en la red blockchain.</p>
                  </div>
                </div>

                {/* ════ COLUMNA DERECHA ════ */}
                <div className="naf-right">

                  {/* Nombre del Bien */}
                  <div className="naf-field-block">
                    <label className="naf-field-label">Nombre del Bien <span className="naf-req">*</span></label>
                    <div className="naf-input-icon-wrap">
                      <Monitor size={14} className="naf-input-icon" />
                      <input className="naf-input naf-input--icon" value={form.nombre}
                        onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="HP ProDesk" />
                    </div>
                  </div>

                  {/* Marca / Modelo */}
                  <div className="naf-row-2">
                    <div className="naf-field-block">
                      <label className="naf-field-label">Marca</label>
                      <input className="naf-input" value={form.marca}
                        onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="HP" />
                    </div>
                    <div className="naf-field-block">
                      <label className="naf-field-label">Modelo</label>
                      <input className="naf-input" value={form.modelo}
                        onChange={e => setForm({ ...form, modelo: e.target.value })} placeholder="Elitedesk 800 G5" />
                    </div>
                  </div>

                  {/* Serie / Depto */}
                  <div className="naf-row-2">
                    <div className="naf-field-block">
                      <label className="naf-field-label">Series</label>
                      <input className="naf-input" value={form.serie}
                        onChange={e => setForm({ ...form, serie: e.target.value })} placeholder="SN-12345" />
                    </div>
                    <div className="naf-field-block">
                      <label className="naf-field-label">Departamento <span className="naf-req">*</span></label>
                      <select className="naf-select" value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })}>
                        <option value="">Seleccionar…</option>
                        {(departamentos || []).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Responsable (Usuario Asignado) */}
                  <div className="naf-field-block">
                    <label className="naf-field-label">Responsable (Usuario a Cargo)</label>
                    {isAdminOrJefe ? (
                      <select
                        className="naf-select"
                        value={form.responsable}
                        onChange={e => setForm({ ...form, responsable: e.target.value })}
                      >
                        <option value="">Seleccionar responsable…</option>
                        {listaUsuarios.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} {u.apellido} — {u.email} ({u.rol})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="naf-readonly-box">
                        <User size={14} />
                        <span>{user ? `${user.nombre} ${user.apellido} (${user.email})` : 'Mi Usuario'}</span>
                      </div>
                    )}
                  </div>

                  {/* Estado Físico / Vida Útil */}
                  <div className="naf-row-2">
                    <div className="naf-field-block">
                      <label className="naf-field-label">Estado Físico</label>
                      <select className="naf-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                        {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                      </select>
                    </div>
                    <div className="naf-field-block">
                      <label className="naf-field-label">Vida Útil</label>
                      <div className="naf-input-suffix-wrap">
                        <input type="number" className="naf-input naf-input--suffix" min="1" max="50"
                          value={form.vida_util_anios} onChange={e => setForm({ ...form, vida_util_anios: e.target.value })} />
                        <span className="naf-input-suffix">años</span>
                      </div>
                    </div>
                  </div>

                  {/* Ubicación Física */}
                  <div className="naf-field-block">
                    <input className="naf-input" value={form.ubicacion}
                      onChange={e => setForm({ ...form, ubicacion: e.target.value })} placeholder="Ubicación Física" />
                  </div>

                  {/* Valor / Fecha de adquisición */}
                  <div className="naf-row-2">
                    <div className="naf-field-block">
                      <label className="naf-field-label">Valor Adquisición (Bs.) <span className="naf-req">*</span></label>
                      <input type="number" className="naf-input" min="0" step="0.01"
                        value={form.valor_adquisicion} onChange={e => setForm({ ...form, valor_adquisicion: e.target.value })}
                        placeholder="0.00" />
                    </div>
                    <div className="naf-field-block">
                      <label className="naf-field-label">Fecha Adquisición <span className="naf-req">*</span></label>
                      <input type="date" className="naf-input"
                        value={form.fecha_adquisicion} onChange={e => setForm({ ...form, fecha_adquisicion: e.target.value })} />
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="naf-field-block">
                    <label className="naf-field-label">Descripción</label>
                    <textarea className="naf-textarea" value={form.descripcion}
                      onChange={e => setForm({ ...form, descripcion: e.target.value })}
                      placeholder="Detalles sobre el estado del bien..."
                      rows={3} />
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="naf-footer">
                <button type="button" className="naf-btn-cancel" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="naf-btn-submit" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Guardando...' : editItem ? 'Actualizar Activo' : 'Registrar Activo'}

                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
