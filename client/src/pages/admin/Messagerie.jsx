import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Badge, Button, Modal } from '../../components/ui';
import { Mail, Plus, Send, Inbox, ArrowRight, Archive, MailOpen, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const personName = (obj) => (obj ? `${obj.prenom || ''} ${obj.nom || ''}`.trim() : '—');

const Messagerie = () => {
  const { get, post, put } = useAxios();
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewMsg, setViewMsg] = useState(null); // message detail modal
  const [archiveConfirm, setArchiveConfirm] = useState(null); // confirm archive modal
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [form, setForm] = useState({ destinataireStaffId: '', destinataireUserId: '', sujet: '', contenu: '' });

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint =
        tab === 'inbox' ? '/api/messages/inbox'
        : tab === 'sent' ? '/api/messages/sent'
        : '/api/messages/archives';
      const res = await get(endpoint);
      setMessages(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [tab, get]);

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
    if (!form.sujet || !form.contenu || (!form.destinataireStaffId && !form.destinataireUserId)) {
      toast.error('Sujet, contenu et destinataire requis');
      return;
    }
    try {
      await post('/api/messages', {
        destinataireStaffId: form.destinataireStaffId || null,
        destinataireUserId: form.destinataireUserId || null,
        sujet: form.sujet,
        contenu: form.contenu,
      });
      toast.success('Message envoyé');
      setComposeOpen(false);
      if (tab === 'sent') fetchMessages();
    } catch { /* silent */ }
  };

  const handleMarkRead = async (msg) => {
    if (msg.lu || tab !== 'inbox') return;
    try {
      await put(`/api/messages/${msg.id}/read`);
      fetchMessages();
    } catch { /* silent */ }
  };

  const openMessage = async (msg) => {
    // mark as read in inbox
    if (!msg.lu && tab === 'inbox') {
      try { await put(`/api/messages/${msg.id}/read`); } catch { /* silent */ }
    }
    // fetch full message details
    try {
      const full = await get(`/api/messages/${msg.id}`, { silent: true });
      setViewMsg(full);
      fetchMessages(); // refresh read state in list
    } catch {
      setViewMsg(msg); // fallback to what we already have
    }
  };

  const handleArchive = async (msg) => {
    try {
      await put(`/api/messages/${msg.id}/archive`);
      toast.success('Message archivé');
      setArchiveConfirm(null);
      setViewMsg(null);
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

  const TABS = [
    { id: 'inbox', label: 'Réception', icon: Inbox },
    ...(user?.role !== 'parent' ? [{ id: 'sent', label: 'Envoyés', icon: ArrowRight }] : []),
    { id: 'archives', label: 'Archives', icon: Archive },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie"
        subtitle="Communication interne staff ↔ parents"
        actions={user?.role !== 'parent' ? <Button icon={Plus} onClick={openCompose}>Nouveau message</Button> : null}
      />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === id ? 'var(--color-primary)' : 'var(--surface-hover)',
              color: tab === id ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {tab === 'archives' ? 'Aucun message archivé' : 'Aucun message'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const unread = !msg.lu && tab === 'inbox';
            const sender = msg.expediteur || msg.expediteurUser;
            const recipient = msg.destinataireStaff || msg.destinataireUser;

            return (
              <div
                key={msg.id}
                className="flex items-start gap-4 p-4 rounded-xl cursor-pointer hover:bg-[var(--surface-hover)] transition-colors group"
                style={{
                  background: 'var(--surface-card)',
                  border: `1px solid ${unread ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                }}
                onClick={() => openMessage(msg)}
              >
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: unread ? 'var(--color-primary)20' : 'var(--surface-hover)' }}
                >
                  {unread ? (
                    <Mail className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  ) : (
                    <MailOpen className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {unread && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />
                    )}
                    <span
                      className="font-semibold text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {msg.sujet}
                    </span>
                    {tab === 'archives' && (
                      <Badge variant="neutral" size="sm">Archivé</Badge>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {tab === 'inbox'
                      ? `De : ${personName(sender)}`
                      : tab === 'sent'
                      ? `À : ${personName(recipient)}`
                      : `${personName(sender)} → ${personName(recipient)}`}
                    {' · '}
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    {formatDate(msg.createdAt)}
                  </p>
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {msg.contenu}
                  </p>
                </div>

                {/* Archive action */}
                {tab !== 'archives' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setArchiveConfirm(msg); }}
                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface-overlay)] flex-shrink-0"
                    title="Archiver"
                  >
                    <Archive className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ---- Modal: Read full message ---- */}
      <Modal
        open={!!viewMsg}
        onClose={() => setViewMsg(null)}
        title={viewMsg?.sujet || 'Message'}
        size="lg"
        footer={
          <>
            {tab !== 'archives' && (
              <Button
                variant="secondary"
                icon={Archive}
                onClick={() => { setArchiveConfirm(viewMsg); setViewMsg(null); }}
              >
                Archiver
              </Button>
            )}
            <Button variant="secondary" onClick={() => setViewMsg(null)}>Fermer</Button>
          </>
        }
      >
        {viewMsg && (
          <div className="space-y-5">
            {/* Meta */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl text-sm"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
            >
              <div>
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>De</span>
                <p className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {personName(viewMsg.expediteur || viewMsg.expediteurUser)}
                  {viewMsg.expediteur?.role && (
                    <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      ({viewMsg.expediteur.role})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>À</span>
                <p className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {personName(viewMsg.destinataireStaff || viewMsg.destinataireUser)}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Envoyé le</span>
                <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{formatDate(viewMsg.createdAt)}</p>
              </div>
              {viewMsg.dateLecture && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Lu le</span>
                  <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{formatDate(viewMsg.dateLecture)}</p>
                </div>
              )}
            </div>

            {/* Body */}
            <div
              className="p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                minHeight: 120,
              }}
            >
              {viewMsg.contenu}
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Modal: Confirm archive ---- */}
      <Modal
        open={!!archiveConfirm}
        onClose={() => setArchiveConfirm(null)}
        title="Archiver ce message ?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveConfirm(null)}>Annuler</Button>
            <Button icon={Archive} onClick={() => handleArchive(archiveConfirm)}>
              Archiver
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Le message <strong style={{ color: 'var(--text-primary)' }}>«{archiveConfirm?.sujet}»</strong> sera archivé et ne sera
            plus visible dans votre boîte de réception.
          </p>
          <p className="text-xs p-3 rounded-lg" style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)' }}>
            ℹ️ L'archivage est définitif — le message reste consultable dans l'onglet <strong>Archives</strong>
            {' '}et n'est pas supprimé du système.
          </p>
        </div>
      </Modal>

      {/* ---- Modal: Compose ---- */}
      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Nouveau message"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setComposeOpen(false)}>Annuler</Button>
            <Button
              icon={Send}
              onClick={handleSend}
              disabled={!form.sujet || !form.contenu || (!form.destinataireStaffId && !form.destinataireUserId)}
            >
              Envoyer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Destinataire *
            </label>
            <select
              style={inputStyle}
              value={form.destinataireStaffId ? `staff_${form.destinataireStaffId}` : form.destinataireUserId ? `parent_${form.destinataireUserId}` : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('staff_')) {
                  setForm({ ...form, destinataireStaffId: val.replace('staff_', ''), destinataireUserId: '' });
                } else if (val.startsWith('parent_')) {
                  setForm({ ...form, destinataireUserId: val.replace('parent_', ''), destinataireStaffId: '' });
                } else {
                  setForm({ ...form, destinataireStaffId: '', destinataireUserId: '' });
                }
              }}
            >
              <option value="">Sélectionner un destinataire</option>
              <optgroup label="Personnel (Staff)">
                {staff.filter((s) => s.id !== user?.id).map((s) => (
                  <option key={`staff_${s.id}`} value={`staff_${s.id}`}>{s.prenom} {s.nom} ({s.role})</option>
                ))}
              </optgroup>
              {user?.role !== 'parent' && parents.length > 0 && (
                <optgroup label="Parents">
                  {parents.map((p) => (
                    <option key={`parent_${p.id}`} value={`parent_${p.id}`}>{p.prenom} {p.nom}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Objet *</label>
            <input style={inputStyle} value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} placeholder="Objet du message" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contenu *</label>
            <textarea
              rows={6}
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }}
              placeholder="Rédigez votre message..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Messagerie;
