const USERS = [
  { id: 'martin', label: 'Martin', initial: 'M', color: '#6ea8fe' },
  { id: 'joanne', label: 'Joanne', initial: 'J', color: '#b794f4' },
  { id: 'joint',  label: 'Joint',  initial: '⚭', color: '#c9a84c' },
];

export default function UserTabs({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {USERS.map(u => {
        const isActive = active === u.id;
        return (
          <button
            key={u.id}
            onClick={() => onChange(u.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              border: `1px solid ${isActive ? u.color : 'var(--border)'}`,
              background: isActive ? `${u.color}18` : 'var(--bg-card)',
              color: isActive ? u.color : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: isActive ? u.color : 'var(--bg-hover)',
              color: isActive ? '#000' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {u.initial}
            </span>
            {u.label}
          </button>
        );
      })}
    </div>
  );
}
