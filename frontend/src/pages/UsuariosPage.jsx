import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usuariosService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Users, X, Camera, Upload, Power, CheckCircle, XCircle } from 'lucide-react';

const ROL_LABELS = { ADMIN: 'Administrador', SOLICITANTE: 'Solicitante', AUDITOR: 'Auditor' };
const ROL_BADGE = { ADMIN: 'badge-danger', SOLICITANTE: 'badge-warning', AUDITOR: 'badge-purple' };

const emptyForm = { email: '', nombre: '', apellido: '', ci: '', telefono: '', cargo: '', rol: 'SOLICITANTE', departamento: '', is_active: true, password: '', password2: '', foto: null };

export default function UsuariosPage() {
  const { user: currentUser, hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['usuarios', search],
    queryFn: () => usuariosService.getAll({ search }).then(r => r.data),
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => usuariosService.getDepartamentos().then(r => r.data?.results || r.data),
  });

  const createMut = useMutation({
    mutationFn: (data) => editItem ? usuariosService.update(editItem.id, data) : usuariosService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Usuario guardado correctamente'); closeModal(); },
    onError: (e) => {
      const errs = e.response?.data;
      const msg = errs ? Object.values(errs).flat().join(', ') : 'Error al guardar usuario';
      toast.error(msg);
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }) => usuariosService.update(id, { is_active }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success(`Usuario ${variables.is_active ? 'activado' : 'desactivado'} correctamente`);
    },
    onError: (e) => {
      const err = e.response?.data;
      const msg = err?.detail || err?.error || 'Error al cambiar estado del usuario';
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => usuariosService.delete(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success(res?.data?.detail || 'Usuario eliminado correctamente');
    },
    onError: (e) => {
      const err = e.response?.data;
      const msg = err?.detail || err?.error || 'Error al eliminar usuario';
      toast.error(msg);
    },
  });

  const handleToggleActive = (u) => {
    if (currentUser && currentUser.id === u.id && u.is_active) {
      toast.error('No puedes desactivar tu propia cuenta en sesión activa');
      return;
    }
    toggleActiveMut.mutate({ id: u.id, is_active: !u.is_active });
  };

  const handleDelete = (u) => {
    if (currentUser && currentUser.id === u.id) {
      toast.error('No puedes eliminar tu propia cuenta de usuario en sesión');
      return;
    }
    if (confirm(`¿Está seguro de eliminar al usuario ${u.nombre_completo || u.email}?`)) {
      deleteMut.mutate(u.id);
    }
  };

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setFotoPreview(null); setShowModal(true); };
  const openEdit = (u) => {
    setEditItem(u);
    setForm({
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      ci: u.ci || '',
      telefono: u.telefono || '',
      cargo: u.cargo || '',
      rol: u.rol,
      departamento: u.departamento || '',
      is_active: u.is_active ?? true,
      password: '',
      password2: '',
      foto: null
    });
    setFotoPreview(u.foto_url || null);
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditItem(null); setForm(emptyForm); setFotoPreview(null); };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La foto no puede superar 5MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Solo se permiten imágenes JPG, PNG o WebP'); return; }
    setForm({ ...form, foto: file });
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (editItem) { delete data.password; delete data.password2; }
    if (!data.foto) { delete data.foto; }
    createMut.mutate(data);
  };

  const usuarios = data?.results || data || [];

  if (!hasRole('ADMIN')) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
      <Users size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
      <p>Acceso restringido a Administradores</p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Usuarios</h1>
          <p className="page-subtitle">{usuarios.length} usuarios registrados</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="search-box">
            <Search className="icon" />
            <input type="text" placeholder="Buscar por nombre, email, cargo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nuevo Usuario
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
                  <th>Usuario</th>
                  <th>Cargo</th>
                  <th>Email</th>
                  <th>C.I.</th>
                  <th>Rol</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {u.foto_url ? (
                          <img
                            src={u.foto_url}
                            alt={u.nombre_completo}
                            style={{
                              width: 36, height: 36, borderRadius: '50%',
                              objectFit: 'cover', flexShrink: 0,
                              border: '2px solid var(--primary)',
                            }}
                          />
                        ) : (
                          <div
                            title="Sin foto de perfil"
                            style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: 'rgba(255,255,255,0.04)',
                              border: '2px dashed rgba(255,255,255,0.18)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--text-muted)', flexShrink: 0
                            }}>
                            <Camera size={18} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.nombre_completo}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.telefono}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.875rem' }}>
                      {u.cargo ? (
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
                          {u.cargo}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{u.email}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{u.ci || '—'}</td>
                    <td><span className={`badge ${ROL_BADGE[u.rol] || 'badge-gray'}`}>{ROL_LABELS[u.rol] || u.rol}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{u.departamento_nombre || '—'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        title={u.is_active ? 'Haz clic para desactivar usuario' : 'Haz clic para activar usuario'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                      >
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active ? '#10b981' : '#ef4444' }} />
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={`btn btn-sm btn-icon ${u.is_active ? 'btn-secondary' : 'btn-success'}`}
                          onClick={() => handleToggleActive(u)}
                          title={u.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                          disabled={toggleActiveMut.isPending}
                        >
                          <Power size={14} color={u.is_active ? 'var(--text-muted)' : '#ffffff'} />
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(u)} title="Editar usuario">
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDelete(u)}
                          title={currentUser && currentUser.id === u.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No se encontraron usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button className="btn btn-secondary btn-icon btn-sm" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

                  {/* ── SECCIÓN FOTO ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: 120, height: 120, borderRadius: '50%',
                        background: fotoPreview
                          ? 'none'
                          : 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.2))',
                        border: '3px solid var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative', overflow: 'hidden',
                        transition: 'all 0.2s',
                        boxShadow: '0 0 0 4px rgba(139,92,246,0.15)',
                      }}
                      title="Cambiar foto"
                    >
                      {fotoPreview ? (
                        <img
                          src={fotoPreview}
                          alt="Vista previa"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Camera size={36} strokeWidth={1.5} style={{ opacity: 0.6 }} />
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.2s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0}
                      >
                        <Upload size={22} color="white" />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Camera size={14} /> Subir Foto
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      JPG, PNG o WebP<br />máx. 5MB
                    </span>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleFotoChange}
                    />
                  </div>

                  {/* ── CAMPOS DEL FORMULARIO ── */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {editItem && (
                      <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '8px 14px', marginBottom: 14,
                        fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8
                      }}>
                        <Users size={13} /> ID de Usuario: #{editItem.id}
                      </div>
                    )}

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Nombre *</label>
                        <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Apellido *</label>
                        <input className="form-input" value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">C.I.</label>
                        <input className="form-input" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Teléfono</label>
                        <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Cargo / Puesto</label>
                        <input className="form-input" placeholder="Ej: Encargado de Almacén, Técnico, etc." value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Departamento</label>
                        <select className="form-select" value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })}>
                          <option value="">Sin departamento</option>
                          {(departamentos || []).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Rol *</label>
                        <select className="form-select" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                          {Object.entries(ROL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estado de la Cuenta *</label>
                        <select
                          className="form-select"
                          value={form.is_active ? 'true' : 'false'}
                          onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}
                        >
                          <option value="true">Activo (Habilitado)</option>
                          <option value="false">Inactivo (Deshabilitado)</option>
                        </select>
                      </div>
                    </div>
                    {!editItem && (
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">Contraseña *</label>
                          <input type="password" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Confirmar Contraseña *</label>
                          <input type="password" className="form-input" value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} required />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
                  {createMut.isPending ? 'Guardando...' : editItem ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

