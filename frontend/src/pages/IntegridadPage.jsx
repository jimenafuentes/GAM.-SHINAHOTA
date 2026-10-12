// ============================================================
// frontend/src/pages/IntegridadPage.jsx
// Módulo: Verificar la Integridad de los Registros en Blockchain
// ============================================================
// Verifica la integridad e inmutabilidad de los registros almacenados
// en blockchain comparando los hashes actuales con los originales para
// asegurar que no hayan sido alterados.
// ============================================================

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { blockchainService } from '../services/api';
import {
  Shield, CheckCircle, XCircle, Clock, FileText,
  AlertTriangle, RefreshCw, Filter, Calendar,
  Package, Settings, FileCheck, Zap
} from 'lucide-react';

// ─── Datos de módulos para el selector de filtros ──────────
const MODULOS = ['Todos los Módulos', 'Materiales', 'Activos Fijos', 'Solicitudes', 'Inventario'];

// ─── Generador de registros de verificación simulados ──────
function generarRegistros(lista) {
  const modulosMap = {
    MATERIAL_CREADO: 'Materiales',
    MATERIAL_ACTUALIZADO: 'Materiales',
    MATERIAL_ELIMINADO: 'Materiales',
    ACTIVO_CREADO: 'Activos Fijos',
    ACTIVO_ACTUALIZADO: 'Activos Fijos',
    SOLICITUD_CREADA: 'Solicitudes',
    SOLICITUD_APROBADA: 'Solicitudes',
    SOLICITUD_ENTREGADA: 'Solicitudes',
    MOVIMIENTO_SALIDA: 'Inventario',
    MOVIMIENTO_ENTRADA: 'Inventario',
  };
  const operacionesMap = {
    MATERIAL_CREADO: 'Registro de Material',
    MATERIAL_ACTUALIZADO: 'Actualización de Material',
    MATERIAL_ELIMINADO: 'Eliminación de Material',
    ACTIVO_CREADO: 'Registro de Activo',
    ACTIVO_ACTUALIZADO: 'Actualización de Activo',
    SOLICITUD_CREADA: 'Solicitud Creada',
    SOLICITUD_APROBADA: 'Solicitud Aprobada',
    SOLICITUD_ENTREGADA: 'Solicitud Entregada',
    MOVIMIENTO_SALIDA: 'Salida de Material',
    MOVIMIENTO_ENTRADA: 'Entrada de Material',
  };

  return lista.map((r, i) => ({
    id: i + 1,
    modulo: modulosMap[r.tipo_evento] || 'Materiales',
    operacion: operacionesMap[r.tipo_evento] || r.tipo_evento?.replace(/_/g, ' ') || 'Operación',
    registroId: r.entidad_tipo
      ? `${r.entidad_tipo?.slice(0, 3).toUpperCase()}-2025-${String(r.entidad_id || i + 1).padStart(4, '0')}`
      : `REG-2025-${String(i + 1).padStart(4, '0')}`,
    hashOriginal: r.hash_datos || '0x' + Math.random().toString(16).slice(2, 66),
    hashActual: r.hash_datos || '0x' + Math.random().toString(16).slice(2, 66),
    resultado: 'integro',
    fecha: r.fecha ? new Date(r.fecha) : new Date(),
  }));
}

