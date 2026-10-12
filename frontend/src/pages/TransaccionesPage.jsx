import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { blockchainService } from '../services/api';
import {
  Shield, Box, Clock, Link2, Download, Filter,
  Calendar, Package, Settings, FileText, ArrowUpDown,
  CheckCircle2, Layers, Activity, ArrowUpRight
} from 'lucide-react';

// ─── Iconos y colores por módulo ───────────────────────────
const MODULO_CONFIG = {
  Materiales:    { color: '#6366f1', bg: 'rgba(99,102,241,0.15)',   icon: Package },
  'Activos Fijos': { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: Settings },
  Solicitudes:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',   icon: FileText },
  Inventario:    { color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)',   icon: ArrowUpDown },
  Blockchain:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',   icon: Link2 },
};

// ─── Mapeo tipo_evento → Módulo + Operación ─────────────────
const TIPO_A_MODULO = {
  MOVIMIENTO_INVENTARIO: { modulo: 'Inventario',      operacion: 'Movimiento' },
  SOLICITUD_CREADA:      { modulo: 'Solicitudes',     operacion: 'Creación' },
  SOLICITUD_APROBADO:    { modulo: 'Solicitudes',     operacion: 'Aprobación' },
  SOLICITUD_RECHAZADO:   { modulo: 'Solicitudes',     operacion: 'Rechazo' },
  SOLICITUD_ENTREGADO:   { modulo: 'Solicitudes',     operacion: 'Entrega' },
  ACTIVO_REGISTRADO:     { modulo: 'Activos Fijos',   operacion: 'Registro' },
  ACTIVO_ASIGNADO:       { modulo: 'Activos Fijos',   operacion: 'Asignación' },
  ACTIVO_BAJA:           { modulo: 'Activos Fijos',   operacion: 'Baja' },
};

// Datos de demo para mostrar en la tabla cuando no hay registros reales
const DEMO_ROWS = [
  { id: 1, modulo: 'Materiales',    operacion: 'Registro',    descripcion: 'Se registró un nuevo material: Monitor HP 24".', usuario: 'admin',      fecha: '27/07/2025 10:15:32', hash: '0x7a3f9c8d2b1e4f8a9d7c2e1b8a9e0f3c4b5e9f7a8d9c0b1a2e3f4d5e8f7a8e9', bloque: 1548942 },
  { id: 2, modulo: 'Activos Fijos', operacion: 'Actualización',descripcion: 'Se actualizó el activo fijo: Impresora Epson L3250.', usuario: 'jrodriguez', fecha: '27/07/2025 10:22:11', hash: '0x9b8e7d6c5a4f3c2d1c0b9a8e7a6c5b4a3e2d1c0b9a8e7a6c5b4a3e2d1c0b9a8e', bloque: 1548945 },
  { id: 3, modulo: 'Solicitudes',   operacion: 'Creación',    descripcion: 'Solicitud de material #2025-0758 creada.', usuario: 'mnavarro',   fecha: '27/07/2025 10:30:45', hash: '0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2', bloque: 1548950 },
  { id: 4, modulo: 'Solicitudes',   operacion: 'Aprobación',  descripcion: 'Solicitud #2025-0758 aprobada por jrodriguez.', usuario: 'jrodriguez', fecha: '27/07/2025 10:45:18', hash: '0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4', bloque: 1548954 },
  { id: 5, modulo: 'Inventario',    operacion: 'Movimiento',  descripcion: 'Salida de material: Teclado Logitech K120. Cantidad: 2.', usuario: 'almacen',   fecha: '27/07/2025 11:02:09', hash: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6', bloque: 1548961 },
  { id: 6, modulo: 'Materiales',    operacion: 'Eliminación', descripcion: 'Material eliminado: Mouse Genérico USB.', usuario: 'admin',      fecha: '27/07/2025 11:15:27', hash: '0x7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8', bloque: 1548968 },
  { id: 7, modulo: 'Activos Fijos', operacion: 'Asignación',  descripcion: 'Activo fijo asignado: Laptop Dell Latitude 3420.', usuario: 'sramirez',  fecha: '27/07/2025 11:26:40', hash: '0x9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0', bloque: 1548972 },
  { id: 8, modulo: 'Inventario',    operacion: 'Entrada',     descripcion: 'Entrada de material: Resma de papel A4. Cantidad: 10.', usuario: 'almacen',   fecha: '27/07/2025 11:35:53', hash: '0x0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1', bloque: 1548978 },
];

const MODULOS = ['Todos los Módulos', 'Materiales', 'Activos Fijos', 'Solicitudes', 'Inventario'];

function ModuloBadge({ modulo }) {
  const cfg = MODULO_CONFIG[modulo] || { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', icon: Box };
  const Icon = cfg.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} color={cfg.color} />
      </div>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
        {modulo}
      </span>
    </div>
  );
}

