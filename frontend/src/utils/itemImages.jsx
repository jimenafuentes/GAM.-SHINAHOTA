import React from 'react';

/**
 * Muestra la imagen real del ítem si existe,
 * o un placeholder neutro con iniciales (igual al avatar de usuario sin foto).
 */
export function getItemImage(name = '', customImageUrl = null, size = 48) {
  if (customImageUrl) {
    let src = customImageUrl;
    if (typeof src === 'string' && src.startsWith('/media/')) {
      const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');
      src = `${backendBase}${src}`;
    }

    return (
      <img
        src={src}
        alt={name}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: 8,
          flexShrink: 0,
        }}
      />
    );
  }

  // Placeholder: iniciales sobre fondo gris, igual que el avatar de usuario sin foto
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  const fontSize = Math.max(size * 0.36, 11);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: 'var(--bg-tertiary, #1e293b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--text-muted, #64748b)',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.03em',
        userSelect: 'none',
        border: '1px solid var(--border-color, rgba(255,255,255,0.07))',
      }}
    >
      {initials}
    </div>
  );
}