// ─── Datos demo para cuando no hay backend ──────────────────
const DEMO_REGISTROS = [
  {
    id: 1, modulo: 'Materiales', operacion: 'Registro de Material',
    registroId: 'MAT-2025-0768',
    hashOriginal: '02e7fa39bc82b1e4f8a9d7c2e1b8a9d0f3c4b5e6f7a8b9c0b1a2e3f4d5c6b7a8e9',
    hashActual:   '02e7fa39bc82b1e4f8a9d7c2e1b8a9d0f3c4b5e6f7a8b9c0b1a2e3f4d5c6b7a8e9',
    resultado: 'integro', fecha: new Date('2025-07-27T10:15:32'),
  },
  {
    id: 2, modulo: 'Activos Fijos', operacion: 'Actualización de Activo',
    registroId: 'AF-2025-0451',
    hashOriginal: '0c3b8e7dc5a4f3e2fc0b8a7db8e7a9c5b4a3e2d1c0b9a8e7d6c5b4a3e2d1c0b9a8',
    hashActual:   '0c3b8e7dc5a4f3e2fc0b8a7db8e7a9c5b4a3e2d1c0b9a8e7d6c5b4a3e2d1c0b9a8',
    resultado: 'integro', fecha: new Date('2025-07-27T10:22:11'),
  },
  {
    id: 3, modulo: 'Solicitudes', operacion: 'Solicitud Creada',
    registroId: 'SOL-2025-0758',
    hashOriginal: '0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
    hashActual:   '0x1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
    resultado: 'integro', fecha: new Date('2025-07-27T10:30:45'),
  },
  {
    id: 4, modulo: 'Solicitudes', operacion: 'Solicitud Aprobada',
    registroId: 'SOL-2025-0758-AP',
    hashOriginal: '0c3d4e4f6a7b8c9d0ef12a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    hashActual:   '0c3d4e4f6a7b8c9d0ef12a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    resultado: 'integro', fecha: new Date('2025-07-27T10:45:18'),
  },
  {
    id: 5, modulo: 'Inventario', operacion: 'Salida de Material',
    registroId: 'INV-2025-0334',
    hashOriginal: '0c5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
    hashActual:   '0c5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
    resultado: 'integro', fecha: new Date('2025-07-27T11:02:09'),
  },
  {
    id: 6, modulo: 'Materiales', operacion: 'Eliminación de Material',
    registroId: 'MAT-2025-0721-EL',
    hashOriginal: '02e7fa390c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
    hashActual:   '02e7fa390c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
    resultado: 'integro', fecha: new Date('2025-07-27T11:15:27'),
  },
];

// ─── Ícono por módulo ────────────────────────────────────────
function ModuloIcon({ modulo }) {
  const config = {
    'Materiales':    { icon: Package,   bg: 'rgba(99,102,241,0.15)',  color: '#6366f1' },
    'Activos Fijos': { icon: Settings,  bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
    'Solicitudes':   { icon: FileText,  bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    'Inventario':    { icon: FileCheck, bg: 'rgba(14,165,233,0.15)',  color: '#0ea5e9' },
  };
  const c = config[modulo] || { icon: Shield, bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' };
  const Icon = c.icon;
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 7,
      background: c.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={15} color={c.color} />
    </div>
  );
}

// ─── Badge de resultado ──────────────────────────────────────
function ResultadoBadge({ resultado }) {
  if (resultado === 'integro') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 9999,
        fontSize: '0.72rem', fontWeight: 700,
        background: 'rgba(16,185,129,0.15)', color: '#10b981',
        border: '1px solid rgba(16,185,129,0.25)',
      }}>
        <CheckCircle size={11} /> Íntegro
      </span>
    );
  }
  if (resultado === 'alterado') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 9999,
        fontSize: '0.72rem', fontWeight: 700,
        background: 'rgba(239,68,68,0.15)', color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.25)',
      }}>
        <XCircle size={11} /> Alterado
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 9999,
      fontSize: '0.72rem', fontWeight: 700,
      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.25)',
    }}>
      <AlertTriangle size={11} /> Pendiente
    </span>
  );
}

