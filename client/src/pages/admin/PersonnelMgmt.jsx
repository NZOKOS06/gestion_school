import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAxios } from '../../hooks/useAxios';
import {
  PageHeader,
  KpiCard,
  SearchInput,
  Button,
  DataTable,
  Modal,
  Badge,
} from '../../components/ui';
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Pencil,
  RotateCcw,
  Power,
  Copy,
} from 'lucide-react';

const roleConfig = {
  directeur: {
    color: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
    label: 'Directeur',
  },
  directeur_etudes: {
    color: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    label: 'Directeur des études',
  },
  admin: { color: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)]0', badge: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-[#3B82F6]', label: 'Admin' },
  enseignant: { color: 'bg-[color-mix(in_srgb,#10B981_12%,transparent)]0', badge: 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-[#10B981]', label: 'Enseignant' },
  secretaire: {
    color: 'bg-cyan-500',
    badge: 'bg-cyan-100 text-cyan-700',
    label: 'Secrétaire',
  },
  comptable: {
    color: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)]0',
    badge: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-[#F59E0B]',
    label: 'Gestionnaire',
  },
  surveillant: { color: 'bg-[var(--surface-hover)]0', badge: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]', label: 'Surveillant' },
};

const ROLES = Object.keys(roleConfig);

const getInitials = (prenom, nom) =>
  `${(prenom?.[0] || '').toUpperCase()}${(nom?.[0] || '').toUpperCase()}`;