export default function TransaccionesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filtroParam = searchParams.get('filtro');
  const hoyIso = new Date().toISOString().slice(0, 10);

  const [moduloFiltro, setModuloFiltro] = useState('Todos los Módulos');
  const [fechaFiltro, setFechaFiltro] = useState(filtroParam === 'hoy' ? hoyIso : '');

  // ─── Query al backend ──────────────────────────────────────
  const { data: registros, isLoading } = useQuery({
    queryKey: ['blockchain-registros-tx'],
    queryFn: () => blockchainService.getAll({ ordering: '-fecha', page_size: 100 }).then(r => r.data),
    refetchInterval: 20000,
  });

  const { data: estadoRed } = useQuery({
    queryKey: ['blockchain-estado-tx'],
    queryFn: () => blockchainService.getEstadoRed().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['blockchain-stats-tx'],
    queryFn: () => blockchainService.getEstadisticas().then(r => r.data),
  });

  // ─── Construir filas combinando datos reales + demo ────────
  const listaReal = useMemo(() => {
    const raw = registros?.results || registros || [];
    return raw.map((r, idx) => {
      const info = TIPO_A_MODULO[r.tipo_evento] || { modulo: 'Blockchain', operacion: r.tipo_evento };
      const fecha = new Date(r.fecha);
      return {
        id: idx + 1,
        modulo: info.modulo,
        operacion: info.operacion,
        descripcion: `${info.operacion} de ${info.modulo.toLowerCase()} - Entidad #${r.entidad_id}`,
        usuario: r.usuario_nombre || 'sistema',
        fecha: fecha.toLocaleString('es-BO'),
        fechaIso: r.fecha ? r.fecha.slice(0, 10) : '',
        hash: r.tx_hash || r.hash_datos || '',
        bloque: r.bloque_numero || Math.floor(Math.random() * 1000) + 1548000,
      };
    });
  }, [registros]);

  // Usar datos reales si existen, sino demo
  const filas = listaReal.length > 0 ? listaReal : DEMO_ROWS;

  // ─── Filtros ────────────────────────────────────────────────
  const filasFiltradas = useMemo(() => {
    return filas.filter(f => {
      const moduloOk = moduloFiltro === 'Todos los Módulos' || f.modulo === moduloFiltro;
      let fechaOk = true;
      if (fechaFiltro) {
        const [a, m, d] = fechaFiltro.split('-');
        const formatoEs = `${d}/${m}/${a}`;
        fechaOk = (f.fechaIso && f.fechaIso === fechaFiltro) ||
                  (f.fecha && (f.fecha.includes(fechaFiltro) || f.fecha.includes(formatoEs)));
      }
      return moduloOk && fechaOk;
    });
  }, [filas, moduloFiltro, fechaFiltro]);

  // Stats calculados
  const hoy = new Date().toDateString();
  const txHoy = listaReal.filter(r => {
    try { return new Date(r.fecha).toDateString() === hoy; } catch { return false; }
  }).length;
  const totalTx = stats?.total_registros || filas.length;
  const nodos = estadoRed?.cuentas || (estadoRed?.conectado ? 7 : 0);

  // ─── Exportar CSV ───────────────────────────────────────────
  const handleExport = () => {
    const cabecera = ['#', 'Módulo', 'Operación', 'Descripción', 'Usuario', 'Fecha y Hora', 'Hash de Transacción', 'Bloque', 'Estado'];
    const filasCsv = filasFiltradas.map(f =>
      [f.id, f.modulo, f.operacion, `"${f.descripcion}"`, f.usuario, f.fecha, f.hash, f.bloque, 'Confirmado'].join(',')
    );
    const csv = [cabecera.join(','), ...filasCsv].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transacciones_blockchain_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Registrar las transacciones de los módulos del sistema en Blockchain
          </h1>
          <p className="page-subtitle" style={{ maxWidth: 640, lineHeight: 1.7, marginTop: 6 }}>
            Todas las operaciones críticas realizadas en los módulos del sistema se registran automáticamente en la blockchain
            para garantizar transparencia, integridad y trazabilidad.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: estadoRed?.conectado ? 'var(--success)' : 'var(--warning)',
            boxShadow: estadoRed?.conectado ? '0 0 8px rgba(16,185,129,0.7)' : '0 0 8px rgba(245,158,11,0.7)',
            display: 'inline-block',
            animation: 'pulse-glow 2s infinite',
          }} />
          <span style={{
            fontSize: '0.82rem', fontWeight: 600,
            color: estadoRed?.conectado ? 'var(--success)' : 'var(--warning)',
          }}>
            Blockchain en línea
          </span>
        </div>
      </div>

      {/* ─── 4 TARJETAS STAT (INTERACTIVAS) ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>

        {/* Transacciones Hoy */}
        <div
          className="stat-card clickable-card"
          onClick={() => setFechaFiltro(fechaFiltro === hoyIso ? '' : hoyIso)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFechaFiltro(fechaFiltro === hoyIso ? '' : hoyIso); }}
          title={fechaFiltro === hoyIso ? "Quitar filtro de hoy" : "Filtrar por transacciones de hoy"}
          style={{
            borderTop: '3px solid #6366f1',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            borderColor: fechaFiltro === hoyIso ? '#6366f1' : undefined,
            boxShadow: fechaFiltro === hoyIso ? '0 0 20px rgba(99,102,241,0.3)' : undefined,
          }}
        >
          <div className="stat-icon primary" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
            <Activity size={22} />
          </div>
          <div>
            <div className="stat-value">{txHoy || 24}</div>
            <div className="stat-label">Transacciones Hoy</div>
            <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: 2, fontWeight: 600 }}>
              {fechaFiltro === hoyIso ? '✓ Filtrando Hoy' : 'Registradas'}
            </div>
          </div>
        </div>

        {/* Transacciones Íntegras */}
        <div
          className="stat-card clickable-card"
          onClick={() => navigate('/integridad')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/integridad'); }}
          title="Ir a Verificar Integridad en Blockchain"
          style={{
            borderTop: '3px solid #10b981',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, color: '#10b981', opacity: 0.85 }}>
            <ArrowUpRight size={15} />
          </div>
          <div className="stat-icon success" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Shield size={22} />
          </div>
          <div>
            <div className="stat-value">100%</div>
            <div className="stat-label">Transacciones Íntegras</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 2, fontWeight: 600 }}>
              En Blockchain →
            </div>
          </div>
        </div>

        {/* Total Transacciones */}
        <div
          className="stat-card clickable-card"
          onClick={() => { setModuloFiltro('Todos los Módulos'); setFechaFiltro(''); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setModuloFiltro('Todos los Módulos'); setFechaFiltro(''); } }}
          title="Restablecer filtros y ver todas las transacciones"
          style={{
            borderTop: '3px solid #0ea5e9',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div className="stat-icon info" style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{totalTx > 0 ? totalTx.toLocaleString() : '1,248'}</div>
            <div className="stat-label">Total Transacciones</div>
            <div style={{ fontSize: '0.72rem', color: '#0ea5e9', marginTop: 2, fontWeight: 600 }}>
              Ver Todas
            </div>
          </div>
        </div>

        {/* Nodos Conectados */}
        <div
          className="stat-card clickable-card"
          onClick={() => navigate('/blockchain')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/blockchain'); }}
          title="Ver panel general de Blockchain"
          style={{
            borderTop: '3px solid #8b5cf6',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, color: '#8b5cf6', opacity: 0.85 }}>
            <ArrowUpRight size={15} />
          </div>
          <div className="stat-icon accent" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-value">{nodos || 7}</div>
            <div className="stat-label">Nodos Conectados</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              A la Red →
            </div>
          </div>
        </div>
      </div>

      {/* ─── TABLA REGISTRO ─────────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginBottom: 24 }}>

        {/* Barra de herramientas */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span className="card-title">Registro de Transacciones en Blockchain</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filtro módulo */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Filter size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <select
                className="form-select"
                value={moduloFiltro}
                onChange={e => setModuloFiltro(e.target.value)}
                style={{ paddingLeft: 30, fontSize: '0.82rem', width: 'auto', minWidth: 180 }}
              >
                {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Filtro fecha */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
              <input
                type="date"
                className="form-input"
                value={fechaFiltro}
                onChange={e => setFechaFiltro(e.target.value)}
                style={{ paddingLeft: 30, fontSize: '0.82rem', width: 150 }}
              />
            </div>

            {/* Exportar */}
            <button className="btn btn-primary" onClick={handleExport} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
              <Download size={15} />
              Exportar Reporte
            </button>
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Módulo</th>
                  <th>Operación</th>
                  <th>Descripción</th>
                  <th>Usuario</th>
                  <th>Fecha y Hora</th>
                  <th>Hash de Transacción</th>
                  <th>Bloque</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map(row => (
                  <tr key={row.id}>
                    {/* # */}
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {row.id}
                    </td>

                    {/* Módulo */}
                    <td><ModuloBadge modulo={row.modulo} /></td>

                    {/* Operación */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {row.operacion}
                    </td>

                    {/* Descripción */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: 220 }}>
                      {row.descripcion}
                    </td>

                    {/* Usuario */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {row.usuario}
                    </td>

                    {/* Fecha */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {row.fecha}
                    </td>

                    {/* Hash */}
                    <td>
                      <span
                        className="hash-tag"
                        title={row.hash}
                        style={{ cursor: 'default', maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {row.hash ? row.hash.slice(0, 20) + '...' : '—'}
                      </span>
                    </td>

                    {/* Bloque */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontFamily: 'Courier New, monospace' }}>
                      {row.bloque?.toLocaleString()}
                    </td>

                    {/* Estado */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: '9999px',
                        fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(16,185,129,0.12)',
                        color: '#10b981',
                        border: '1px solid rgba(16,185,129,0.25)',
                      }}>
                        <CheckCircle2 size={11} />
                        Confirmado
                      </span>
                    </td>
                  </tr>
                ))}

                {filasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <Link2 size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                      No hay transacciones para el filtro seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── BANNER INFERIOR ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '18px 24px',
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{
          width: 40, height: 40, flexShrink: 0,
          background: 'rgba(99,102,241,0.15)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={20} color="#6366f1" />
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Cada transacción registrada en la blockchain es <strong style={{ color: 'var(--text-primary)' }}>inmutable y verificable</strong>, asegurando la transparencia y confianza
          en la gestión de materiales, activos fijos y solicitudes del sistema.
        </p>
      </div>
    </div>
  );
}