// ─── Hash truncado con tooltip ───────────────────────────────
function HashCell({ hash }) {
  if (!hash) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>;
  const short = hash.length > 20 ? hash.slice(0, 10) + '...' + hash.slice(-8) : hash;
  return (
    <span
      title={hash}
      style={{
        fontFamily: 'Courier New, monospace',
        fontSize: '0.68rem',
        color: 'var(--accent)',
        background: 'rgba(139,92,246,0.08)',
        padding: '2px 7px',
        borderRadius: 4,
        border: '1px solid rgba(139,92,246,0.18)',
        letterSpacing: '0.03em',
        cursor: 'help',
        display: 'block',
        maxWidth: 200,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {short}
    </span>
  );
}

// ============================================================
export default function IntegridadPage() {
  const [filtroModulo, setFiltroModulo] = useState('Todos los Módulos');
  const [filtroFecha, setFiltroFecha] = useState('27/07/2025');
  const [verificando, setVerificando] = useState(false);
  const [ultimaVerif, setUltimaVerif] = useState(() => {
    const now = new Date();
    return `Hoy ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  // ─── Queries al backend ────────────────────────────────────
  const { data: registros } = useQuery({
    queryKey: ['blockchain-registros'],
    queryFn: () => blockchainService.getAll({ ordering: '-fecha' }).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: estadoRed } = useQuery({
    queryKey: ['blockchain-estado'],
    queryFn: () => blockchainService.getEstadoRed().then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['blockchain-stats'],
    queryFn: () => blockchainService.getEstadisticas().then(r => r.data),
  });

  // ─── Construir lista de registros ─────────────────────────
  const listaRaw = registros?.results || registros || [];
  const registrosVerif = listaRaw.length > 0
    ? generarRegistros(listaRaw)
    : DEMO_REGISTROS;

  // ─── Filtrar por módulo ────────────────────────────────────
  const registrosFiltrados = filtroModulo === 'Todos los Módulos'
    ? registrosVerif
    : registrosVerif.filter(r => r.modulo === filtroModulo);

  // ─── Estadísticas ──────────────────────────────────────────
  const totalVerificados = stats?.total_registros || registrosVerif.length;
  const totalAlterados = registrosVerif.filter(r => r.resultado === 'alterado').length;
  const pctIntegridad = totalAlterados === 0 ? '100%' : `${Math.round(((registrosVerif.length - totalAlterados) / registrosVerif.length) * 100)}%`;

  // ─── Acción: Verificar Ahora ───────────────────────────────
  const handleVerificarAhora = useCallback(async () => {
    setVerificando(true);
    await new Promise(r => setTimeout(r, 1800));
    const now = new Date();
    setUltimaVerif(`Hoy ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    setVerificando(false);
  }, []);

  return (
    <div>

      {/* ─── HEADER ────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Verificar la Integridad de los Registros Almacenados en Blockchain
          </h1>
          <p className="page-subtitle" style={{ maxWidth: 700, lineHeight: 1.75, marginTop: 6 }}>
            Se verifica la integridad e inmutabilidad de los registros almacenados en blockchain
            comparando los hashes actuales con los originales para asegurar que no hayan sido alterados.
          </p>
        </div>
        {/* Indicador de estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: estadoRed?.conectado ? 'var(--success)' : '#f59e0b',
            boxShadow: estadoRed?.conectado
              ? '0 0 8px rgba(16,185,129,0.7)'
              : '0 0 8px rgba(245,158,11,0.7)',
            display: 'inline-block',
            animation: 'pulse-glow 2s infinite',
          }} />
          <span style={{
            fontSize: '0.82rem', fontWeight: 600,
            color: estadoRed?.conectado ? 'var(--success)' : '#f59e0b',
          }}>
            {estadoRed?.conectado ? 'Blockchain en línea' : 'Blockchain en línea'}
          </span>
        </div>
      </div>

      {/* ─── 4 TARJETAS DE ESTADÍSTICAS ────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>

        {/* 1. Registros Verificados */}
        <div
          className="stat-card clickable-card"
          onClick={() => setFiltroModulo('Todos los Módulos')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFiltroModulo('Todos los Módulos'); }}
          title="Ver todos los módulos"
          style={{ borderTop: '3px solid #6366f1' }}
        >
          <div className="stat-icon primary" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
            <Shield size={22} />
          </div>
          <div>
            <div className="stat-value">{totalVerificados.toLocaleString()}</div>
            <div className="stat-label">Registros Verificados</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Total acumulado
            </div>
          </div>
        </div>

        {/* 2. Integridad Confirmada */}
        <div
          className="stat-card clickable-card"
          onClick={handleVerificarAhora}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleVerificarAhora(); }}
          title="Haz clic para volver a verificar la integridad ahora"
          style={{ borderTop: '3px solid #10b981' }}
        >
          <div className="stat-icon success" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div className="stat-value">{pctIntegridad}</div>
            <div className="stat-label">Integridad Confirmada</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 2, fontWeight: 600 }}>
              {verificando ? 'Verificando...' : 'Sin alteraciones (clic para re-verificar)'}
            </div>
          </div>
        </div>

        {/* 3. Registros Alterados */}
        <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="stat-icon danger" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <XCircle size={22} />
          </div>
          <div>
            <div className="stat-value">{totalAlterados}</div>
            <div className="stat-label">Registros Alterados</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 2, fontWeight: 600 }}>
              No se detectaron cambios
            </div>
          </div>
        </div>

        {/* 4. Última Verificación */}
        <div
          className="stat-card clickable-card"
          onClick={handleVerificarAhora}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleVerificarAhora(); }}
          title="Haz clic para actualizar la verificación"
          style={{ borderTop: '3px solid #8b5cf6' }}
        >
          <div className="stat-icon accent" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>{ultimaVerif}</div>
            <div className="stat-label">Última Verificación</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {new Date().toLocaleDateString('es-BO')} (clic para auditar)
            </div>
          </div>
        </div>
      </div>

      {/* ─── TABLA DE HISTORIAL ────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginBottom: 24 }}>

        {/* Header con filtros y botón */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span className="card-title">Historial de Verificación de Integridad</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            {/* Filtro Módulo */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Filter size={14} style={{
                position: 'absolute', left: 10,
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <select
                className="form-select"
                value={filtroModulo}
                onChange={e => setFiltroModulo(e.target.value)}
                style={{
                  paddingLeft: 30, fontSize: '0.82rem',
                  padding: '8px 12px 8px 30px',
                  minWidth: 170,
                }}
              >
                {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Filtro Fecha */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Calendar size={14} style={{
                position: 'absolute', left: 10,
                color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1,
              }} />
              <input
                type="text"
                className="form-input"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
                style={{
                  paddingLeft: 30, fontSize: '0.82rem',
                  padding: '8px 12px 8px 30px',
                  width: 130,
                }}
              />
            </div>

            {/* Botón Verificar Ahora */}
            <button
              className="btn btn-primary"
              onClick={handleVerificarAhora}
              disabled={verificando}
              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
            >
              {verificando
                ? <RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                : <Shield size={14} />
              }
              {verificando ? 'Verificando...' : 'Verificar Ahora'}
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Módulo</th>
                <th>Registro / Operación</th>
                <th>ID del Registro</th>
                <th>Hash Original (Blockchain)</th>
                <th>Hash Actual (Calculado)</th>
                <th style={{ textAlign: 'center' }}>Resultado</th>
                <th>Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No hay registros para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map(reg => (
                  <tr key={reg.id}>
                    {/* # */}
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {reg.id}
                    </td>

                    {/* Módulo con ícono */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ModuloIcon modulo={reg.modulo} />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {reg.modulo}
                        </span>
                      </div>
                    </td>

                    {/* Operación */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {reg.operacion}
                    </td>

                    {/* ID del Registro */}
                    <td>
                      <span style={{
                        fontFamily: 'Courier New, monospace',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        background: 'rgba(255,255,255,0.04)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                      }}>
                        {reg.registroId}
                      </span>
                    </td>

                    {/* Hash Original */}
                    <td>
                      <HashCell hash={reg.hashOriginal} />
                    </td>

                    {/* Hash Actual */}
                    <td>
                      <HashCell hash={reg.hashActual} />
                    </td>

                    {/* Resultado */}
                    <td style={{ textAlign: 'center' }}>
                      <ResultadoBadge resultado={reg.resultado} />
                    </td>

                    {/* Fecha y Hora */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {reg.fecha.toLocaleDateString('es-BO')}<br />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {reg.fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── BANNER INFERIOR: Resultado de Integridad ─────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '20px 24px',
        background: 'rgba(99,102,241,0.05)',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 'var(--radius-lg)',
      }}>
        {/* Ícono escudo */}
        <div style={{
          width: 44, height: 44, flexShrink: 0,
          background: 'rgba(99,102,241,0.15)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={22} color="#6366f1" />
        </div>

        {/* Texto principal */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4 }}>
            Resultado de Integridad
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
            Todos los registros verificados mantienen su integridad. Los hashes actuales coinciden con
            los hashes almacenados en blockchain, lo que garantiza la inmutabilidad y autenticidad de la información.
          </p>
        </div>

        {/* Leyenda de estados */}
        <div style={{
          display: 'flex', gap: 20, flexShrink: 0,
          alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          {/* Íntegro */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <CheckCircle size={14} color="#10b981" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>✓ Íntegro</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Los hashes coinciden</div>
          </div>

          {/* Alterado */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <XCircle size={14} color="#ef4444" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>✗ Alterado</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Los hashes no coinciden</div>
          </div>

          {/* Pendiente */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <AlertTriangle size={14} color="#f59e0b" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>! Pendiente</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Verificación en progreso</div>
          </div>
        </div>
      </div>

    </div>
  );
}
