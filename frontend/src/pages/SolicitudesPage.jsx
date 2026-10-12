import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { solicitudesService, materialesService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getItemImage } from '../utils/itemImages';
import toast from 'react-hot-toast';
import {
  Plus, Search, Eye, CheckCircle, XCircle, Truck,
  FileText, X, Trash2, Edit3, Flag, ChevronDown, Check, Wrench, AlertTriangle
} from 'lucide-react';

const ESTADO_BADGE = {
  PENDIENTE: 'badge-warning',
  APROBADO: 'badge-success',
  RECHAZADO: 'badge-danger',
  ENTREGADO: 'badge-primary',
  CANCELADO: 'badge-gray',
  EN_PROCESO: 'badge-info',
};

const PRIORIDAD_BADGE = {
  BAJA: 'badge-gray',
  MEDIA: 'badge-info',
  ALTA: 'badge-warning',
  URGENTE: 'badge-danger'
};

const UNIDAD_LABELS = {
  UNIDAD: 'Unidad(es)', KG: 'Kilogramos (Kg)', LT: 'Litros (Lt)', MT: 'Metros (Mt)',
  M2: 'Metros Cuadrados (M²)', M3: 'Metros Cúbicos (M³)', CAJA: 'Caja(s)',
  PAQUETE: 'Paquete(s)', ROLLO: 'Rollo(s)', JUEGO: 'Juego(s)', RESMA: 'Resma(s)'
};

const UNIDAD_SHORT = {
  UNIDAD: 'und.', KG: 'kg', LT: 'lt', MT: 'm',
  M2: 'm²', M3: 'm³', CAJA: 'caja(s)', PAQUETE: 'paq.',
  ROLLO: 'rollo(s)', JUEGO: 'juego(s)', RESMA: 'resma(s)'
};

