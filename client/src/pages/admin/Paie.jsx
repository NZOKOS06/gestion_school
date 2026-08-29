import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, DataTable, Badge, Button, Modal, Input, KpiCard, KpiGrid } from '../../components/ui';
import { Banknote, Calculator, CheckCircle, Wallet, Users, TrendingUp, Clock, Printer, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const STATUT_PERIODE = {
  ouverte: { label: 'Ouverte', variant: 'neutral' },
  calculee: { label: 'Calculée', variant: 'warning' },
  validee: { label: 'Validée (Approuvée)', variant: 'success' },
  payee: { label: 'Payée (Décaissée)', variant: 'success' },
};

const Paie = () => {
  const { get, post, put } = useAxios();
  const { formatPrice, config, logoUrl } = useTenant();
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
      toast.success('Période approuvée & validée');
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
      toast.success('Décaissement global clôturé (Payée)');
    } catch {
      toast.error('Action impossible');
    }
    setBusy(false);
  };

  const decaisserBulletin = async (b) => {
    setBusy(true);
    try {
      await post(`/api/paie/bulletins/${b.id}/valider`);
      toast.success(`Salaire de ${b.staff?.prenom} ${b.staff?.nom} décaissé`);
      await fetchBulletins(periodeActive.id);
      await fetchPeriodes();
    } catch {
      toast.error('Impossible de décaisser ce bulletin');
    }
    setBusy(false);
  };

  const printFichePaie = (b) => {
    const ecoleNom = config?.nomEcole || 'Établissement Scolaire';
    const moisNom = MOIS[periodeActive?.mois] || '';
    const anneeCiv = periodeActive?.anneeCivile || '';
    const dateToday = new Date().toLocaleDateString('fr-FR');

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <title>Bulletin de Paie — ${b.staff?.nom || ''} ${b.staff?.prenom || ''}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 30px; margin: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .ecole-title { font-size: 20px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
          .ecole-subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
          .doc-title { font-size: 16px; font-weight: bold; text-align: center; background: #f1f5f9; padding: 8px; border-radius: 6px; margin: 20px 0; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 13px; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
          .info-box span { display: block; font-size: 11px; color: #64748b; margin-bottom: 3px; }
          .info-box strong { font-size: 14px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f1f5f9; text-align: left; padding: 10px; border: 1px solid #cbd5e1; font-weight: 600; }
          td { padding: 10px; border: 1px solid #cbd5e1; }
          .total-row { font-size: 15px; font-weight: bold; background: #e2e8f0; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
          .sig-box { border: 1px dashed #94a3b8; border-radius: 6px; padding: 15px; height: 90px; font-size: 12px; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="ecole-title">${ecoleNom}</div>
            <div class="ecole-subtitle">${config?.adresse || ''} · Tél : ${config?.telephone || ''}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            Date d'édition : ${dateToday}
          </div>
        </div>

        <div class="doc-title">BULLETIN DE SALAIRE & REÇU DE DÉCAISSEMENT — ${moisNom.toUpperCase()} ${anneeCiv}</div>

        <div class="grid">
          <div class="info-box">
            <span>BÉNÉFICIAIRE (AGENT)</span>
            <strong>${b.staff?.nom?.toUpperCase() || ''} ${b.staff?.prenom || ''}</strong>
            <div style="font-size: 12px; color: #475569; margin-top: 3px;">Rôle : ${b.staff?.role || 'Enseignant'}</div>
            <div style="font-size: 12px; color: #475569;">Email : ${b.staff?.email || '—'}</div>
          </div>
          <div class="info-box">
            <span>PÉRIODE DE PAIE</span>
            <strong>${moisNom} ${anneeCiv}</strong>
            <div style="font-size: 12px; color: #475569; margin-top: 3px;">Statut : ${b.statut === 'valide' || b.statut === 'paye' ? 'RÉGLÉ (DÉCAISSÉ)' : 'EN COURS'}</div>
            <div style="font-size: 12px; color: #475569;">Mode de paiement : Espèces / Caisse</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>DÉSIGNATION / ÉLÉMENTS DE PAIE</th>
              <th style="text-align: right;">MONTANT / VALEUR</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Salaire de base / Fixe mensuel</td>
              <td style="text-align: right;">${formatPrice(b.montantFixe || 0)}</td>
            </tr>
            <tr>
              <td>Heures de cours validées (${Number(b.heuresValidees || 0).toFixed(1)} h)</td>
              <td style="text-align: right;">${formatPrice(b.montantHoraire || 0)}</td>
            </tr>
            <tr class="total-row">
              <td>NET À PAYER / DÉCAISSÉ</td>
              <td style="text-align: right; color: #16a34a;">${formatPrice(b.montantTotal || 0)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <strong>Signature et Cachet du Gestionnaire / Caissier</strong>
          </div>
          <div class="sig-box">
            <strong>Signature du Bénéficiaire (Reçu pour solde)</strong>
          </div>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>`;

    const win = window.open('', '_blank', 'width=850,height=750');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
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
                label: 'Actions',
                render: (_, row) => (
                  <div className="flex items-center gap-1.5 justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Printer}
                      onClick={() => printFichePaie(row)}
                      title="Imprimer la fiche de paie / reçu de décaissement"
                    >
                      Fiche
                    </Button>
                    {row.statut === 'brouillon' && (
                      <Button size="sm" variant="secondary" onClick={() => setEditBulletin({ ...row })}>
                        Ajuster
                      </Button>
                    )}
                    {row.statut !== 'valide' && row.statut !== 'paye' && (
                      <Button size="sm" icon={CheckCircle} onClick={() => decaisserBulletin(row)} loading={busy}>
                        Décaisser
                      </Button>
                    )}
                  </div>
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
