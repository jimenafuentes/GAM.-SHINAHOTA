import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { solicitudesService } from '../services/api';
import {
  Bell, ChevronDown, User, FileText, ArrowRight,
  CheckCircle2, LogOut, Mail, Shield, Camera,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  const rolLabels = {
    ADMIN: 'Administrador',
    JEFE_ALMACEN: 'Jefe de Almacén',
    SOLICITANTE: 'Solicitante',
    AUDITOR: 'Auditor',
  };
  const rolShort = {
    ADMIN: 'Admin',
    JEFE_ALMACEN: 'Jefe Almacén',
    SOLICITANTE: 'Solicitante',
    AUDITOR: 'Auditor',
  };
  const rolColors = {
    ADMIN: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', dot: '#ef4444' },
    JEFE_ALMACEN: { bg: 'rgba(16,185,129,0.15)', color: '#34d399', dot: '#10b981' },
    SOLICITANTE: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#f59e0b' },
    AUDITOR: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', dot: '#8b5cf6' },
  };

  const { data: pendingData } = useQuery({
    queryKey: ['solicitudes-pendientes-notif'],
    queryFn: () => solicitudesService.getAll({ estado: 'PENDIENTE' }).then(r => r.data),
    refetchInterval: 15000,
  });

  const pendingList = pendingData?.results || pendingData || [];
  const pendingCount = Array.isArray(pendingList) ? pendingList.length : 0;

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(event.target)) setUserOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoToPending = () => { setNotifOpen(false); navigate('/solicitudes?estado=PENDIENTE'); };
  const handleLogout = async () => { setUserOpen(false); await logout(); navigate('/login'); };

  const rol = user?.rol;
  const rc = rolColors[rol] || rolColors.SOLICITANTE;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">

        {/* ── TOPBAR ── */}
        <header className="tb-root">
          {/* Left */}
          <div className="tb-left">
            <span className="tb-breadcrumb">Gestión de Control y Solicitudes de Material</span>
            {user?.rol !== 'SOLICITANTE' && (
              <div className="tb-blockchain">
                <span className="tb-blockchain-dot" />
                <span>Blockchain Activa</span>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="tb-right">

            {/* ── Bell & Notifications ── */}
            <div className="tb-notif-container" ref={notifRef}>
              <button className="tb-icon-btn" onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false); }} title="Notificaciones">
                <Bell size={18} />
                {pendingCount > 0 && (
                  <span className="tb-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="tb-notif-dropdown">
                  <div className="tb-notif-header">
                    <div className="tb-notif-title"><Bell size={16} /><span>Notificaciones</span></div>
                    {pendingCount > 0 && (
                      <span className="tb-notif-count-badge">{pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}</span>
                    )}
                  </div>
                  <div className="tb-notif-list">
                    {pendingCount > 0 ? (
                      pendingList.map(s => (
                        <div key={s.id} className="tb-notif-item" onClick={handleGoToPending}>
                          <div className="tb-notif-item-icon"><FileText size={18} /></div>
                          <div className="tb-notif-item-content">
                            <div className="tb-notif-item-top">
                              <span className="tb-notif-item-code">SOL-{s.numero}</span>
                              <span className={`badge ${s.prioridad === 'URGENTE' || s.prioridad === 'ALTA' ? 'badge-danger' : 'badge-warning'} tb-notif-item-prio`}>
                                {s.prioridad_display || s.prioridad}
                              </span>
                            </div>
                            <div className="tb-notif-item-desc">{s.motivo || 'Solicitud de material'}</div>
                            <div className="tb-notif-item-sub">
                              <span>Por: {s.solicitante_nombre || 'Solicitante'}</span>
                              <span>{s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString('es-BO') : ''}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="tb-notif-empty">
                        <CheckCircle2 size={32} style={{ color: 'var(--success)', opacity: 0.8 }} />
                        <span>No hay notificaciones pendientes</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Todas las solicitudes han sido atendidas</span>
                      </div>
                    )}
                  </div>
                  <div className="tb-notif-footer">
                    <button className="tb-notif-btn" onClick={handleGoToPending}>
                      <span>Ingresar a Solicitudes Pendientes</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── User Pill + Dropdown ── */}
            <div className="tb-user-container" ref={userRef}>
              <button
                className="tb-user-pill"
                onClick={() => { setUserOpen(!userOpen); setNotifOpen(false); }}
                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                <div className="tb-user-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                  {user?.foto_url ? (
                    <img src={user.foto_url} alt={user?.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <span className="tb-user-name">{rolShort[user?.rol] || user?.rol}</span>
                <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: userOpen ? 'rotate(180deg)' : 'none' }} />
              </button>

              {/* ── Dropdown tarjeta de perfil ── */}
              {userOpen && (
                <div className="tb-user-dropdown">

                  {/* Cabecera con foto grande */}
                  <div className="tb-ud-header">
                    {/* Avatar grande */}
                    <div className="tb-ud-avatar">
                      {user?.foto_url ? (
                        <img src={user.foto_url} alt={user?.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.4rem', fontWeight: 700, color: 'white',
                        }}>
                          {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
                        </div>
                      )}
                      {/* Indicador online */}
                      <span className="tb-ud-online" />
                    </div>

                    {/* Info nombre y badge de rol */}
                    <div className="tb-ud-info">
                      <div className="tb-ud-name">{user?.nombre} {user?.apellido}</div>
                      <div className="tb-ud-role-badge" style={{ background: rc.bg, color: rc.color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc.dot, display: 'inline-block', flexShrink: 0 }} />
                        {rolLabels[rol] || rol}
                      </div>
                    </div>
                  </div>

                  {/* Línea separadora */}
                  <div className="tb-ud-divider" />

                  {/* Datos de contacto */}
                  <div className="tb-ud-details">
                    <div className="tb-ud-detail-row">
                      <Mail size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="tb-ud-detail-text">{user?.email || '—'}</span>
                    </div>
                    <div className="tb-ud-detail-row">
                      <Shield size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="tb-ud-detail-text">{rolLabels[rol] || '—'}</span>
                    </div>
                    {!user?.foto_url && (
                      <div className="tb-ud-detail-row" style={{ marginTop: 2 }}>
                        <Camera size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin foto de perfil</span>
                      </div>
                    )}
                  </div>

                  {/* Línea separadora */}
                  <div className="tb-ud-divider" />

                  {/* Botón cerrar sesión */}
                  <div className="tb-ud-footer">
                    <button className="tb-ud-logout" onClick={handleLogout}>
                      <LogOut size={14} />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
