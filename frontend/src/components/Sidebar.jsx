import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Package, Building2, FileText,
  Link2, BarChart3, Users, LogOut, Box, Activity,
  ShieldCheck, ChevronDown
} from 'lucide-react';

const STAFF_ROLES = ['ADMIN', 'JEFE_ALMACEN'];

const navItems = [
  {
    section: 'PRINCIPAL',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    section: 'GESTIÓN',
    items: [
      { to: '/materiales', icon: Package,   label: 'Materiales' },
      { to: '/activos',    icon: Box,        label: 'Activos Fijos' },
      { to: '/solicitudes',icon: FileText,   label: 'Solicitudes' },
    ]
  },
  {
    section: 'SISTEMA',
    items: [
      { to: '/blockchain',    icon: Link2,      label: 'Blockchain',            roles: STAFF_ROLES },
      { to: '/integridad',    icon: ShieldCheck,label: 'Verificar Integridad',   roles: STAFF_ROLES },
      { to: '/transacciones', icon: Activity,   label: 'Registrar Transacciones',roles: STAFF_ROLES },
      { to: '/reportes',      icon: BarChart3,  label: 'Reportes',              roles: STAFF_ROLES },
      { to: '/usuarios',      icon: Users,      label: 'Usuarios',              roles: ['ADMIN'] },
    ]
  }
];

const rolLabels = {
  ADMIN: 'Administrador',
  JEFE_ALMACEN: 'Jefe de Almacén',
  SOLICITANTE: 'Solicitante',
  AUDITOR: 'Auditor',
};

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Sesión cerrada');
    navigate('/login');
  };

  const initials = user
    ? `${user.nombre?.charAt(0)}${user.apellido?.charAt(0)}`.toUpperCase()
    : '?';

  return (
    <aside className="sb-root">
      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-icon">
          <Building2 size={18} color="white" />
        </div>
        <div>
          <div className="sb-logo-name">Sistema WEB</div>
          <div className="sb-logo-sub">Alcaldía de Shinahota</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {user?.rol === 'AUDITOR' ? (
          <div>
            <div className="sb-section-label">AUDITORÍA</div>
            <NavLink
              to="/reportes"
              className={({ isActive }) => `sb-link${isActive ? ' sb-link--active' : ''}`}
            >
              <BarChart3 size={17} className="sb-link-icon" />
              <span>Reportes de Solicitudes</span>
            </NavLink>
          </div>
        ) : (
          navItems.map(section => {
            const visibleItems = section.items.filter(item => !item.roles || hasRole(...item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section}>
                <div className="sb-section-label">{section.section}</div>
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `sb-link${isActive ? ' sb-link--active' : ''}`}
                    >
                      <Icon size={17} className="sb-link-icon" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })
        )}
      </nav>

      {/* User footer */}
      <div className="sb-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
        <div className="sb-avatar">{initials}</div>
        <div className="sb-user-info">
          <div className="sb-user-name">{user?.nombre} {user?.apellido}</div>
          <div className="sb-user-role">
            <span className="sb-online-dot" />
            {rolLabels[user?.rol] || user?.rol}
          </div>
        </div>
        <ChevronDown size={14} className={`sb-chevron${userMenuOpen ? ' sb-chevron--open' : ''}`} />
        {userMenuOpen && (
          <div className="sb-user-menu">
            <button className="sb-user-menu-item" onClick={handleLogout}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
