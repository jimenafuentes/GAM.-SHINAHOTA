import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { blockchainService } from '../services/api';
import toast from 'react-hot-toast';
import {
  Shield, Box, Clock, Link2, Download, Search, CheckCircle,
  XCircle, Wifi, WifiOff, Edit3, Trash2, FileText, CheckSquare,
  Package, Settings, ArrowUpRight, ChevronDown
} from 'lucide-react';

// ============================================================
// Definición estática de las 7 operaciones monitoreadas
// (igual que en la imagen de referencia)
// ============================================================
const OPERACIONES_SISTEMA = [
  {
    id: 1,
    operacion: 'Registro de Material',
    descripcion: 'Creación de nuevos materiales en inventario.',
    cuando: 'Al crear',
    datos: 'ID, nombre, categoría, stock inicial, fecha, usuario',
    impacto: 'Alta',
    icon: Package,
    iconColor: '#6366f1',
    iconBg: 'rgba(99,102,241,0.15)',
  },
  {
    id: 2,
    operacion: 'Actualización de Material',
    descripcion: 'Modificación de datos de materiales existentes.',
    cuando: 'Al actualizar',
    datos: 'ID, campos modificados, valores anteriores y nuevos, fecha, usuario',
    impacto: 'Alta',
    icon: Edit3,
    iconColor: '#10b981',
    iconBg: 'rgba(16,185,129,0.15)',
  },
  {
    id: 3,
    operacion: 'Eliminación de Material',
    descripcion: 'Eliminación lógica de materiales del inventario.',
    cuando: 'Al eliminar',
    datos: 'ID, datos del material eliminado, fecha, usuario',
    impacto: 'Alta',
    icon: Trash2,
    iconColor: '#ef4444',
    iconBg: 'rgba(239,68,68,0.15)',
  },
  {
    id: 4,
    operacion: 'Registro de Activo Fijo',
    descripcion: 'Alta de nuevos activos fijos.',
    cuando: 'Al crear',
    datos: 'ID, código, descripción, ubicación, valor, responsable, fecha',
    impacto: 'Alta',
    icon: Settings,
    iconColor: '#10b981',
    iconBg: 'rgba(16,185,129,0.15)',
  },
  {
    id: 5,
    operacion: 'Actualización de Activo Fijo',
    descripcion: 'Modificación de datos de activos fijos.',
    cuando: 'Al actualizar',
    datos: 'ID, campos modificados, valores anteriores y nuevos, fecha, usuario',
    impacto: 'Alta',
    icon: Edit3,
    iconColor: '#8b5cf6',
    iconBg: 'rgba(139,92,246,0.15)',
  },
  {
    id: 6,
    operacion: 'Creación de Solicitud',
    descripcion: 'Registro de nuevas solicitudes de material.',
    cuando: 'Al crear',
    datos: 'ID, solicitante, ítems, estado, fecha, observaciones',
    impacto: 'Media',
    icon: FileText,
    iconColor: '#f59e0b',
    iconBg: 'rgba(245,158,11,0.15)',
  },
  {
    id: 7,
    operacion: 'Aprobación/Entrega de Solicitud',
    descripcion: 'Aprobación y entrega de solicitudes.',
    cuando: 'Al aprobar/entregar',
    datos: 'ID, aprobador, ítems entregados, estado, fecha, observaciones',
    impacto: 'Media',
    icon: CheckSquare,
    iconColor: '#10b981',
    iconBg: 'rgba(16,185,129,0.15)',
  },
];

function ImpactoBadge({ nivel }) {
  if (nivel === 'Alta') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
        borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
        background: 'rgba(16,185,129,0.15)', color: '#10b981',
        border: '1px solid rgba(16,185,129,0.25)',
      }}>Alta</span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.25)',
    }}>Media</span>
  );
}

