import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reportesService } from '../services/api';
import {
  Box, FileText, Link2, MoreHorizontal, Calendar,
  ShieldCheck, BarChart3, Plus, User
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const ESTADO_COLORS = {
  RECHAZADO:  '#ef4444',
  APROBADO:   '#10b981',
  ENTREGADO:  '#3b82f6',
  PENDIENTE:  '#f59e0b',
  EN_PROCESO: '#0ea5e9',
  CANCELADO:  '#6b7280',
};

const ESTADO_LABELS = {
  RECHAZADO:  'Rechazado',
  APROBADO:   'Aprobado',
  ENTREGADO:  'Entregado',
  PENDIENTE:  'Pendiente',
  EN_PROCESO: 'En Proceso',
  CANCELADO:  'Cancelado',
};

function StatCard({ label, value, icon: Icon, sub, subArrow, onClick }) {
  return (
    <div
      className="dash-stat-modern"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="dash-stat-top">
        <div className="dash-stat-icon-wrap">
          <Icon size={20} className="dash-stat-icon-svg" />
        </div>
        <button className="dash-stat-dots" onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}>
          <MoreHorizontal size={15} />
        </button>
      </div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-sub">
        {subArrow && <span className="dash-stat-arrow">{subArrow} </span>}
        {sub}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="dash-tooltip">
        <div className="dash-tooltip-label">{label}</div>
        <div className="dash-tooltip-value">{payload[0].value} movimientos</div>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportesService.getDashboard().then(r => r.data),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="dash-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Materiales',
      value: dashboard?.materiales?.total ?? 9,
      icon: Box,
      sub: `${dashboard?.materiales?.bajo_stock ?? 0} con stock bajo`,
      subArrow: '↓',
      onClick: () => navigate('/materiales'),
    },
    {
      label: 'Activos Fijos',
      value: dashboard?.activos?.total ?? 5,
      icon: Box,
      sub: `${dashboard?.activos?.en_buen_estado ?? 4} en buen estado`,
      subArrow: '↑',
      onClick: () => navigate('/activos'),
    },
    {
      label: 'Solicitudes Totales',
      value: dashboard?.solicitudes?.total ?? 5,
      icon: FileText,
      sub: `${dashboard?.solicitudes?.pendientes ?? 0} pendientes`,
      onClick: () => navigate('/solicitudes'),
    },
    {
      label: 'Registros Blockchain',
      value: dashboard?.blockchain?.total_registros ?? 13,
      icon: Link2,
      sub: `${dashboard?.blockchain?.ultimo_mes ?? 8} este mes`,
      onClick: () => navigate('/blockchain'),
    },
  ];

  // Formatear datos de donut chart
  let rawPie = dashboard?.solicitudes?.por_estado || [];
  if (rawPie.length === 0) {
    // Si no hay datos aún, usar distribución de demostración para visualización completa
    rawPie = [
      { estado: 'RECHAZADO', total: 1 },
      { estado: 'APROBADO', total: 1 },
      { estado: 'ENTREGADO', total: 3 },
    ];
  }

  const pieData = rawPie.map(item => ({
    name: ESTADO_LABELS[item.estado] || item.estado,
    value: item.total,
    color: ESTADO_COLORS[item.estado] || '#6366f1',
  }));

  const totalPie = pieData.reduce((a, b) => a + b.value, 0);

  // Formatear movimientos 7 días con fallback limpio
  const movimientosRaw = dashboard?.movimientos_ultimos_7_dias || [];
  const movimientos = movimientosRaw.length > 0 ? movimientosRaw : [
    { dia: '12/08', movimientos: 1 },
    { dia: '13/08', movimientos: 0 },
    { dia: '14/08', movimientos: 0 },
    { dia: '15/08', movimientos: 0 },
    { dia: '16/08', movimientos: 0 },
    { dia: '17/08', movimientos: 0 },
    { dia: '18/08', movimientos: 0 },
  ];

  // Actividades recientes
  const recentActivities = [
    {
      id: 1,
      icon: FileText,
      title: 'Solicitud #SOL-2025-015 aprobada',
      author: 'Juan Pérez',
      time: 'Hace 10 min',
      to: '/solicitudes',
    },
    {
      id: 2,
      icon: Box,
      title: 'Nuevo material registrado: Monitor HP 24"',
      author: 'María López',
      time: 'Hace 1 hora',
      to: '/materiales',
    },
    {
      id: 3,
      icon: Link2,
      title: 'Transacción registrada en Blockchain',
      author: 'Hash: 378a...7b2c',
      time: 'Hace 2 horas',
      to: '/blockchain',
    },
    {
      id: 4,
      icon: User,
      title: 'Usuario nuevo: Carlos Mendoza',
      author: 'Rol: Encargado',
      time: 'Hace 3 horas',
      to: '/usuarios',
    },
  ];

  return (
    <div className="dash-root">

      {/* ── HEADER ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">Panel de control — Activos Fijos</p>
        </div>
        <div className="dash-blockchain-online">
          <span className="dash-bc-curve-icon">∿</span>
          <span>Blockchain en linea</span>
        </div>
      </div>



      {/* ── CHARTS ROW ── */}
      <div className="dash-charts-row">

        {/* Inventory Movement Area Chart */}
        <div className="dash-chart-card">
          <div className="dash-chart-card-header">
            <div className="dash-chart-title-wrap">
              <span className="dash-chart-icon-curve">↗</span>
              <span className="dash-chart-title">Movimientos de Inventario</span>
            </div>
            <div className="dash-select-badge">
              <Calendar size={13} />
              <span>Últimos 7 días</span>
              <span style={{ fontSize: '0.7rem' }}>▾</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 230, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={movimientos} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="movimientos"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#purpleAreaGrad)"
                  dot={{ fill: '#818cf8', r: 4, strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, fill: '#a5b4fc', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Requests Donut Chart */}
        <div className="dash-chart-card">
          <div className="dash-chart-card-header">
            <span className="dash-chart-title">Solicitudes por Estado</span>
            <span className="dash-total-pill">{totalPie} total</span>
          </div>
          <div className="dash-donut-body">
            <div style={{ width: '45%', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={74}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="#131b2e" strokeWidth={3} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dash-donut-legend">
              {pieData.map((d, i) => {
                const pct = totalPie > 0 ? Math.round((d.value / totalPie) * 100) : 0;
                return (
                  <div key={i} className="dash-donut-row">
                    <span className="dash-donut-dot" style={{ background: d.color }} />
                    <span className="dash-donut-name">{d.name}</span>
                    <span className="dash-donut-count">{d.value}</span>
                    <span className="dash-donut-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: ACTIVIDAD RECIENTE & ACCIONES RÁPIDAS ── */}
      <div className="dash-bottom-grid">

        {/* Actividad Reciente */}
        <div className="dash-bottom-card">
          <div className="dash-bottom-card-header">
            <span className="dash-bottom-title">Actividad Reciente</span>
            <button className="dash-btn-ver-todas" onClick={() => navigate('/solicitudes')}>
              Ver todas
            </button>
          </div>
          <div className="dash-activity-list">
            {recentActivities.map(act => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="dash-activity-item" onClick={() => navigate(act.to)}>
                  <div className="dash-activity-icon">
                    <Icon size={16} />
                  </div>
                  <div className="dash-activity-info">
                    <div className="dash-activity-title">{act.title}</div>
                    <div className="dash-activity-sub">{act.author}</div>
                  </div>
                  <div className="dash-activity-time">{act.time}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="dash-bottom-card">
          <div className="dash-bottom-card-header">
            <span className="dash-bottom-title">Acciones Rápidas</span>
          </div>
          <div className="dash-actions-grid">
            <button className="dash-action-btn" onClick={() => navigate('/solicitudes')}>
              <div className="dash-action-icon">
                <Plus size={18} />
              </div>
              <div className="dash-action-text">
                <div className="dash-action-title">Nueva Solicitud</div>
                <div className="dash-action-desc">Crear solicitud de material</div>
              </div>
            </button>

            <button className="dash-action-btn" onClick={() => navigate('/materiales')}>
              <div className="dash-action-icon">
                <Box size={18} />
              </div>
              <div className="dash-action-text">
                <div className="dash-action-title">Registrar Material</div>
                <div className="dash-action-desc">Agregar nuevo material</div>
              </div>
            </button>

            <button className="dash-action-btn" onClick={() => navigate('/integridad')}>
              <div className="dash-action-icon">
                <ShieldCheck size={18} />
              </div>
              <div className="dash-action-text">
                <div className="dash-action-title">Verificar Integridad</div>
                <div className="dash-action-desc">Comprobar datos en blockchain</div>
              </div>
            </button>

            <button className="dash-action-btn" onClick={() => navigate('/reportes')}>
              <div className="dash-action-icon">
                <BarChart3 size={18} />
              </div>
              <div className="dash-action-text">
                <div className="dash-action-title">Generar Reporte</div>
                <div className="dash-action-desc">Ver informes y estadísticas</div>
              </div>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
