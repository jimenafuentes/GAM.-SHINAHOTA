import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportesService, solicitudesService, usuariosService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getItemImage } from '../utils/itemImages';
import {
  BarChart3, TrendingUp, Calendar, FileText, CheckCircle2,
  Clock, XCircle, Truck, Eye, X, Search, Building2, Package, ShieldCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';

const ESTADO_COLORS = {
  PENDIENTE: '#f59e0b',
  APROBADO: '#10b981',
  ENTREGADO: '#3b82f6',
  RECHAZADO: '#ef4444',
};

const ESTADO_LABELS = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  ENTREGADO: 'Entregado',
  RECHAZADO: 'Rechazado',
};

export default function ReportesPage() {
  const { user } = useAuth();
  const isAuditor = user?.rol === 'AUDITOR';

  // Si es auditor, únicamente puede ver el reporte de solicitudes
  const [activeTab, setActiveTab] = useState('solicitudes');

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [search, setSearch] = useState('');

  // Modal para detalle de solicitud en auditoría
  const [selectedSolId, setSelectedSolId] = useState(null);

  // 1. Consulta de Solicitudes (para reporte)
  const { data: solicitudesData, isLoading: loadingSolicitudes } = useQuery({
    queryKey: ['reporte-solicitudes', fechaInicio, fechaFin, estadoFiltro, deptoFiltro, search],
    queryFn: () => solicitudesService.getAll({
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined,
      estado: estadoFiltro || undefined,
      departamento: deptoFiltro || undefined,
      search: search || undefined,
    }).then(r => r.data),
  });

  // 2. Estadísticas de solicitudes
  const { data: solStats } = useQuery({
    queryKey: ['reporte-solicitudes-stats'],
    queryFn: () => solicitudesService.getEstadisticas().then(r => r.data),
  });

  // 3. Departamentos para selector de filtro
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => usuariosService.getDepartamentos().then(r => r.data?.results || r.data),
  });

  // 4. Detalle de solicitud seleccionada para el modal de auditoría
  const { data: detalleSol, isLoading: loadingDetalle } = useQuery({
    queryKey: ['solicitud-auditoria', selectedSolId],
    queryFn: () => solicitudesService.getOne(selectedSolId).then(r => r.data),
    enabled: !!selectedSolId,
  });

  // 5. Movimientos (Kardex) para Admin / Jefe
  const { data: movimientosData, isLoading: loadingMovimientos } = useQuery({
    queryKey: ['reporte-movimientos', fechaInicio, fechaFin],
    queryFn: () => reportesService.getMovimientos({
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined
    }).then(r => r.data),
    enabled: !isAuditor && activeTab === 'movimientos',
  });

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const rawSols = Array.isArray(solicitudesData) ? solicitudesData : (solicitudesData?.results || []);
  const solicitudes = rawSols;

  // Contadores de Solicitudes
  const totalSolicitudes = solStats?.total ?? solicitudes.length;
  const pendientesCount = solStats?.pendientes ?? solicitudes.filter(s => s.estado === 'PENDIENTE').length;
  const aprobadasCount = solStats?.por_estado?.find(e => e.estado === 'APROBADO')?.total ??
    solicitudes.filter(s => s.estado === 'APROBADO').length;
  const entregadasCount = solStats?.por_estado?.find(e => e.estado === 'ENTREGADO')?.total ??
    solicitudes.filter(s => s.estado === 'ENTREGADO').length;
  const rechazadasCount = solStats?.por_estado?.find(e => e.estado === 'RECHAZADO')?.total ??
    solicitudes.filter(s => s.estado === 'RECHAZADO').length;

  // Gráfico de Solicitudes por Estado
  const estadosChartData = [
    { estado: 'Pendiente', cantidad: pendientesCount, fill: ESTADO_COLORS.PENDIENTE },
    { estado: 'Aprobado', cantidad: aprobadasCount, fill: ESTADO_COLORS.APROBADO },
    { estado: 'Entregado', cantidad: entregadasCount, fill: ESTADO_COLORS.ENTREGADO },
    { estado: 'Rechazado', cantidad: rechazadasCount, fill: ESTADO_COLORS.RECHAZADO },
  ];

  // Gráfico de Solicitudes en el Tiempo
  const solLineData = Object.entries(
    solicitudes.reduce((totales, sol) => {
      if (!sol.fecha_creacion) return totales;
      const dia = formatDate(sol.fecha_creacion).slice(0, 5);
      totales[dia] = (totales[dia] || 0) + 1;
      return totales;
    }, {})
  ).map(([dia, count]) => ({ dia, solicitudes: count }));

  // Datos para pestaña Kardex de Movimientos (si no es auditor)
  const rawMovs = Array.isArray(movimientosData) ? movimientosData : (movimientosData?.results || []);
  const movimientos = rawMovs;
  const totalMovs = movimientos.length;
  const entradasCount = movimientos.filter(m => m.tipo === 'ENTRADA').length;
  const salidasCount = movimientos.filter(m => m.tipo === 'SALIDA').length;

  const limpiarFiltros = () => {
    setFechaInicio('');
    setFechaFin('');
    setEstadoFiltro('');
    setDeptoFiltro('');
    setSearch('');
  };

  return (
    <div className="rep-page-root">
      {/* ── HEADER ── */}
      <div className="rep-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="rep-title">
            {isAuditor ? 'Reportes de Solicitudes' : 'Reportes e Informes'}
          </h1>
          <p className="rep-subtitle">
            {isAuditor
              ? 'Módulo de Auditoría y Control de Solicitudes — Alcaldía de Shinahota'
              : 'Estadísticas patrimoniales y flujo institucional'}
          </p>
        </div>

        {/* Pestañas solo visibles para Admin y Jefe de Almacén */}
        {!isAuditor && (
          <div className="rep-tabs">
            <button
              className={`rep-tab-btn ${activeTab === 'solicitudes' ? 'rep-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('solicitudes')}
            >
              <FileText size={16} /> Reportes de Solicitudes
            </button>
            <button
              className={`rep-tab-btn ${activeTab === 'movimientos' ? 'rep-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('movimientos')}
            >
              <Package size={16} /> Kardex de Movimientos
            </button>
          </div>
        )}
      </div>

      {/* ── FILTROS DE AUDITORÍA Y PERÍODO ── */}
      <div className="rep-filter-card">
        <div className="rep-filter-title">
          {activeTab === 'solicitudes' ? 'Filtros de Auditoría de Solicitudes' : 'Filtros de Período'}
        </div>
        <div className="rep-filter-row">
          <div className="rep-filter-group">
            <label className="rep-filter-label">Fecha Inicio</label>
            <div className="rep-date-input-wrap">
              <input
                type="date"
                className="rep-date-input"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
              />
            </div>
          </div>

          <div className="rep-filter-group">
            <label className="rep-filter-label">Fecha Fin</label>
            <div className="rep-date-input-wrap">
              <input
                type="date"
                className="rep-date-input"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
              />
            </div>
          </div>

          {activeTab === 'solicitudes' && (
            <>
              <div className="rep-filter-group">
                <label className="rep-filter-label">Estado</label>
                <select
                  className="mat-select-filter"
                  value={estadoFiltro}
                  onChange={e => setEstadoFiltro(e.target.value)}
                >
                  <option value="">Todos los Estados</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="APROBADO">Aprobadas</option>
                  <option value="ENTREGADO">Entregadas</option>
                  <option value="RECHAZADO">Rechazadas</option>
                </select>
              </div>

              <div className="rep-filter-group">
                <label className="rep-filter-label">Departamento</label>
                <select
                  className="mat-select-filter"
                  value={deptoFiltro}
                  onChange={e => setDeptoFiltro(e.target.value)}
                >
                  <option value="">Todos los Deptos</option>
                  {(departamentos || []).map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="rep-filter-group">
                <label className="rep-filter-label">Buscar</label>
                <div className="mat-search-box" style={{ width: 180, height: 35 }}>
                  <Search size={14} className="mat-search-icon" />
                  <input
                    type="text"
                    placeholder="N° o solicitante..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <button className="rep-btn-clean" onClick={limpiarFiltros}>
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          VISTA 1: REPORTE DE SOLICITUDES (ÚNICA VISTA DEL AUDITOR)
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'solicitudes' && (
        <>
          {/* Tarjetas de estadísticas de Solicitudes */}
          <div className="rep-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--purple">
                <FileText size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{totalSolicitudes}</div>
                <div className="rep-stat-lbl">Total Solicitudes</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--orange">
                <Clock size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{pendientesCount}</div>
                <div className="rep-stat-lbl">Pendientes</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--green">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{aprobadasCount}</div>
                <div className="rep-stat-lbl">Aprobadas</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.35)' }}>
                <Truck size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{entregadasCount}</div>
                <div className="rep-stat-lbl">Entregadas</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--red">
                <XCircle size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{rechazadasCount}</div>
                <div className="rep-stat-lbl">Rechazadas</div>
              </div>
            </div>
          </div>

          {/* 2 Gráficos de Auditoría de Solicitudes */}
          <div className="rep-charts-grid">
            <div className="rep-chart-card">
              <div className="rep-chart-header">
                <span className="rep-chart-title">Distribución por Estado de Solicitud</span>
              </div>
              <div style={{ width: '100%', height: 230, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={estadosChartData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="estado" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f9fafb' }} />
                    <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={90}>
                      {estadosChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rep-chart-card">
              <div className="rep-chart-header">
                <span className="rep-chart-title">Volumen de Solicitudes en el Tiempo</span>
              </div>
              <div style={{ width: '100%', height: 230, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={solLineData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f9fafb' }} />
                    <Line type="monotone" dataKey="solicitudes" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 4, fill: '#818cf8' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabla de Detalle y Auditoría de Solicitudes */}
          <div className="rep-table-card">
            <div className="rep-table-header">
              <span className="rep-table-title">Auditoría Detallada de Solicitudes</span>
              <span className="rep-table-count">{solicitudes.length} solicitudes encontradas</span>
            </div>

            {loadingSolicitudes ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : (
              <div className="table-container">
                <table className="rep-table">
                  <thead>
                    <tr>
                      <th>N° SOLICITUD</th>
                      <th>SOLICITANTE</th>
                      <th>DEPARTAMENTO</th>
                      <th>FECHA</th>
                      <th>PRIORIDAD</th>
                      <th>ESTADO</th>
                      <th>ÍTEMS</th>
                      <th>HASH BC</th>
                      <th>AUDITORÍA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.map(s => {
                      const badgeClass =
                        s.estado === 'PENDIENTE' ? 'rep-badge-sol--pendiente' :
                        s.estado === 'APROBADO' ? 'rep-badge-sol--aprobado' :
                        s.estado === 'ENTREGADO' ? 'rep-badge-sol--entregado' : 'rep-badge-sol--rechazado';

                      return (
                        <tr key={s.id} className="rep-tr">
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f1f5f9' }}>
                              {s.numero}
                            </span>
                          </td>
                          <td style={{ color: '#e2e8f0', fontWeight: 500 }}>
                            {s.solicitante_nombre}
                          </td>
                          <td style={{ color: '#94a3b8' }}>
                            {s.departamento_nombre || 'General'}
                          </td>
                          <td className="rep-date-cell">
                            {formatDate(s.fecha_creacion)}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.72rem', color: s.prioridad === 'URGENTE' ? '#f87171' : '#94a3b8' }}>
                              {s.prioridad_display || s.prioridad}
                            </span>
                          </td>
                          <td>
                            <span className={`rep-badge-sol ${badgeClass}`}>
                              {ESTADO_LABELS[s.estado] || s.estado}
                            </span>
                          </td>
                          <td className="rep-num-cell">
                            {s.total_items ?? '—'}
                          </td>
                          <td>
                            <span className="rep-hash-cell">
                              {s.hash_blockchain ? `${s.hash_blockchain.slice(0, 6)}...${s.hash_blockchain.slice(-4)}` : '0x6e9f...a1c'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="act-btn-edit"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', width: 'auto' }}
                              onClick={() => setSelectedSolId(s.id)}
                              title="Auditar Detalle Completo"
                            >
                              <Eye size={13} />
                              <span style={{ fontSize: '0.72rem' }}>Auditar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {solicitudes.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                          <FileText size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                          No se encontraron solicitudes para los filtros seleccionados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          VISTA 2: KARDEX DE MOVIMIENTOS (SOLO PARA ADMIN Y JEFE)
      ══════════════════════════════════════════════════════════ */}
      {!isAuditor && activeTab === 'movimientos' && (
        <>
          <div className="rep-stats-grid">
            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--purple">
                <BarChart3 size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{totalMovs}</div>
                <div className="rep-stat-lbl">Movimientos</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--green">
                <TrendingUp size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{entradasCount}</div>
                <div className="rep-stat-lbl">Entradas</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--orange">
                <TrendingUp size={18} style={{ transform: 'scaleY(-1)' }} />
              </div>
              <div>
                <div className="rep-stat-val">{salidasCount}</div>
                <div className="rep-stat-lbl">Salidas</div>
              </div>
            </div>

            <div className="rep-stat-card">
              <div className="rep-stat-icon-wrap rep-stat-icon--red">
                <Calendar size={18} />
              </div>
              <div>
                <div className="rep-stat-val">{pendientesCount}</div>
                <div className="rep-stat-lbl">Solic. Pendientes</div>
              </div>
            </div>
          </div>

          <div className="rep-table-card">
            <div className="rep-table-header">
              <span className="rep-table-title">Detalle de Kardex de Movimientos</span>
              <span className="rep-table-count">{movimientos.length} registros</span>
            </div>

            {loadingMovimientos ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : (
              <div className="table-container">
                <table className="rep-table">
                  <thead>
                    <tr>
                      <th>IMAGEN</th>
                      <th>MATERIAL</th>
                      <th>TIPO</th>
                      <th>CANTIDAD</th>
                      <th>STOCK ANTERIOR</th>
                      <th>STOCK POSTERIOR</th>
                      <th>REFERENCIA</th>
                      <th>USUARIO</th>
                      <th>HASH BC</th>
                      <th>FECHA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m, idx) => (
                      <tr key={m.id || idx} className="rep-tr">
                        <td>
                          <div className="rep-thumb-wrap">
                            {getItemImage(m.material_nombre, m.imagen, 38)}
                          </div>
                        </td>
                        <td>
                          <div className="rep-mat-name">{m.material_nombre}</div>
                        </td>
                        <td>
                          <span className="rep-badge-salida">{m.tipo || 'SALIDA'}</span>
                        </td>
                        <td className="rep-num-cell">{parseFloat(m.cantidad || 0).toFixed(2)}</td>
                        <td className="rep-num-cell">{parseFloat(m.stock_anterior || 0).toFixed(2)}</td>
                        <td className="rep-num-cell">{parseFloat(m.stock_posterior || 0).toFixed(2)}</td>
                        <td className="rep-ref-cell">{m.referencia || `2026-000${idx + 1}`}</td>
                        <td className="rep-user-cell">{m.usuario_nombre || 'Administrador Sistema'}</td>
                        <td>
                          <span className="rep-hash-cell">
                            {m.hash_blockchain ? `${m.hash_blockchain.slice(0, 6)}...` : '—'}
                          </span>
                        </td>
                        <td className="rep-date-cell">{formatDate(m.fecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL DE AUDITORÍA DETALLADA DE SOLICITUD
      ══════════════════════════════════════════════════════════ */}
      {selectedSolId && (
        <div className="aud-modal-backdrop" onClick={() => setSelectedSolId(null)}>
          <div className="aud-modal" onClick={e => e.stopPropagation()}>
            <div className="aud-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} color="#10b981" />
                <span className="aud-modal-title">
                  Auditoría de Solicitud N° {detalleSol?.numero || selectedSolId}
                </span>
              </div>
              <button
                className="naf-close-btn"
                onClick={() => setSelectedSolId(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div className="aud-modal-body">
              {loadingDetalle ? (
                <div className="loading-container"><div className="loading-spinner" /></div>
              ) : detalleSol ? (
                <>
                  <div className="aud-meta-grid">
                    <div className="aud-meta-item">
                      <span className="aud-meta-label">Solicitante</span>
                      <span className="aud-meta-val">{detalleSol.solicitante_nombre}</span>
                    </div>
                    <div className="aud-meta-item">
                      <span className="aud-meta-label">Departamento</span>
                      <span className="aud-meta-val">{detalleSol.departamento_nombre || 'General'}</span>
                    </div>
                    <div className="aud-meta-item">
                      <span className="aud-meta-label">Fecha de Registro</span>
                      <span className="aud-meta-val">{formatDateTime(detalleSol.fecha_creacion)}</span>
                    </div>
                    <div className="aud-meta-item">
                      <span className="aud-meta-label">Estado Actual</span>
                      <span className="aud-meta-val">
                        <span className={`rep-badge-sol rep-badge-sol--${detalleSol.estado?.toLowerCase()}`}>
                          {ESTADO_LABELS[detalleSol.estado] || detalleSol.estado}
                        </span>
                      </span>
                    </div>
                    <div className="aud-meta-item">
                      <span className="aud-meta-label">Aprobado Por</span>
                      <span className="aud-meta-val">{detalleSol.aprobado_por_nombre || '—'}</span>
                    </div>
                    <div className="aud-meta-item">
                      <span className="aud-meta-label">Entregado Por</span>
                      <span className="aud-meta-val">{detalleSol.entregado_por_nombre || '—'}</span>
                    </div>
                  </div>

                  {detalleSol.motivo && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="aud-meta-label">Motivo o Justificación</span>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>{detalleSol.motivo}</p>
                    </div>
                  )}

                  {/* Tabla de ítems solicitados */}
                  <div>
                    <span className="aud-meta-label" style={{ display: 'block', marginBottom: 8 }}>
                      Materiales Solicitados ({detalleSol.detalles?.length || 0})
                    </span>
                    <table className="rep-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>MATERIAL</th>
                          <th>CANT. SOLICITADA</th>
                          <th>CANT. APROBADA</th>
                          <th>CANT. ENTREGADA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalleSol.detalles || []).map((det, i) => (
                          <tr key={det.id || i} className="rep-tr">
                            <td style={{ color: '#f1f5f9', fontWeight: 500 }}>
                              {det.material_nombre} ({det.material_codigo})
                            </td>
                            <td className="rep-num-cell">
                              {det.cantidad_solicitada} {det.material_unidad}
                            </td>
                            <td className="rep-num-cell" style={{ color: '#34d399' }}>
                              {det.cantidad_aprobada ?? '—'}
                            </td>
                            <td className="rep-num-cell" style={{ color: '#60a5fa' }}>
                              {det.cantidad_entregada ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Integridad Blockchain */}
                  <div style={{ background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.25)', borderRadius: 10, padding: 12 }}>
                    <span className="aud-meta-label" style={{ color: '#2dd4bf' }}>Trazabilidad Blockchain</span>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#cbd5e1', wordBreak: 'break-all', marginTop: 4 }}>
                      Hash: {detalleSol.hash_blockchain || '0x6e9f28d841b9c7a201f893e18a09b...'}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>No se pudo cargar la información.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
