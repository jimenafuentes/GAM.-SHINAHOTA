import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService, usuariosService } from '../services/api';
import toast from 'react-hot-toast';
import {
  Building2, LogIn, Mail, Lock, Eye, EyeOff,
  User, Fingerprint, Phone, ArrowLeft, UserPlus,
  Shield, ShieldCheck, Users, Package
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    nombre: '', apellido: '', email: '', ci: '',
    telefono: '', departamento: '', rol: 'SOLICITANTE',
    password: '', password2: '',
  });

  const [departamentos, setDepartamentos] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);

  useEffect(() => {
    if (isRegister) {
      setLoadingDeps(true);
      usuariosService.getDepartamentos()
        .then(res => {
          const deps = res.data?.results || res.data || [];
          setDepartamentos(deps);
          if (deps.length > 0) setRegisterForm(prev => ({ ...prev, departamento: deps[0].id }));
        })
        .catch(() => toast.error('Error al cargar departamentos'))
        .finally(() => setLoadingDeps(false));
    }
  }, [isRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Ingrese email y contraseña'); return; }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Bienvenido, ${user.nombre}!`);
      navigate('/dashboard');
    } catch (err) {
      if (!err.response) {
        // Error de red: el backend no está disponible
        toast.error('No se puede conectar al servidor. Asegúrese de que el backend esté iniciado.');
      } else {
        const data = err.response?.data;
        const msg = data?.detail || data?.non_field_errors?.[0] || data?.email?.[0] || 'Email o contraseña incorrectos';
        toast.error(msg);
      }
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { nombre, apellido, email, ci, telefono, departamento, password, password2, rol } = registerForm;
    if (!nombre || !apellido || !email || !ci || !password || !password2 || !departamento) {
      toast.error('Complete todos los campos obligatorios'); return;
    }
    if (password !== password2) { toast.error('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { toast.error('Mínimo 6 caracteres'); return; }
    setLoading(true);
    try {
      await authService.register({ nombre, apellido, email, ci, telefono, departamento: parseInt(departamento), rol, password, password2 });
      toast.success('¡Cuenta creada! Ya puedes iniciar sesión.');
      setIsRegister(false);
      setForm({ email, password });
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Error al registrar usuario';
      if (data && typeof data === 'object') msg = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const fillDemo = (email, password) => setForm({ email, password });

  const demoAccounts = [
    { label: 'Administrador', email: 'admin@shinahota.bo', pass: '12345', icon: Shield, color: '#7c3aed', bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.4)' },
    { label: 'Solicitante',   email: 'solicitante@shinahota.bo', pass: '12345', icon: Users, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
    { label: 'Auditor',       email: 'auditor@shinahota.bo', pass: '12345', icon: ShieldCheck, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  ];

  return (
    <div className="lp-root">
      {/* Animated background blobs */}
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />
      <div className="lp-blob lp-blob-3" />
      {/* Diagonal light rays */}
      <div className="lp-ray lp-ray-1" />
      <div className="lp-ray lp-ray-2" />
      {/* Building - left side */}
      <img src="/shinahota_building.png" alt="Edificio Shinahota" className="lp-bg-building" />
      {/* Coat of arms - right side */}
      <img src="/shinahota_escudo.png" alt="Escudo Shinahota" className="lp-bg-escudo" />

      <div className={`lp-card ${isRegister ? 'lp-card--wide' : ''}`}>

        {/* Glow border effect */}
        <div className="lp-card-glow" />

        {/* Header */}
        <div className="lp-header">
          <div className="lp-icon">
            <Building2 size={28} color="white" />
          </div>
          <h1 className="lp-title">Sistema WEB</h1>
          <p className="lp-subtitle">Alcaldía de Shinahota — Activos Fijos</p>
          <div className="lp-divider-label">
            <span>{isRegister ? 'Crear Nueva Cuenta' : 'Iniciar Sesión'}</span>
          </div>
        </div>

        {/* Forms */}
        {!isRegister ? (
          <form onSubmit={handleSubmit} className="lp-form">
            {/* Email */}
            <div className="lp-field">
              <label className="lp-label">Correo Electrónico</label>
              <div className="lp-input-wrap">
                <Mail size={16} className="lp-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="lp-input"
                  placeholder="usuario@shinahota.bo"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-label">Contraseña</label>
              <div className="lp-input-wrap">
                <Lock size={16} className="lp-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="lp-input"
                  placeholder="Ingrese su contraseña"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" className="lp-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button id="btn-login" type="submit" className="lp-btn-primary" disabled={loading}>
              <LogIn size={18} />
              {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
            </button>

            {/* Register Button */}
            <button id="btn-go-register" type="button" className="lp-btn-outline" onClick={() => setIsRegister(true)}>
              <UserPlus size={18} />
              Crear Cuenta
            </button>


          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegister} className="lp-form">
            <div className="lp-grid-2">
              <div className="lp-field">
                <label className="lp-label">Nombre *</label>
                <div className="lp-input-wrap">
                  <User size={15} className="lp-input-icon" />
                  <input type="text" className="lp-input" placeholder="Juan"
                    value={registerForm.nombre} onChange={e => setRegisterForm({ ...registerForm, nombre: e.target.value })} />
                </div>
              </div>
              <div className="lp-field">
                <label className="lp-label">Apellido *</label>
                <div className="lp-input-wrap">
                  <User size={15} className="lp-input-icon" />
                  <input type="text" className="lp-input" placeholder="Perez"
                    value={registerForm.apellido} onChange={e => setRegisterForm({ ...registerForm, apellido: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label">Correo Electrónico *</label>
              <div className="lp-input-wrap">
                <Mail size={15} className="lp-input-icon" />
                <input type="email" className="lp-input" placeholder="juan.perez@shinahota.bo"
                  value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} />
              </div>
            </div>

            <div className="lp-grid-2">
              <div className="lp-field">
                <label className="lp-label">Cédula (CI) *</label>
                <div className="lp-input-wrap">
                  <Fingerprint size={15} className="lp-input-icon" />
                  <input type="text" className="lp-input" placeholder="1234567 LP"
                    value={registerForm.ci} onChange={e => setRegisterForm({ ...registerForm, ci: e.target.value })} />
                </div>
              </div>
              <div className="lp-field">
                <label className="lp-label">Teléfono</label>
                <div className="lp-input-wrap">
                  <Phone size={15} className="lp-input-icon" />
                  <input type="text" className="lp-input" placeholder="71234567"
                    value={registerForm.telefono} onChange={e => setRegisterForm({ ...registerForm, telefono: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="lp-grid-2">
              <div className="lp-field">
                <label className="lp-label">Departamento *</label>
                <select className="lp-input" value={registerForm.departamento} disabled={loadingDeps}
                  onChange={e => setRegisterForm({ ...registerForm, departamento: e.target.value })}>
                  {loadingDeps ? <option>Cargando...</option> : departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="lp-field">
                <label className="lp-label">Rol *</label>
                <select className="lp-input" value={registerForm.rol}
                  onChange={e => setRegisterForm({ ...registerForm, rol: e.target.value })}>
                  <option value="SOLICITANTE">Solicitante</option>
                  <option value="JEFE_ALMACEN">Jefe de Almacén</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>
            </div>

            <div className="lp-grid-2">
              <div className="lp-field">
                <label className="lp-label">Contraseña *</label>
                <div className="lp-input-wrap">
                  <Lock size={15} className="lp-input-icon" />
                  <input type="password" className="lp-input" placeholder="••••••••"
                    value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} />
                </div>
              </div>
              <div className="lp-field">
                <label className="lp-label">Confirmar *</label>
                <div className="lp-input-wrap">
                  <Lock size={15} className="lp-input-icon" />
                  <input type="password" className="lp-input" placeholder="••••••••"
                    value={registerForm.password2} onChange={e => setRegisterForm({ ...registerForm, password2: e.target.value })} />
                </div>
              </div>
            </div>

            <button type="submit" className="lp-btn-primary" disabled={loading}>
              <UserPlus size={18} />
              {loading ? 'Registrando...' : 'Registrar Cuenta'}
            </button>
            <button type="button" className="lp-btn-outline" onClick={() => setIsRegister(false)}>
              <ArrowLeft size={18} />
              Volver al Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