const PersonnelMgmt = () => {
  const { get, post, put, delete: del } = useAxios();
  const [allStaff, setAllStaff] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    role: '',
    telephone: '',
    typeContrat: 'titulaire',
    heuresHebdo: '',
    tauxHoraire: '',
  });

  const [resultModal, setResultModal] = useState({
    open: false,
    password: '',
    title: '',
  });

  const fetchStaff = async () => {
    setTableLoading(true);
    try {
      const res = await get('/api/personnel?limit=200');
      setAllStaff(res.staff || []);
    } catch {
      // toast géré par useAxios
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filteredStaff = useMemo(() => {
    let data = [...allStaff];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.nom?.toLowerCase().includes(q) ||
          s.prenom?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter) data = data.filter((s) => s.role === roleFilter);
    if (statusFilter === 'actif') data = data.filter((s) => s.actif);
    if (statusFilter === 'inactif') data = data.filter((s) => !s.actif);
    return data;
  }, [allStaff, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const actifs = allStaff.filter((s) => s.actif).length;
    const inactifs = allStaff.filter((s) => !s.actif).length;
    const nonInit = allStaff.filter((s) => s.mustChangePassword).length;
    return { total: allStaff.length, actifs, inactifs, nonInit };
  }, [allStaff]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: '', prenom: '', email: '', role: '', telephone: '', typeContrat: 'titulaire', heuresHebdo: '', tauxHoraire: '' });
    setModalOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      nom: member.nom || '',
      prenom: member.prenom || '',
      email: member.email || '',
      role: member.role || '',
      telephone: member.telephone || '',
      typeContrat: member.typeContrat || 'titulaire',
      heuresHebdo: member.heuresHebdo || '',
      tauxHoraire: member.tauxHoraire || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await put(`/api/personnel/${editing.id}`, { ...form, actif: editing.actif });
        toast.success('Membre mis à jour');
        setModalOpen(false);
        fetchStaff();
      } else {
        const res = await post('/api/personnel', form);
        toast.success('Compte créé');
        setModalOpen(false);
        setResultModal({
          open: true,
          password: res.motDePasseProvisoire,
          title: 'Compte créé',
        });
        fetchStaff();
      }
    } catch {
      // toast géré par useAxios
    }
  };

  const handleResetPassword = async (member) => {
    try {
      const res = await put(`/api/staff/${member.id}/reset-password`, {});
      toast.success('Mot de passe réinitialisé');
      setResultModal({
        open: true,
        password: res.motDePasseProvisoire,
        title: 'Mot de passe réinitialisé',
      });
    } catch {
      // toast géré par useAxios
    }
  };

  const handleToggleActive = async (member) => {
    try {
      if (member.actif) {
        await del(`/api/personnel/${member.id}`);
        toast.success('Compte désactivé');
      } else {
        await put(`/api/personnel/${member.id}`, {
          nom: member.nom,
          prenom: member.prenom,
          email: member.email,
          role: member.role,
          actif: true,
        });
        toast.success('Compte activé');
      }
      fetchStaff();
    } catch {
      // toast géré par useAxios
    }
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  const columns = [
    {
      key: 'avatar',
      label: '',
      render: (_, row) => {
        const cfg = roleConfig[row.role] || roleConfig.enseignant;
        return (
          <div
            className={`h-10 w-10 rounded-full ${cfg.color} flex items-center justify-center text-white text-sm font-bold`}
          >
            {getInitials(row.prenom, row.nom)}
          </div>
        );
      },
    },
    {
      key: 'nom',
      label: 'Nom',
      render: (_, row) => `${row.prenom} ${row.nom}`,
    },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Rôle',
      render: (val) => {
        const cfg = roleConfig[val] || roleConfig.enseignant;
        return (
          <span
            className={`inline-flex items-center rounded-full text-xs font-medium px-2.5 py-0.5 ${cfg.badge}`}
          >
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'typeContrat',
      label: 'Contrat',
      render: (val) => {
        const labels = { titulaire: 'Titulaire', vacataire: 'Vacataire', stagiaire: 'Stagiaire', contractuel: 'Contractuel' };
        const variants = { titulaire: 'success', vacataire: 'warning', stagiaire: 'neutral', contractuel: 'neutral' };
        return <Badge variant={variants[val] || 'neutral'}>{labels[val] || val || '—'}</Badge>;
      },
    },
    {
      key: 'actif',
      label: 'Statut',
      render: (val) => (
        <Badge variant={val ? 'success' : 'neutral'}>
          {val ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'derniereConnexion',
      label: 'Dernière connexion',
      render: (val) =>
        val
          ? new Date(val).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Jamais',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1 flex-wrap">
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(row)}>
            Modifier
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            onClick={() => handleResetPassword(row)}
          >
            MDP
          </Button>
          <Button
            size="sm"
            variant={row.actif ? 'danger' : 'secondary'}
            icon={Power}
            onClick={() => handleToggleActive(row)}
          >
            {row.actif ? 'Désactiver' : 'Activer'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion du personnel"
        subtitle="Création, modification et gestion des comptes staff"
        icon={Users}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Ajouter un membre
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Total staff" value={stats.total} icon={Users} color="primary" />
        <KpiCard label="Actifs" value={stats.actifs} icon={UserCheck} color="green" />
        <KpiCard label="Inactifs" value={stats.inactifs} icon={UserX} color="red" />
        <KpiCard
          label="Non initialisés"
          value={stats.nonInit}
          icon={AlertTriangle}
          color="orange"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleConfig[r].label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Inactifs</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filteredStaff}
        loading={tableLoading}
        emptyMessage="Aucun membre du personnel trouvé"
      />

      {/* Modal création / édition */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier un membre' : 'Ajouter un membre'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" form="personnel-form">
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <form id="personnel-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Nom *
              </label>
              <input
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Prénom *
              </label>
              <input
                required
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Email *
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Rôle *
            </label>
            <select
              required
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">Sélectionner un rôle</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleConfig[r].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Téléphone
            </label>
            <input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Type de contrat
            </label>
            <select
              value={form.typeContrat}
              onChange={(e) => setForm({ ...form, typeContrat: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="titulaire">Titulaire</option>
              <option value="vacataire">Vacataire</option>
              <option value="stagiaire">Stagiaire</option>
              <option value="contractuel">Contractuel</option>
            </select>
          </div>
          {form.typeContrat === 'vacataire' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Heures / semaine
                </label>
                <input
                  type="number"
                  value={form.heuresHebdo}
                  onChange={(e) => setForm({ ...form, heuresHebdo: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Taux horaire (FCFA)
                </label>
                <input
                  type="number"
                  value={form.tauxHoraire}
                  onChange={(e) => setForm({ ...form, tauxHoraire: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal résultat mot de passe */}
      <Modal
        open={resultModal.open}
        onClose={() => setResultModal({ open: false, password: '', title: '' })}
        title={resultModal.title || 'Résultat'}
        size="sm"
        footer={
          <Button
            onClick={() =>
              setResultModal({ open: false, password: '', title: '' })
            }
          >
            Fermer
          </Button>
        }
      >
        <div className="space-y-4 text-center">
          <p className="text-[var(--text-secondary)]">Mot de passe provisoire :</p>
          <div className="flex items-center justify-center gap-3">
            <code className="bg-[var(--surface-hover)] px-4 py-2 rounded-lg text-lg font-mono font-bold text-[var(--text-primary)]">
              {resultModal.password}
            </code>
            <Button
              size="sm"
              variant="secondary"
              icon={Copy}
              onClick={() => handleCopy(resultModal.password)}
            >
              Copier
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PersonnelMgmt;


