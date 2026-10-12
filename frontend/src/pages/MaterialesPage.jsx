import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialesService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getItemImage } from '../utils/itemImages';
import toast from 'react-hot-toast';
import {
  Plus, Search, Edit, Trash2, AlertTriangle,
  Package, X, MoreHorizontal, LayoutGrid, List,
  Camera, Upload
} from 'lucide-react';

const UNIDADES = ['UNIDAD', 'KG', 'LT', 'MT', 'M2', 'M3', 'CAJA', 'PAQUETE', 'ROLLO', 'JUEGO', 'RESMA'];
const UNIDAD_LABELS = {
  UNIDAD: 'Unidad', KG: 'Kg', LT: 'Litro', MT: 'Metro',
  M2: 'M²', M3: 'M³', CAJA: 'Caja', PAQUETE: 'Paquete',
  ROLLO: 'Rollo', JUEGO: 'Juego', RESMA: 'Resma'
};

// Asignación de colores para las categorías
const CATEGORY_STYLES = {
  'útiles de escritorio': { bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' },
  'material eléctrico':   { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)' },
  'material de limpieza': { bg: 'rgba(236, 72, 153, 0.2)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.35)' },
  'equipos de cómputo':  { bg: 'rgba(20, 184, 166, 0.2)', text: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)' },
  'herramientas':        { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' },
  'mobiliario':          { bg: 'rgba(99, 102, 241, 0.2)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.35)' },
};

function getCategoryStyle(catName = '') {
  const k = catName.toLowerCase();
  for (const [key, style] of Object.entries(CATEGORY_STYLES)) {
    if (k.includes(key) || key.includes(k)) return style;
  }
  return { bg: 'rgba(124, 58, 237, 0.18)', text: '#c084fc', border: 'rgba(124, 58, 237, 0.3)' };
}

const emptyForm = {
  codigo: '', nombre: '', descripcion: '', categoria: '',
  proveedor: '', unidad_medida: 'UNIDAD', stock_actual: 0,
  stock_minimo: 5, precio_unitario: 0, ubicacion: '',
  imagen: null
};

export default function MaterialesPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' o 'table'
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [eliminarFoto, setEliminarFoto] = useState(false);
  const fileInputRef = useRef(null);
  const canEdit = hasRole('ADMIN', 'JEFE_ALMACEN');

  const { data, isLoading } = useQuery({
    queryKey: ['materiales', search],
    queryFn: () => materialesService.getAll({ search }).then(r => r.data),
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => materialesService.getCategorias().then(r => r.data?.results || r.data),
  });

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => materialesService.getProveedores().then(r => r.data?.results || r.data),
  });

  const createMut = useMutation({
    mutationFn: (data) => editItem
      ? materialesService.update(editItem.id, data)
      : materialesService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materiales'] });
      toast.success(editItem ? 'Material actualizado' : 'Material creado');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al guardar'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => materialesService.delete(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['materiales'] });
      toast.success(res?.data?.detail || 'Material eliminado');
    },
    onError: (e) => {
      const msg = e.response?.data?.detail || e.response?.data?.error || 'Error al eliminar el material';
      toast.error(msg);
    },
  });

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setFotoPreview(null);
    setEliminarFoto(false);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      codigo: item.codigo, nombre: item.nombre, descripcion: item.descripcion || '',
      categoria: item.categoria, proveedor: item.proveedor || '',
      unidad_medida: item.unidad_medida, stock_actual: item.stock_actual,
      stock_minimo: item.stock_minimo, precio_unitario: item.precio_unitario,
      ubicacion: item.ubicacion || '', imagen: null
    });
    let preview = item.imagen || null;
    if (preview && typeof preview === 'string' && preview.startsWith('/media/')) {
      const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');
      preview = `${backendBase}${preview}`;
    }
    setFotoPreview(preview);
    setEliminarFoto(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm(emptyForm);
    setFotoPreview(null);
    setEliminarFoto(false);
  };

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Solo se permiten formatos JPG, PNG, WebP o GIF');
      return;
    }
    setForm(prev => ({ ...prev, imagen: file }));
    setEliminarFoto(false);
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveFoto = () => {
    setForm(prev => ({ ...prev, imagen: null }));
    setFotoPreview(null);
    setEliminarFoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.codigo || !form.nombre || !form.categoria) {
      toast.error('Código, nombre y categoría son requeridos');
      return;
    }
    const payload = { ...form };
    if (eliminarFoto) {
      payload.eliminar_imagen = true;
    }
    createMut.mutate(payload);
  };

  const materiales = data?.results || data || [];

  return (
    <div className="mat-page-root">
      {/* ── HEADER ── */}
      <div className="mat-header">
        <div>
          <h1 className="mat-title">
            Inventario de Materiales {viewMode === 'cards' ? '(Vista de Tarjetas)' : '(Vista de Tabla)'}
          </h1>
          <p className="mat-subtitle">{materiales.length} materiales registrados en inventario</p>
        </div>

        <div className="mat-header-actions">
          {/* Search Box */}
          <div className="mat-search-box">
            <Search size={15} className="mat-search-icon" />
            <input
              type="text"
              placeholder="Buscar material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Toggle Cards/Table */}
          <div className="mat-view-toggle">
            <button
              className={`mat-toggle-btn ${viewMode === 'cards' ? 'mat-toggle-btn--active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Vista de Tarjetas"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={`mat-toggle-btn ${viewMode === 'table' ? 'mat-toggle-btn--active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Vista de Tabla"
            >
              <List size={15} />
            </button>
          </div>

          {canEdit && (
            <button className="mat-btn-primary" onClick={openCreate}>
              <Plus size={16} /> Nuevo Material
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : materiales.length === 0 ? (
        <div className="mat-empty">
          <Package size={40} opacity={0.4} />
          <p>No se encontraron materiales</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* ── CARD GRID VIEW (Image 2) ── */
        <div className="mat-cards-grid">
          {materiales.map(m => {
            const catStyle = getCategoryStyle(m.categoria_nombre || '');
            const isMin = m.alerta_stock;
            const isZero = parseFloat(m.stock_actual) === 0;

            return (
              <div key={m.id} className="mat-card-item">
                {/* Top Row: Thumbnail + Dots */}
                <div className="mat-card-top">
                  <div
                    className="mat-thumbnail-wrap"
                    onClick={() => canEdit && openEdit(m)}
                    style={{ cursor: canEdit ? 'pointer' : 'default' }}
                    title={canEdit ? 'Click para editar o cambiar imagen' : m.nombre}
                  >
                    {getItemImage(m.nombre, m.imagen, 52)}
                  </div>
                  <button className="mat-card-dots" onClick={() => openEdit(m)} title="Opciones">
                    <MoreHorizontal size={15} />
                  </button>
                </div>

                {/* Info */}
                <div className="mat-card-content">
                  <h3 className="mat-card-name" title={m.nombre}>{m.nombre}</h3>
                  <div className="mat-card-code">{m.codigo}</div>

                  <div className="mat-card-cat-row">
                    <span className="mat-cat-label">Categoría:</span>
                    <span
                      className="mat-cat-pill"
                      style={{
                        background: catStyle.bg,
                        color: catStyle.text,
                        borderColor: catStyle.border,
                      }}
                    >
                      {m.categoria_nombre || 'General'}
                    </span>
                  </div>

                  {/* Stock Row */}
                  <div className="mat-card-stock-row">
                    <div className="mat-card-stock-val">
                      Stock: <span className="mat-stock-num">{parseFloat(m.stock_actual).toFixed(0)}</span>
                    </div>
                    {isZero ? (
                      <span className="mat-stock-badge mat-stock-badge--danger">SIN STOCK</span>
                    ) : isMin ? (
                      <span className="mat-stock-badge mat-stock-badge--min">STOCK MIN</span>
                    ) : (
                      <span className="mat-stock-badge mat-stock-badge--normal">NORMAL</span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                {canEdit && (
                  <div className="mat-card-actions">
                    <button
                      className="mat-card-btn-edit"
                      onClick={() => openEdit(m)}
                      title="Editar"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      className="mat-card-btn-del"
                      onClick={() => { if (confirm(`¿Eliminar ${m.nombre}?`)) deleteMut.mutate(m.id); }}
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Stock Actual</th>
                  <th>Stock Mínimo</th>
                  <th>Precio Unit.</th>
                  <th>Estado</th>
                  {canEdit && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {materiales.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div
                        style={{ width: 36, height: 36, cursor: canEdit ? 'pointer' : 'default' }}
                        onClick={() => canEdit && openEdit(m)}
                        title={canEdit ? 'Click para editar o cambiar imagen' : m.nombre}
                      >
                        {getItemImage(m.nombre, m.imagen, 36)}
                      </div>
                    </td>
                    <td><code style={{ color: 'var(--text-accent)', fontSize: '0.8rem' }}>{m.codigo}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.nombre}</div>
                      {m.ubicacion && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.ubicacion}</div>}
                    </td>
                    <td><span className="badge badge-primary">{m.categoria_nombre}</span></td>
                    <td>{UNIDAD_LABELS[m.unidad_medida] || m.unidad_medida}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{parseFloat(m.stock_actual).toLocaleString()}</span>
                        {m.alerta_stock && <AlertTriangle size={14} color="var(--warning)" />}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{parseFloat(m.stock_minimo).toLocaleString()}</td>
                    <td>Bs. {parseFloat(m.precio_unitario).toFixed(2)}</td>
                    <td>
                      {parseFloat(m.stock_actual) === 0
                        ? <span className="badge badge-danger">Sin Stock</span>
                        : m.alerta_stock
                          ? <span className="badge badge-warning">Stock Bajo</span>
                          : <span className="badge badge-success">Normal</span>
                      }
                    </td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(m)} title="Editar">
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            onClick={() => { if (confirm(`¿Eliminar ${m.nombre}?`)) deleteMut.mutate(m.id); }}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Material' : 'Nuevo Material'}</h2>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* ── SECCIÓN DE SUBIDA DE IMAGEN ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(99, 102, 241, 0.35)',
                  borderRadius: 12,
                  marginBottom: 20,
                }}>
                  {/* Vista previa / placeholder */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 82,
                      height: 82,
                      borderRadius: 10,
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '2px dashed rgba(99, 102, 241, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }}
                    title="Haga clic para subir o cambiar foto"
                  >
                    {fotoPreview ? (
                      <img
                        src={fotoPreview}
                        alt="Vista previa"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Camera size={26} strokeWidth={1.5} style={{ opacity: 0.7 }} />
                        <span style={{ fontSize: '0.65rem', display: 'block', marginTop: 3 }}>Adjuntar foto</span>
                      </div>
                    )}
                  </div>

                  {/* Información y botones */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Imagen del Material
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Suba una fotografía o imagen de referencia del material (JPG, PNG, WebP, máx. 5MB)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Upload size={14} /> {fotoPreview ? 'Cambiar Foto' : 'Subir Foto'}
                      </button>
                      {fotoPreview && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={handleRemoveFoto}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px' }}
                          title="Quitar foto actual"
                        >
                          <Trash2 size={13} /> Quitar
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={handleFotoChange}
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Código *</label>
                    <input className="form-input" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="MAT-001" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del material" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Categoría *</label>
                    <select className="form-select" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                      <option value="">Seleccionar categoría</option>
                      {(categorias || []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Proveedor</label>
                    <select className="form-select" value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })}>
                      <option value="">Sin proveedor</option>
                      {(proveedores || []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Unidad de Medida</label>
                    <select className="form-select" value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })}>
                      {UNIDADES.map(u => <option key={u} value={u}>{UNIDAD_LABELS[u]}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Actual</label>
                    <input type="number" className="form-input" min="0" value={form.stock_actual} onChange={e => setForm({ ...form, stock_actual: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Mínimo</label>
                    <input type="number" className="form-input" min="0" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Precio Unitario (Bs.)</label>
                    <input type="number" className="form-input" min="0" step="0.01" value={form.precio_unitario} onChange={e => setForm({ ...form, precio_unitario: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ubicación en Almacén</label>
                    <input className="form-input" value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} placeholder="Ej: Estante A-3" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-textarea" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción del material..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Guardando...' : editItem ? 'Actualizar' : 'Crear Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
