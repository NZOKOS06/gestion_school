import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Badge, Button, Modal } from '../../components/ui';
import { Mail, Plus, Send, Inbox, ArrowRight, Trash2 } from 'lucide-react';

const Messagerie = () => {
  const { get, post, put, delete: del } = useAxios();
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [form, setForm] = useState({ destinataireStaffId: '', destinataireUserId: '', sujet: '', contenu: '' });

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'inbox' ? '/api/messages/inbox' : '/api/messages/sent';
      const res = await get(endpoint);
      setMessages(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const fetchRecipients = async () => {
    try {
      const res = await get('/api/messages/recipients', { silent: true });
      setStaff(res?.staff || []);
      setParents(res?.parents || []);
    } catch { /* silent */ }
  };

  const openCompose = () => {
    setForm({ destinataireStaffId: '', destinataireUserId: '', sujet: '', contenu: '' });
    fetchRecipients();
    setComposeOpen(true);
  };

  const handleSend = async () => {
    try {
      await post('/api/messages', {
        destinataireStaffId: form.destinataireStaffId || null,
        destinataireUserId: form.destinataireUserId || null,
        sujet: form.sujet,
        contenu: form.contenu,
      });
      setComposeOpen(false);
      if (tab === 'sent') fetchMessages();
    } catch { /* silent */ }
  };

  const handleMarkRead = async (msg) => {
    try {
      await put(`/api/messages/${msg.id}/read`);
      fetchMessages();
    } catch { /* silent */ }
  };

  const handleDelete = async (msg) => {
    try {
      await del(`/api/messages/${msg.id}`);
      fetchMessages();
    } catch { /* silent */ }
  };

  const inputStyle = {
    width: '100%',
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie"
        subtitle="Communication interne staff ↔ parents"
        actions={user?.role !== 'parent' ? <Button icon={Plus} onClick={openCompose}>Nouveau message</Button> : null}
      />

      <div className="flex gap-2">
        <button
          onClick={() => setTab('inbox')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: tab === 'inbox' ? 'var(--color-primary)' : 'var(--surface-hover)',
            color: tab === 'inbox' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Inbox className="h-4 w-4" />
          Boîte de réception
        </button>
        {user?.role !== 'parent' && (
          <button
            onClick={() => setTab('sent')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === 'sent' ? 'var(--color-primary)' : 'var(--surface-hover)',
              color: tab === 'sent' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <ArrowRight className="h-4 w-4" />
            Envoyés
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
            Aucun message
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-center gap-4 p-4 rounded-xl cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
              style={{
                background: 'var(--surface-card)',
                border: `1px solid ${msg.lu ? 'var(--border-subtle)' : 'var(--color-primary)'}`,
                opacity: msg.lu ? 0.8 : 1,
              }}
              onClick={() => !msg.lu && tab === 'inbox' && handleMarkRead(msg)}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-hover)' }}>
                <Mail className="h-5 w-5" style={{ color: msg.lu ? 'var(--text-muted)' : 'var(--color-primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!msg.lu && tab === 'inbox' && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />}
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{msg.sujet}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {tab === 'inbox'
                    ? `De: ${msg.expediteur?.prenom || msg.expediteurUser?.prenom || ''} ${msg.expediteur?.nom || msg.expediteurUser?.nom || ''}`
                    : `À: ${msg.destinataireStaff?.prenom || msg.destinataireUser?.prenom} ${msg.destinataireStaff?.nom || msg.destinataireUser?.nom}`}
                  {' · '}
                  {new Date(msg.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{msg.contenu}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(msg); }}
                className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] flex-shrink-0"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
              </button>
            </div>
          ))
        )}
      </div>

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Nouveau message"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setComposeOpen(false)}>Annuler</Button>
            <Button icon={Send} onClick={handleSend} disabled={!form.sujet || !form.contenu || (!form.destinataireStaffId && !form.destinataireUserId)}>
              Envoyer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Destinataire {user?.role === 'parent' ? '(personnel)' : '(staff)'}
            </label>
            <select style={inputStyle} value={form.destinataireStaffId} onChange={(e) => setForm({ ...form, destinataireStaffId: e.target.value, destinataireUserId: '' })}>
              <option value="">Sélectionner</option>
              {staff.filter((s) => s.id !== user?.id).map((s) => (
                <option key={s.id} value={s.id}>{s.prenom} {s.nom} ({s.role})</option>
              ))}
            </select>
          </div>
          {user?.role !== 'parent' && parents.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {user?.role === 'enseignant' ? 'Ou parent (mes classes)' : 'Ou parent'}
              </label>
              <select style={inputStyle} value={form.destinataireUserId} onChange={(e) => setForm({ ...form, destinataireUserId: e.target.value, destinataireStaffId: '' })}>
                <option value="">Sélectionner un parent</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Sujet *</label>
            <input style={inputStyle} value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} placeholder="Objet du message" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contenu *</label>
            <textarea
              rows={5}
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              style={{ ...inputStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
              placeholder="Votre message..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Messagerie;