export default function BlockchainPage() {
  const navigate = useNavigate();
  const tablaOperacionesRef = useRef(null);
  const [highlightTabla, setHighlightTabla] = useState(false);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showVerify, setShowVerify] = useState(false);

  const handleScrollToOperaciones = () => {
    tablaOperacionesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightTabla(true);
    setTimeout(() => setHighlightTabla(false), 2000);
  };

  // ─── Queries al backend ───────────────────────────────────
  const { data: registros } = useQuery({
    queryKey: ['blockchain-registros'],
    queryFn: () => blockchainService.getAll({ ordering: '-fecha' }).then(r => r.data),
    refetchInterval: 15000,
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

  // ─── Verificar hash ───────────────────────────────────────
  const handleVerify = async () => {
    if (!verifyHash.trim()) return;
    setVerifying(true);
    try {
      const res = await blockchainService.verificar(verifyHash.trim());
      setVerifyResult(res.data);
    } catch {
      setVerifyResult({ valido: false, mensaje: 'Error al comunicarse con el servidor' });
    } finally {
      setVerifying(false);
    }
  };

  const handleQuickVerify = (hash) => {
    if (!hash) return;
    setVerifyHash(hash);
    setShowVerify(true);
    setVerifying(true);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hash);
      toast.success('Hash copiado al portapapeles');
    }
    blockchainService.verificar(hash)
      .then(res => setVerifyResult(res.data))
      .catch(() => setVerifyResult({ valido: false, mensaje: 'Error al verificar hash' }))
      .finally(() => setVerifying(false));
  };

  // ─── Exportar reporte (CSV simulado) ─────────────────────
  const handleExport = () => {
    const cabecera = ['#', 'Operación', 'Descripción', 'Cuándo se Registra', 'Ejemplo de Datos Almacenados', 'Impacto'];
    const filas = OPERACIONES_SISTEMA.map(op =>
      [op.id, op.operacion, op.descripcion, op.cuando, op.datos, op.impacto].join(',')
    );
    const csv = [cabecera.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'operaciones_blockchain.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Conteo de transacciones hoy
  const lista = registros?.results || registros || [];
  const hoy = new Date().toDateString();
  const txHoy = lista.filter(r => new Date(r.fecha).toDateString() === hoy).length;

  return (
    <div>

      {/* ─── HEADER ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Operaciones del Sistema que se Almacenan en Blockchain</h1>
          <p className="page-subtitle" style={{ maxWidth: 680, lineHeight: 1.7, marginTop: 6 }}>
            Estas operaciones críticas e inmutables son registradas en la blockchain para garantizar transparencia, integridad
            y trazabilidad de la información en el sistema.
          </p>
        </div>
        {/* Indicador de estado de red */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: estadoRed?.conectado ? 'var(--success)' : 'var(--warning)',
            boxShadow: estadoRed?.conectado
              ? '0 0 8px rgba(16,185,129,0.7)'
              : '0 0 8px rgba(245,158,11,0.7)',
            display: 'inline-block',
            animation: 'pulse-glow 2s infinite',
          }} />
          <span style={{
            fontSize: '0.82rem', fontWeight: 600,
            color: estadoRed?.conectado ? 'var(--success)' : 'var(--warning)',
          }}>
            {estadoRed?.conectado ? 'Blockchain en línea' : 'Modo Hash-Only'}
          </span>
        </div>
      </div>

      {/* ─── 4 TARJETAS DE ESTADÍSTICAS (INTERACTIVAS) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Tarjeta 1: Tipos de Operaciones */}
        <div
          className="stat-card clickable-card"
          onClick={handleScrollToOperaciones}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleScrollToOperaciones(); }}
          title="Haz clic para ver las 7 operaciones monitoreadas en la tabla"
          style={{
            borderTop: '3px solid #6366f1',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
            <ChevronDown size={16} />
          </div>
          <div className="stat-icon primary" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
            <Box size={22} />
          </div>
          <div>
            <div className="stat-value">7</div>
            <div className="stat-label">Tipos de Operaciones</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Monitoreadas en blockchain
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Integridad */}
        <div
          className="stat-card clickable-card"
          onClick={() => navigate('/integridad')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/integridad'); }}
          title="Haz clic para abrir la vista de Verificar Integridad"
          style={{
            borderTop: '3px solid #10b981',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, color: '#10b981', opacity: 0.85 }}>
            <ArrowUpRight size={16} />
          </div>
          <div className="stat-icon success" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <Shield size={22} />
          </div>
          <div>
            <div className="stat-value">100%</div>
            <div className="stat-label">Integridad de Datos</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 2, fontWeight: 600 }}>
              Garantizada
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Transacciones Hoy */}
        <div
          className="stat-card clickable-card"
          onClick={() => navigate('/transacciones?filtro=hoy')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/transacciones?filtro=hoy'); }}
          title="Haz clic para ver las transacciones de hoy en el registro"
          style={{
            borderTop: '3px solid #0ea5e9',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, color: '#0ea5e9', opacity: 0.85 }}>
            <ArrowUpRight size={16} />
          </div>
          <div className="stat-icon info" style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{txHoy || stats?.total_registros || 0}</div>
            <div className="stat-label">Transacciones Hoy</div>
            <div style={{ fontSize: '0.72rem', color: '#0ea5e9', marginTop: 2, fontWeight: 600 }}>
              Registradas
            </div>
          </div>
        </div>

        {/* Tarjeta 4: Registros Blockchain */}
        <div
          className="stat-card clickable-card"
          onClick={() => navigate('/transacciones')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/transacciones'); }}
          title="Haz clic para ver todos los registros en Blockchain"
          style={{
            borderTop: '3px solid #8b5cf6',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, color: '#8b5cf6', opacity: 0.85 }}>
            <ArrowUpRight size={16} />
          </div>
          <div className="stat-icon accent" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <Link2 size={22} />
          </div>
          <div>
            <div className="stat-value">{stats?.total_registros || 0}</div>
            <div className="stat-label">Registros Blockchain</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Últimos 2 meses
            </div>
          </div>
        </div>
      </div>

      {/* ─── TABLA DE OPERACIONES ────────────────────────── */}
      <div
        ref={tablaOperacionesRef}
        id="tabla-operaciones"
        className="card"
        style={{
          padding: 0,
          marginBottom: 24,
          transition: 'all 0.4s ease',
          boxShadow: highlightTabla ? '0 0 30px rgba(99,102,241,0.5)' : undefined,
          borderColor: highlightTabla ? '#6366f1' : undefined,
        }}
      >
        {/* Header de la tabla */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span className="card-title">Listado de Operaciones Almacenadas en Blockchain</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowVerify(!showVerify)}
              style={{ fontSize: '0.82rem', padding: '8px 14px' }}
            >
              <Search size={15} />
              Verificar Hash
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              style={{ fontSize: '0.82rem', padding: '8px 16px' }}
            >
              <Download size={15} />
              Exportar Reporte
            </button>
          </div>
        </div>

        {/* Panel de verificación de hash (colapsable) */}
        {showVerify && (
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(99,102,241,0.04)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  className="form-input"
                  placeholder="Ingrese hash SHA-256 para verificar (ej: a3f9b2c1...)"
                  value={verifyHash}
                  onChange={e => { setVerifyHash(e.target.value); setVerifyResult(null); }}
                  style={{ fontFamily: 'Courier New, monospace', fontSize: '0.85rem' }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleVerify}
                disabled={verifying || !verifyHash.trim()}
              >
                <Search size={16} />
                {verifying ? 'Verificando...' : 'Verificar'}
              </button>
            </div>
            {verifyResult && (
              <div style={{
                marginTop: 12, padding: '16px 20px', borderRadius: 12,
                background: verifyResult.valido ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${verifyResult.valido ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: verifyResult.valido ? 12 : 0 }}>
                  {verifyResult.valido
                    ? <CheckCircle size={20} color="var(--success)" />
                    : <XCircle size={20} color="var(--danger)" />
                  }
                  <span style={{ fontWeight: 700, color: verifyResult.valido ? 'var(--success)' : 'var(--danger)', fontSize: '0.95rem' }}>
                    {verifyResult.valido ? '✓ Hash Válido — Registro Inmutable Confirmado en Blockchain' : (verifyResult.mensaje || 'Hash No Encontrado')}
                  </span>
                </div>

                {verifyResult.valido && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12,
                    paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.82rem'
                  }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>TIPO DE EVENTO</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>{verifyResult.tipo_evento || verifyResult.tipo_evento_code}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>FECHA Y HORA</div>
                      <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>{verifyResult.fecha || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>USUARIO / RESPONSABLE</div>
                      <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>{verifyResult.usuario_nombre || 'Sistema'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>RED BLOCKCHAIN</div>
                      <div style={{ color: 'var(--text-accent)', fontWeight: 600, marginTop: 2 }}>{verifyResult.red || 'Red Local'}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>HASH COMPLETO SHA-256 (HUELAL DIGITAL)</div>
                      <div
                        className="hash-tag"
                        style={{ wordBreak: 'break-all', marginTop: 4, display: 'inline-block', padding: '6px 10px', fontSize: '0.78rem', cursor: 'pointer' }}
                        title="Haz clic para copiar"
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(verifyResult.hash_datos);
                            toast.success('Hash copiado');
                          }
                        }}
                      >
                        {verifyResult.hash_datos}
                      </div>
                    </div>
                    {verifyResult.tx_hash && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>TRANSACTION HASH (ETH TX)</div>
                        <div
                          className="hash-tag"
                          style={{ color: 'var(--success)', wordBreak: 'break-all', marginTop: 4, display: 'inline-block', padding: '6px 10px', fontSize: '0.78rem', cursor: 'pointer' }}
                          title="Haz clic para copiar"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(verifyResult.tx_hash);
                              toast.success('TX Hash copiado');
                            }
                          }}
                        >
                          {verifyResult.tx_hash}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabla principal */}
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Operación del Sistema</th>
                <th>Descripción</th>
                <th>Cuándo se Registra</th>
                <th>Ejemplo de Datos Almacenados</th>
                <th style={{ textAlign: 'center' }}>Impacto</th>
              </tr>
            </thead>
            <tbody>
              {OPERACIONES_SISTEMA.map(op => {
                const Icon = op.icon;
                return (
                  <tr key={op.id} style={{ transition: 'background 0.15s' }}>
                    {/* # */}
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {op.id}
                    </td>

                    {/* Operación con ícono */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: op.iconBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={16} color={op.iconColor} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {op.operacion}
                        </span>
                      </div>
                    </td>

                    {/* Descripción */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {op.descripcion}
                    </td>

                    {/* Cuándo */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {op.cuando}
                    </td>

                    {/* Datos almacenados */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: 280 }}>
                      {op.datos}
                    </td>

                    {/* Impacto */}
                    <td style={{ textAlign: 'center' }}>
                      <ImpactoBadge nivel={op.impacto} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── BANNER INFERIOR ─────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 24px',
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 8,
      }}>
        <div style={{
          width: 40, height: 40, flexShrink: 0,
          background: 'rgba(99,102,241,0.15)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={20} color="#6366f1" />
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Estas operaciones se registran en la blockchain para garantizar la <strong style={{ color: 'var(--text-primary)' }}>inmutabilidad, trazabilidad y no repudio</strong> de la información,
          asegurando la transparencia y confianza en la gestión de materiales y activos.
        </p>
      </div>

      {/* ─── SECCIÓN DE TRANSACCIONES EN VIVO ───────────── */}
      {lista.length > 0 && (
        <div className="card" style={{ padding: 0, marginTop: 24 }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--success)',
                  boxShadow: '0 0 6px rgba(16,185,129,0.6)',
                  display: 'inline-block',
                  animation: 'pulse-glow 2s infinite',
                }} />
              </div>
              <span className="card-title">Transacciones Registradas en Tiempo Real</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {lista.length} registros encontrados
            </span>
          </div>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Tipo de Evento</th>
                  <th>Hash SHA-256</th>
                  <th>Transaction Hash</th>
                  <th>Entidad</th>
                  <th>Usuario</th>
                  <th>Red</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, 20).map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                        {r.tipo_evento?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span
                        className="hash-tag"
                        title="Clic para copiar hash completo y verificar"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleQuickVerify(r.hash_datos)}
                      >
                        {r.hash_datos?.slice(0, 12)}...
                      </span>
                    </td>
                    <td>
                      {r.tx_hash ? (
                        <span
                          className="hash-tag"
                          style={{ color: 'var(--success)', cursor: 'pointer' }}
                          title="Clic para copiar transaction hash y verificar"
                          onClick={() => handleQuickVerify(r.tx_hash)}
                        >
                          {r.tx_hash.slice(0, 12)}...
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Hash-only</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {r.entidad_tipo} #{r.entidad_id}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {r.usuario_nombre || '—'}
                    </td>
                    <td>
                      <span className="badge badge-purple">{r.red_display || r.red}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(r.fecha).toLocaleString('es-BO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