export default function SolicitudesPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const filterEstado = searchParams.get('estado') || '';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedSol, setSelectedSol] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalObservations, setApprovalObservations] = useState('');
  const [approvalDetails, setApprovalDetails] = useState([]);
  const canApprove = hasRole('ADMIN', 'JEFE_ALMACEN');

  // Estado para el modal de creación (Image 4)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const dropdownRef = useRef(null);

  const [form, setForm] = useState({
    motivo: '',
    prioridad: 'MEDIA',
    detalles: [
      { material: '', cantidad_solicitada: 1 }
    ]
  });

  const { data, isLoading } = useQuery({
    queryKey: ['solicitudes', search, filterEstado],
    queryFn: () => solicitudesService.getAll({ search, estado: filterEstado || undefined }).then(r => r.data),
  });

  const { data: materiales } = useQuery({
    queryKey: ['materiales-list'],
    queryFn: () => materialesService.getAll().then(r => r.data),
  });

  const materialesList = materiales?.results || materiales || [];

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createMut = useMutation({
    mutationFn: (data) => solicitudesService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes'] });
      toast.success('Solicitud creada exitosamente');
      setShowCreateModal(false);
      setForm({ motivo: '', prioridad: 'MEDIA', detalles: [{ material: '', cantidad_solicitada: 1 }] });
    },
    onError: (e) => {
      const data = e.response?.data;
      if (data && typeof data === 'object') {
        const errors = [];
        for (const [key, val] of Object.entries(data)) {
          if (Array.isArray(val)) errors.push(`${key}: ${val.join(', ')}`);
          else if (typeof val === 'string') errors.push(`${key}: ${val}`);
          else if (val && typeof val === 'object') errors.push(`${key}: ${JSON.stringify(val)}`);
        }
        if (errors.length > 0) {
          toast.error(errors.join(' | '));
          return;
        }
      }
      toast.error(data?.detail || 'Error al crear solicitud');
    },
  });

  const aprobarMut = useMutation({
    mutationFn: ({ id, data }) => solicitudesService.aprobar(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solicitudes'] }); toast.success('Solicitud aprobada'); setShowApproveModal(false); },
    onError: (e) => toast.error(e.response?.data?.error || 'Error al aprobar'),
  });

  const rechazarMut = useMutation({
    mutationFn: ({ id, motivo }) => solicitudesService.rechazar(id, { motivo }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solicitudes'] }); toast.success('Solicitud rechazada'); setShowRejectModal(false); },
    onError: () => toast.error('Error al rechazar'),
  });

  const entregarMut = useMutation({
    mutationFn: (id) => solicitudesService.entregar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solicitudes'] }); toast.success('Materiales entregados exitosamente'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Error al entregar'),
  });

  const removeDetalle = (materialId) => {
    const filtered = form.detalles.filter(d => d.material !== materialId);
    setForm({ ...form, detalles: filtered.length > 0 ? filtered : [{ material: '', cantidad_solicitada: 1 }] });
  };

  const updateCantidad = (materialId, rawValue) => {
    // Si intenta ingresar 0 o número negativo, alertar inmediatamente
    const num = parseFloat(rawValue);
    if (rawValue !== '' && (!isNaN(num) && num <= 0)) {
      toast.error('No se puede crear la solicitud con esa cantidad. La cantidad debe ser mayor a 0 (no se permite 0 ni números negativos).', { id: 'cant-invalida' });
    }
    const d = form.detalles.map(item => {
      if (item.material === materialId) {
        return { ...item, cantidad_solicitada: rawValue };
      }
      return item;
    });
    setForm({ ...form, detalles: d });
  };

  const fixCantidad = (materialId, rawValue, maxStock, unitLabel = '') => {
    const parsed = parseInt(rawValue, 10);
    const numMax = maxStock !== undefined ? parseFloat(maxStock) : undefined;
    
    // Si es 0 o negativo, alertar y NO autocompletar con 1 a espaldas del usuario
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('No se puede crear la solicitud con esa cantidad. La cantidad debe ser mayor a 0 (no se permite 0 ni números negativos).', { id: 'cant-invalida-blur' });
      return;
    }

    let valid = parsed;
    if (numMax !== undefined && numMax > 0 && valid > numMax) {
      valid = Math.max(1, Math.floor(numMax));
      toast.error(`La cantidad superaba el stock disponible y se actualizó al límite (${valid} ${unitLabel}).`, { id: 'cant-max-clamp' });
      const d = form.detalles.map(item => {
        if (item.material === materialId) {
          return { ...item, cantidad_solicitada: valid };
        }
        return item;
      });
      setForm({ ...form, detalles: d });
    }
  };

  const clampToMax = (materialId, maxStock, unitLabel = '') => {
    const numMax = maxStock !== undefined ? Math.max(1, Math.floor(parseFloat(maxStock))) : 1;
    const d = form.detalles.map(item => {
      if (item.material === materialId) {
        return { ...item, cantidad_solicitada: numMax };
      }
      return item;
    });
    setForm({ ...form, detalles: d });
    toast.success(`Cantidad actualizada al límite de stock disponible (${numMax} ${unitLabel}).`);
  };

  const toggleSelectMaterial = (materialId) => {
    const exists = form.detalles.some(d => d.material === materialId);
    if (exists) {
      // Remover si ya está seleccionado
      const filtered = form.detalles.filter(d => d.material !== materialId);
      setForm({ ...form, detalles: filtered.length > 0 ? filtered : [{ material: '', cantidad_solicitada: 1 }] });
    } else {
      // Agregar o rellenar el primero vacío
      if (form.detalles.length === 1 && !form.detalles[0].material) {
        setForm({ ...form, detalles: [{ material: materialId, cantidad_solicitada: 1 }] });
      } else {
        setForm({ ...form, detalles: [...form.detalles, { material: materialId, cantidad_solicitada: 1 }] });
      }
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.motivo || !form.motivo.trim()) {
      toast.error('El motivo de la solicitud es obligatorio');
      return;
    }

    const selectedMaterials = form.detalles.filter(d => d.material);
    if (selectedMaterials.length === 0) {
      toast.error('Seleccione al menos un material para continuar');
      return;
    }

    const validDetalles = [];

    for (let i = 0; i < selectedMaterials.length; i++) {
      const d = selectedMaterials[i];
      const matObj = materialesList.find(m => m.id === d.material);
      const stock = matObj ? parseFloat(matObj.stock_actual) : 999;
      const rawVal = String(d.cantidad_solicitada ?? '').trim();
      const cant = parseInt(rawVal, 10);
      const unit = matObj ? (UNIDAD_SHORT[matObj.unidad_medida] || matObj.unidad_medida) : 'und.';

      // VALIDACIÓN ESTRICTA: Ni 0 ni números negativos ni vacío
      if (!rawVal || isNaN(cant) || cant <= 0) {
        toast.error(`No se puede crear la solicitud con esa cantidad (${rawVal || '0'}). La cantidad solicitada para "${matObj?.nombre || 'el material'}" debe ser mayor a 0 (no se permite 0 ni números negativos).`, { id: 'cant-invalida-submit' });
        return;
      }
      if (stock <= 0) {
        toast.error(`El material "${matObj?.nombre}" no cuenta con existencias disponibles en almacén.`);
        return;
      }
      if (cant > stock) {
        toast.error(`La cantidad solicitada para "${matObj?.nombre}" (${cant}) supera el stock disponible (${stock} ${unit}). El stock tiene un límite.`);
        return;
      }
      validDetalles.push({ ...d, cantidad_solicitada: cant });
    }

    createMut.mutate({ ...form, motivo: form.motivo.trim(), detalles: validDetalles });
  };

  const openApproveModal = (solicitud) => {
    setSelectedSol(solicitud);
    setApprovalObservations('');
    setApprovalDetails([]);
    setShowApproveModal(true);
  };

  const handleApprove = () => {
    if (!selectedSol || !detailData?.detalles?.length) return;

    aprobarMut.mutate({
      id: selectedSol.id,
      data: {
        observaciones: approvalObservations,
        detalles: detailData.detalles.map(detalle => {
          const approvalDetail = approvalDetails.find(item => item.id === detalle.id);
          return {
            id: detalle.id,
            cantidad_aprobada: Number(approvalDetail?.cantidad_aprobada ?? detalle.cantidad_solicitada),
          };
        }),
      },
    });
  };

  const { data: detailData } = useQuery({
    queryKey: ['solicitud-detail', selectedSol?.id],
    queryFn: () => selectedSol ? solicitudesService.getOne(selectedSol.id).then(r => r.data) : null,
    enabled: !!selectedSol,
  });

  const solicitudes = data?.results || data || [];

  // Filtrar lista de materiales para el selector interactivo
  const filteredMaterials = materialesList.filter(m =>
    m.nombre.toLowerCase().includes(materialSearch.toLowerCase()) ||
    m.codigo.toLowerCase().includes(materialSearch.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Solicitudes de Material</h1>
          <p className="page-subtitle">{solicitudes.length} solicitudes registradas</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="mat-search-box">
            <Search size={15} className="mat-search-icon" />
            <input
              type="text"
              placeholder="Buscar solicitud..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 160 }}
            value={filterEstado}
            onChange={e => {
              const val = e.target.value;
              setSearchParams(val ? { estado: val } : {});
            }}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADO">Aprobado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="ENTREGADO">Entregado</option>
          </select>
          <button className="mat-btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Nueva Solicitud
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>N° Solicitud</th>
                  <th>Solicitante</th>
                  <th>Departamento</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Items</th>
                  {!hasRole('SOLICITANTE') && <th>Hash BC</th>}
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(s => (
                  <tr key={s.id}>
                    <td><code style={{ color: 'var(--text-accent)', fontSize: '0.8rem' }}>SOL-{s.numero}</code></td>
                    <td style={{ fontWeight: 500 }}>{s.solicitante_nombre}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{s.departamento_nombre}</td>
                    <td><span className={`badge ${PRIORIDAD_BADGE[s.prioridad]}`}>{s.prioridad_display}</span></td>
                    <td><span className={`badge ${ESTADO_BADGE[s.estado]}`}>{s.estado_display}</span></td>
                    <td style={{ textAlign: 'center' }}>{s.total_items}</td>
                    {!hasRole('SOLICITANTE') && (
                      <td>
                        {s.hash_blockchain
                          ? <span className="hash-tag">{s.hash_blockchain.slice(0, 8)}...</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                      </td>
                    )}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(s.fecha_creacion).toLocaleDateString('es-BO')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setSelectedSol(s); setShowDetailModal(true); }} title="Ver detalle">
                          <Eye size={14} />
                        </button>
                        {canApprove && s.estado === 'PENDIENTE' && (
                          <>
                            <button className="btn btn-success btn-sm btn-icon" onClick={() => openApproveModal(s)} title="Aprobar">
                              <CheckCircle size={14} />
                            </button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => { setSelectedSol(s); setShowRejectModal(true); }} title="Rechazar">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {canApprove && s.estado === 'APROBADO' && (
                          <button
                            className="btn btn-primary btn-sm btn-icon"
                            onClick={() => { if (confirm('¿Confirmar entrega de materiales?')) entregarMut.mutate(s.id); }}
                            title="Marcar como entregado"
                          >
                            <Truck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {solicitudes.length === 0 && (
                  <tr><td colSpan={hasRole('SOLICITANTE') ? "8" : "9"} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <FileText size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                    No se encontraron solicitudes
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA SOLICITUD DE MATERIAL (Image 4) ── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="sol-modal-card" onClick={e => e.stopPropagation()}>
            <div className="sol-modal-header">
              <h2 className="sol-modal-title">Nueva Solicitud de Material</h2>
              <button className="sol-modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="sol-modal-body">

                {/* Motivo de la Solicitud */}
                <div className="sol-field-group">
                  <label className="sol-label">Motivo de la Solicitud *</label>
                  <div className="sol-input-wrap">
                    <Edit3 size={15} className="sol-input-icon" />
                    <textarea
                      className="sol-textarea"
                      value={form.motivo}
                      onChange={e => setForm({ ...form, motivo: e.target.value })}
                      placeholder="Describa el motivo..."
                      rows={2}
                    />
                  </div>
                </div>

                {/* Prioridad */}
                <div className="sol-field-group" style={{ maxWidth: 280 }}>
                  <label className="sol-label">Prioridad</label>
                  <div className="sol-input-wrap">
                    <Flag size={15} className="sol-input-icon sol-flag-icon" />
                    <select
                      className="sol-select"
                      value={form.prioridad}
                      onChange={e => setForm({ ...form, prioridad: e.target.value })}
                    >
                      <option value="BAJA">Baja</option>
                      <option value="MEDIA">Media</option>
                      <option value="ALTA">Alta</option>
                      <option value="URGENTE">Urgente</option>
                    </select>
                  </div>
                </div>

                {/* Materiales Solicitados con Dropdown Selector interactivo */}
                <div className="sol-materials-section">
                  <div className="sol-materials-header">
                    <label className="sol-label" style={{ marginBottom: 0 }}>Materiales Solicitados</label>
                    <button
                      type="button"
                      className="sol-btn-add-material"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                      + AGREGAR MATERIAL
                    </button>
                  </div>

                  {/* Dropdown Selector trigger & floating list (Image 4) */}
                  <div className="sol-dropdown-container" ref={dropdownRef}>
                    <div
                      className="sol-dropdown-trigger"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wrench size={15} color="#818cf8" />
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          Seleccionar material...
                        </span>
                      </div>
                      <ChevronDown size={15} color="#64748b" />
                    </div>

                    {dropdownOpen && (
                      <div className="sol-dropdown-menu">
                        <div className="sol-dropdown-search">
                          <Search size={14} color="#64748b" />
                          <input
                            type="text"
                            placeholder="Filtrar materiales..."
                            value={materialSearch}
                            onChange={e => setMaterialSearch(e.target.value)}
                            autoFocus
                          />
                        </div>

                        <div className="sol-dropdown-list">
                          {filteredMaterials.map(m => {
                            const isSelected = form.detalles.some(d => d.material === m.id);
                            const stockVal = parseFloat(m.stock_actual);
                            const unitLabel = UNIDAD_LABELS[m.unidad_medida] || m.unidad_medida;
                            const unitShort = UNIDAD_SHORT[m.unidad_medida] || m.unidad_medida;
                            const isSinStock = stockVal <= 0;

                            return (
                              <div
                                key={m.id}
                                className={`sol-dropdown-item ${isSelected ? 'sol-dropdown-item--selected' : ''}`}
                                onClick={() => toggleSelectMaterial(m.id)}
                              >
                                <div className={`sol-checkbox ${isSelected ? 'sol-checkbox--checked' : ''}`}>
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                                <div className="sol-dropdown-thumb">
                                  {getItemImage(m.nombre, m.imagen, 38)}
                                </div>
                                <div className="sol-dropdown-info">
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                    <div className="sol-dropdown-name">{m.nombre}</div>
                                    <span style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: isSinStock ? 'rgba(239, 68, 68, 0.2)' : m.alerta_stock ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                                      color: isSinStock ? '#f87171' : m.alerta_stock ? '#fbbf24' : '#818cf8',
                                      border: `1px solid ${isSinStock ? 'rgba(239, 68, 68, 0.3)' : m.alerta_stock ? 'rgba(245, 158, 11, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                                    }}>
                                      {unitLabel}
                                    </span>
                                  </div>
                                  <div className="sol-dropdown-code" style={{ marginTop: 2 }}>
                                    Código: <code>{m.codigo}</code> • Stock disponible: <strong>{stockVal.toLocaleString()} {unitShort}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {filteredMaterials.length === 0 && (
                            <div className="sol-dropdown-empty">No hay materiales que coincidan</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lista de materiales seleccionados */}
                  <div className="sol-selected-list">
                    {form.detalles.filter(d => d.material).length === 0 ? (
                      <div className="sol-no-selected">
                        Haga clic en "Seleccionar material..." para añadir productos a la solicitud.
                      </div>
                    ) : (
                      form.detalles.filter(d => d.material).map((d, i) => {
                        const matObj = materialesList.find(m => m.id === d.material);
                        const stockVal = matObj ? parseFloat(matObj.stock_actual) : 0;
                        const rawCantParsed = parseInt(d.cantidad_solicitada, 10);
                        const cantVal = isNaN(rawCantParsed) ? 0 : rawCantParsed;
                        const unitLabel = matObj ? (UNIDAD_LABELS[matObj.unidad_medida] || matObj.unidad_medida) : '';
                        const unitShort = matObj ? (UNIDAD_SHORT[matObj.unidad_medida] || matObj.unidad_medida) : 'und.';
                        const isHighQty = cantVal > stockVal;
                        const isZeroStock = stockVal <= 0;
                        const isInvalidCant = d.cantidad_solicitada !== '' && cantVal <= 0;

                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                            <div className="sol-selected-row" style={{
                              borderColor: isInvalidCant ? 'rgba(239, 68, 68, 0.7)' : isHighQty ? 'rgba(245, 158, 11, 0.5)' : isZeroStock ? 'rgba(239, 68, 68, 0.5)' : undefined,
                              background: isInvalidCant ? 'rgba(239, 68, 68, 0.08)' : isHighQty ? 'rgba(245, 158, 11, 0.06)' : isZeroStock ? 'rgba(239, 68, 68, 0.06)' : undefined,
                            }}>
                              <div className="sol-selected-name-col">
                                <div className="sol-selected-thumb">
                                  {getItemImage(matObj?.nombre || '', matObj?.imagen, 32)}
                                </div>
                                <div>
                                  <div className="sol-selected-title">{matObj?.nombre || 'Material'}</div>
                                  <div className="sol-selected-meta">
                                    Código: <code>{matObj?.codigo}</code> • Unidad: <strong style={{ color: '#a5b4fc' }}>{unitLabel}</strong>
                                  </div>
                                  <div className="sol-selected-meta" style={{ color: isZeroStock ? '#f87171' : isHighQty ? '#fbbf24' : '#64748b' }}>
                                    Stock disponible: <strong>{stockVal.toLocaleString()} {unitShort}</strong>
                                  </div>
                                </div>
                              </div>

                              <div className="sol-selected-cant-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label className="sol-cant-label">Cantidad:</label>
                                <input
                                  type="number"
                                  className="sol-cant-input"
                                  min="1"
                                  step="1"
                                  max={stockVal || 999}
                                  style={{
                                    borderColor: isInvalidCant ? '#ef4444' : isHighQty ? '#f59e0b' : isZeroStock ? '#ef4444' : undefined,
                                    boxShadow: isInvalidCant ? '0 0 0 2px rgba(239, 68, 68, 0.3)' : isHighQty ? '0 0 0 2px rgba(245, 158, 11, 0.25)' : undefined,
                                    fontWeight: 600,
                                    width: 65,
                                  }}
                                  value={d.cantidad_solicitada}
                                  onChange={e => updateCantidad(d.material, e.target.value)}
                                  onBlur={e => fixCantidad(d.material, e.target.value, stockVal, unitShort)}
                                  onKeyDown={e => {
                                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                      e.preventDefault();
                                      toast.error('No se puede crear la solicitud con esa cantidad. No se permiten signos ni números negativos.', { id: 'cant-signo' });
                                    }
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      fixCantidad(d.material, e.target.value, stockVal, unitShort);
                                    }
                                  }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{unitShort}</span>
                              </div>

                              <button
                                type="button"
                                className="sol-btn-del-item"
                                onClick={() => removeDetalle(d.material)}
                                title="Eliminar de la lista"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            {/* Alerta de cantidad inválida (<= 0 o negativa) */}
                            {isInvalidCant && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#f87171',
                                fontSize: '0.76rem',
                              }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                <span>
                                  <strong>No se puede crear la solicitud con esa cantidad:</strong> La cantidad debe ser un número mayor a 0 (no se permite 0 ni números negativos).
                                </span>
                              </div>
                            )}

                            {/* Alerta si la cantidad solicitada es muy alta y supera el stock */}
                            {isHighQty && !isZeroStock && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                color: '#fbbf24',
                                fontSize: '0.76rem',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                  <span>
                                    <strong>¡Cantidad solicitada muy alta!</strong> El stock tiene un límite de <strong>{stockVal} {unitShort}</strong>. La cantidad se actualizará al límite permitido.
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => clampToMax(d.material, stockVal, unitShort)}
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.25)',
                                    border: '1px solid #fbbf24',
                                    borderRadius: 6,
                                    color: '#ffffff',
                                    padding: '3px 8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  ⚡ Ajustar a {stockVal} {unitShort}
                                </button>
                              </div>
                            )}

                            {/* Alerta si el stock es 0 */}
                            {isZeroStock && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#f87171',
                                fontSize: '0.76rem',
                              }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                <span>
                                  <strong>Sin existencias disponibles:</strong> El stock actual de este material es de <strong>0 {unitShort}</strong>. El stock tiene un límite disponible.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer (Image 4) */}
              <div className="sol-modal-footer">
                <button
                  type="button"
                  className="sol-btn-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sol-btn-submit"
                  disabled={createMut.isPending}
                >
                  {createMut.isPending ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {showDetailModal && selectedSol && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Solicitud SOL-{selectedSol.numero}</h2>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setShowDetailModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="grid-2" style={{ marginBottom: 16 }}>
                <div><span className="text-muted text-xs">Solicitante:</span><div style={{ fontWeight: 600 }}>{selectedSol.solicitante_nombre}</div></div>
                <div><span className="text-muted text-xs">Departamento:</span><div style={{ fontWeight: 600 }}>{selectedSol.departamento_nombre}</div></div>
                <div><span className="text-muted text-xs">Estado:</span><div><span className={`badge ${ESTADO_BADGE[selectedSol.estado]}`}>{selectedSol.estado_display}</span></div></div>
                <div><span className="text-muted text-xs">Prioridad:</span><div><span className={`badge ${PRIORIDAD_BADGE[selectedSol.prioridad]}`}>{selectedSol.prioridad_display}</span></div></div>
              </div>
              <div style={{ marginBottom: 16 }}><span className="text-muted text-xs">Motivo:</span><p style={{ marginTop: 4 }}>{selectedSol.motivo}</p></div>

              <h4 style={{ marginBottom: 8 }}>Materiales Solicitados</h4>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Cant. Solicitada</th>
                    <th>Cant. Aprobada</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailData?.detalles || []).map(d => (
                    <tr key={d.id}>
                      <td>{d.material_nombre} ({d.material_codigo})</td>
                      <td>{d.cantidad_solicitada}</td>
                      <td>{d.cantidad_aprobada}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aprobación */}
      {showApproveModal && selectedSol && (
        <div className="modal-backdrop" onClick={() => setShowApproveModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Aprobar Solicitud SOL-{selectedSol.numero}</h2>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setShowApproveModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: 16 }}>
                Revise las cantidades antes de aprobar la solicitud.
              </p>
              {detailData?.detalles?.length ? (
                <table style={{ width: '100%', marginBottom: 16 }}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Cant. Solicitada</th>
                      <th>Cant. Aprobada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.detalles.map(detalle => {
                      const approvalDetail = approvalDetails.find(item => item.id === detalle.id);
                      return (
                      <tr key={detalle.id}>
                        <td>{detalle.material_nombre}</td>
                        <td>{detalle.cantidad_solicitada}</td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            max={detalle.cantidad_solicitada}
                            value={approvalDetail?.cantidad_aprobada ?? detalle.cantidad_solicitada}
                            onChange={e => setApprovalDetails(current => [
                              ...current.filter(item => item.id !== detalle.id),
                              { id: detalle.id, cantidad_aprobada: e.target.value },
                            ])}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="loading-container"><div className="loading-spinner" /></div>
              )}
              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea
                  className="form-textarea"
                  value={approvalObservations}
                  onChange={e => setApprovalObservations(e.target.value)}
                  placeholder="Observaciones opcionales..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={handleApprove} disabled={aprobarMut.isPending || !detailData?.detalles?.length}>
                {aprobarMut.isPending ? 'Aprobando...' : 'Confirmar aprobación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazo */}
      {showRejectModal && selectedSol && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Rechazar Solicitud</h2>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setShowRejectModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Motivo de Rechazo *</label>
                <textarea className="form-textarea" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Indique la razón..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => rechazarMut.mutate({ id: selectedSol.id, motivo: rejectReason })}>Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
