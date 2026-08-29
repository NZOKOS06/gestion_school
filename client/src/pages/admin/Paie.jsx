import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, DataTable, Badge, Button, Modal, Input, KpiCard, KpiGrid } from '../../components/ui';
import { Banknote, Calculator, CheckCircle, Wallet, Users, TrendingUp, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const STATUT_PERIODE = {
  ouverte: { label: 'Ouverte', variant: 'neutral' },
  calculee: { label: 'Calculée', variant: 'warning' },
  validee: { label: 'Validée', variant: 'success' },
  payee: { label: 'Payée', variant: 'success' },
};

const Paie = () => {
  const { get, post, put } = useAxios();
  const { formatPrice, config } = useTenant();
  const [periodes, setPeriodes] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [periodeActive, setPeriodeActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editBulletin, setEditBulletin] = useState(null);
  const [formMois, setFormMois] = useState({ mois: String(new Date().getMonth() + 1), anneeCivile: String(new Date().getFullYear()) });

  const methode = config?.methodePaie || 'mensuel';

  const fetchPeriodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/paie/periodes');
      setPeriodes(res?.data || []);
    } catch {
      toast.error('Erreur chargement périodes');
    }
    setLoading(false);
  }, [get]);

  const fetchBulletins = useCallback(async (periodeId) => {
    if (!periodeId) return;
    try {
      const res = await get(`/api/paie/periodes/${periodeId}/bulletins`);
      setBulletins(res?.data || []);
    } catch {
      toast.error('Erreur chargement bulletins');
    }
  }, [get]);

  useEffect(() => { fetchPeriodes(); }, [fetchPeriodes]);

  useEffect(() => {
    if (periodeActive) fetchBulletins(periodeActive.id);
  }, [periodeActive, fetchBulletins]);

  const ouvrirPeriode = async () => {
    setBusy(true);
    try {
      const p = await post('/api/paie/periodes', {
        mois: parseInt(formMois.mois, 10),
        anneeCivile: parseInt(formMois.anneeCivile, 10),
      });
      setPeriodeActive(p);
      await fetchPeriodes();
      toast.success('Période ouverte');
    } catch {
      toast.error('Impossible d\'ouvrir la période');
    }
    setBusy(false);
  };

  const calculer = async () => {
    if (!periodeActive) return;
    setBusy(true);
    try {
      await post(`/api/paie/periodes/${periodeActive.id}/calculer`);
      await fetchPeriodes();
      await fetchBulletins(periodeActive.id);
      toast.success('Bulletins calculés');
    } catch {
      toast.error('Calcul impossible');
    }
    setBusy(false);
  };

  const validerPeriode = async () => {
    if (!periodeActive) return;
    setBusy(true);
    try {
      await post(`/api/paie/periodes/${periodeActive.id}/valider`);
      await fetchPeriodes();
      await fetchBulletins(periodeActive.id);
      toast.success('Période validée — dépenses créées');
    } catch {
      toast.error('Validation impossible');
    }
    setBusy(false);
  };

  const marquerPayee = async () => {
    if (!periodeActive) return;
    setBusy(true);
    try {
      await post(`/api/paie/periodes/${periodeActive.id}/payer`);
      await fetchPeriodes();
      toast.success('Période marquée payée');
    } catch {
      toast.error('Action impossible');
    }
    setBusy(false);
  };

  const saveBulletin = async () => {
    if (!editBulletin) return;
    setBusy(true);
    try {
      await put(`/api/paie/bulletins/${editBulletin.id}`, {
        montantFixe: parseFloat(editBulletin.montantFixe) || 0,
        montantHoraire: parseFloat(editBulletin.montantHoraire) || 0,
        montantTotal: parseFloat(editBulletin.montantTotal) || 0,
      });
      setEditBulletin(null);
      await fetchBulletins(periodeActive.id);
      toast.success('Bulletin mis à jour');
    } catch {
      toast.error('Mise à jour impossible');
    }
    setBusy(false);
  };

  const kpis = useMemo(() => {
    const total = bulletins.length;
    const masseTotale = bulletins.reduce((s, b) => s + Number(b.montantTotal || 0), 0);
    const totalVerse = bulletins
      .filter((b) => b.statut === 'valide' || b.statut === 'paye')
      .reduce((s, b) => s + Number(b.montantTotal || 0), 0);
    const resteAPayer = masseTotale - totalVerse;
    return { total, masseTotale, totalVerse, resteAPayer };
  }, [bulletins]);

  const selectStyle = {
    height: 36,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 13,
    padding: '0 8px',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paie du personnel"
        subtitle={`Méthode école : ${methode} — calcul, validation et sortie caisse (Salaires)`}
        icon={Banknote}
      />

      {/* KPIs */}
      <KpiGrid cols={4}>
        <KpiCard
          title="Agents concernés"
          value={periodeActive ? kpis.total : '—'}
          icon={Users}
          color="blue"
          subtitle={periodeActive ? `${MOIS[periodeActive.mois]} ${periodeActive.anneeCivile}` : 'Ouvrez une période'}
        />
        <KpiCard
          title="Masse salariale"
          value={periodeActive ? formatPrice(kpis.masseTotale) : '—'}
          icon={TrendingUp}
          color="purple"
          subtitle="Total brut à décaisser"
        />
        <KpiCard
          title="Salaires versés"
          value={periodeActive ? formatPrice(kpis.totalVerse) : '—'}
          icon={CheckCircle}
          color="green"
          subtitle="Bulletins validés / payés"
        />
        <KpiCard
          title="Reste à verser"
          value={periodeActive ? formatPrice(kpis.resteAPayer) : '—'}
          icon={Clock}
          color={kpis.resteAPayer > 0 ? 'orange' : 'green'}
          subtitle="Bulletins en attente"
        />
      </KpiGrid>


      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1">Mois</label>
          <select style={selectStyle} value={formMois.mois} onChange={(e) => setFormMois({ ...formMois, mois: e.target.value })}>
            {MOIS.slice(1).map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1">Année</label>
          <input
            type="number"
            style={{ ...selectStyle, width: 100 }}
            value={formMois.anneeCivile}
            onChange={(e) => setFormMois({ ...formMois, anneeCivile: e.target.value })}
          />
        </div>
        <Button onClick={ouvrirPeriode} loading={busy}>Ouvrir période</Button>
      </div>

      <DataTable
        loading={loading}
        data={periodes}
        emptyMessage="Aucune période de paie"
        onRowClick={(row) => setPeriodeActive(row)}
        columns={[
          {
            key: 'periode',
            label: 'Période',
            render: (_, row) => `${MOIS[row.mois]} ${row.anneeCivile}`,
          },
          {
            key: 'statut',
            label: 'Statut',
            render: (val) => {
              const c = STATUT_PERIODE[val] || STATUT_PERIODE.ouverte;
              return <Badge variant={c.variant}>{c.label}</Badge>;
            },
          },
          {
            key: '_count',
            label: 'Bulletins',
            render: (_, row) => row._count?.bulletins ?? '—',
          },
        ]}
      />

      {periodeActive && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {MOIS[periodeActive.mois]} {periodeActive.anneeCivile}
            </h3>
            <Badge variant={STATUT_PERIODE[periodeActive.statut]?.variant || 'neutral'}>
              {STATUT_PERIODE[periodeActive.statut]?.label || periodeActive.statut}
            </Badge>
            <div className="flex gap-2 ml-auto flex-wrap">
              <Button variant="secondary" icon={Calculator} onClick={calculer} loading={busy}>
                Calculer
              </Button>
              <Button icon={CheckCircle} onClick={validerPeriode} loading={busy} disabled={periodeActive.statut === 'validee' || periodeActive.statut === 'payee'}>
                Valider & créer dépenses
              </Button>
              <Button variant="secondary" icon={Wallet} onClick={marquerPayee} loading={busy} disabled={periodeActive.statut !== 'validee'}>
                Marquer payée
              </Button>
            </div>
          </div>

          <DataTable
            data={bulletins}
            emptyMessage="Calculez la période pour générer les bulletins"
            columns={[
              {
                key: 'staff',
                label: 'Agent',
                render: (_, row) => `${row.staff?.prenom} ${row.staff?.nom}`,
              },
              {
                key: 'montantFixe',
                label: 'Fixe',
                render: (val) => formatPrice(val),
              },
              {
                key: 'heuresValidees',
                label: 'Heures',
                render: (val) => Number(val || 0).toFixed(2),
              },
              {
                key: 'montantHoraire',
                label: 'Horaire',
                render: (val) => formatPrice(val),
              },
              {
                key: 'montantTotal',
                label: 'Total',
                render: (val) => <span className="font-semibold">{formatPrice(val)}</span>,
              },
              {
                key: 'statut',
                label: 'Statut',
                render: (val) => <Badge variant={val === 'valide' ? 'success' : 'neutral'}>{val}</Badge>,
              },
              {
                key: 'actions',
                label: '',
                render: (_, row) => row.statut === 'brouillon' && (
                  <Button size="sm" variant="secondary" onClick={() => setEditBulletin({ ...row })}>
                    Ajuster
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        open={!!editBulletin}
        onClose={() => setEditBulletin(null)}
        title="Ajuster bulletin"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditBulletin(null)}>Annuler</Button>
            <Button onClick={saveBulletin} loading={busy}>Enregistrer</Button>
          </>
        }
      >
        {editBulletin && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {editBulletin.staff?.prenom} {editBulletin.staff?.nom}
            </p>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Montant fixe</label>
              <Input
                type="number"
                value={editBulletin.montantFixe}
                onChange={(e) => setEditBulletin({ ...editBulletin, montantFixe: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Montant horaire</label>
              <Input
                type="number"
                value={editBulletin.montantHoraire}
                onChange={(e) => setEditBulletin({ ...editBulletin, montantHoraire: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Total</label>
              <Input
                type="number"
                value={editBulletin.montantTotal}
                onChange={(e) => setEditBulletin({ ...editBulletin, montantTotal: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Paie;
