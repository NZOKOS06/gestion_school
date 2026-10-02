import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ShoppingBag, Plus, Trash2, Printer, Ban, Pencil, Tags, Package } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Button, Modal, Badge, DataTable, SegmentedControl, QuickSearchSelect } from '../../components/ui';
import { openPdf } from '../../utils/pdf';

const MODES = [
  { value: 'especes', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'carte', label: 'Carte' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'virement', label: 'Virement' },
];

const input = 'w-full px-3 py-2 border rounded-lg bg-[var(--surface-overlay)] text-sm';

/**
 * Ventes ponctuelles (maillots, uniformes, fournitures…) et recettes diverses
 * (émulation, dons, location…), avec reçu ; catalogue d'articles et catégories.
 */
const Ventes = () => {
  const { get, post, put, delete: del } = useAxios();
  const { user } = useAuth();
  const { formatPrice } = useTenant();
  const peutGerer = ['directeur', 'comptable'].includes(user?.role);
  const [onglet, setOnglet] = useState('vente');

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [loadingVentes, setLoadingVentes] = useState(false);

  const chargerReferentiels = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([
        get('/api/ventes/articles', { silent: true }),
        get('/api/finances/categories', { silent: true }),
      ]);
      setArticles(a?.data || []);
      setCategories(c?.data || []);
    } catch { /* silent */ }
  }, [get]);

  const chargerVentes = useCallback(async () => {
    setLoadingVentes(true);
    try {
      const res = await get('/api/ventes?limit=200', { silent: true });
      setVentes(res?.data || []);
    } catch { /* silent */ }
    setLoadingVentes(false);
  }, [get]);

  useEffect(() => { chargerReferentiels(); }, [chargerReferentiels]);
  useEffect(() => { if (onglet === 'historique') chargerVentes(); }, [onglet, chargerVentes]);
  useEffect(() => {
    get('/api/inscriptions?limit=500&statut=validee', { silent: true })
      .then((res) => setEleves((res?.data || []).map((i) => ({
        id: i.id,
        prenom: i.eleve?.prenom,
        nom: i.eleve?.nom,
        libelle: `${i.eleve?.prenom || ''} ${i.eleve?.nom || ''} (${i.classe?.nom || ''})`,
      }))))
      .catch(() => {});
  }, [get]);

  const categoriesRecette = categories.filter((c) => c.type === 'recette' && c.actif);
  const articlesActifs = articles.filter((a) => a.actif);

  // ─── Nouvelle vente ─────────────────────────────────────────────────────────
  const [panier, setPanier] = useState([]);
  const [acheteur, setAcheteur] = useState({ type: 'eleve', inscriptionId: '', clientNom: '' });
  const [paiement, setPaiement] = useState({ modePaiement: 'especes', reference: '' });
  const [ligneLibre, setLigneLibre] = useState({ libelle: '', prixUnitaire: '', categorieId: '' });
  const [enregistrement, setEnregistrement] = useState(false);

  const ajouterArticle = (article) => setPanier((p) => {
    const existe = p.find((l) => l.articleId === article.id);
    if (existe) return p.map((l) => (l.articleId === article.id ? { ...l, quantite: l.quantite + 1 } : l));
    return [...p, { cle: article.id, articleId: article.id, libelle: article.nom, prixUnitaire: Number(article.prix), quantite: 1 }];
  });

  const ajouterLigneLibre = () => {
    if (!ligneLibre.libelle.trim() || !(Number(ligneLibre.prixUnitaire) > 0) || !ligneLibre.categorieId) {
      toast.error('Libellé, montant et catégorie obligatoires');
      return;
    }
    setPanier((p) => [...p, {
      cle: `libre-${Date.now()}`,
      libelle: ligneLibre.libelle.trim(),
      prixUnitaire: Number(ligneLibre.prixUnitaire),
      categorieId: ligneLibre.categorieId,
      quantite: 1,
    }]);
    setLigneLibre({ libelle: '', prixUnitaire: '', categorieId: ligneLibre.categorieId });
  };

  const total = useMemo(() => panier.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0), [panier]);

  const enregistrerVente = async () => {
    if (!panier.length) return;
    setEnregistrement(true);
    try {
      const vente = await post('/api/ventes', {
        lignes: panier.map((l) => (l.articleId
          ? { articleId: l.articleId, quantite: l.quantite }
          : { libelle: l.libelle, prixUnitaire: l.prixUnitaire, quantite: l.quantite, categorieId: l.categorieId })),
        inscriptionId: acheteur.type === 'eleve' ? (acheteur.inscriptionId || null) : null,
        clientNom: acheteur.type === 'client' ? acheteur.clientNom : null,
        modePaiement: paiement.modePaiement,
        reference: paiement.reference || null,
      });
      toast.success(`Vente n°${vente.numero} enregistrée — ${formatPrice(vente.montantTotal)}`);
      openPdf(`/api/ventes/${vente.id}/recu-pdf`, `recu-vente-${vente.numero}.pdf`);
      setPanier([]);
      setAcheteur({ type: 'eleve', inscriptionId: '', clientNom: '' });
      setPaiement({ modePaiement: 'especes', reference: '' });
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
    setEnregistrement(false);
  };

  // ─── Historique ─────────────────────────────────────────────────────────────
  const annuler = async (v) => {
    const motif = window.prompt(`Motif de l'annulation de la vente n°${v.numero} :`);
    if (!motif) return;
    try {
      await post(`/api/ventes/${v.id}/annuler`, { motif });
      toast.success('Vente annulée');
      chargerVentes();
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };

  // ─── Articles ───────────────────────────────────────────────────────────────
  const [articleForm, setArticleForm] = useState(null);
  const enregistrerArticle = async () => {
    const f = articleForm;
    const payload = {
      nom: f.nom,
      description: f.description,
      prix: Number(f.prix),
      categorieId: f.categorieId || null,
      gereStock: f.gereStock,
      stock: f.gereStock ? Number(f.stock || 0) : null,
      actif: f.actif,
    };
    try {
      if (f.id) await put(`/api/ventes/articles/${f.id}`, payload);
      else await post('/api/ventes/articles', payload);
      toast.success('Article enregistré');
      setArticleForm(null);
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };
  const supprimerArticle = async (a) => {
    if (!window.confirm(`Supprimer « ${a.nom} » ?`)) return;
    try {
      const res = await del(`/api/ventes/articles/${a.id}`);
      toast.success(res?.message || 'Article supprimé');
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };

  // ─── Catégories ─────────────────────────────────────────────────────────────
  const [nouvelleCategorie, setNouvelleCategorie] = useState({ type: 'recette', nom: '' });
  const creerCategorie = async () => {
    if (!nouvelleCategorie.nom.trim()) return;
    try {
      await post('/api/finances/categories', nouvelleCategorie);
      toast.success('Catégorie ajoutée');
      setNouvelleCategorie({ ...nouvelleCategorie, nom: '' });
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };
  const renommerCategorie = async (c) => {
    const nom = window.prompt('Nouveau nom :', c.nom);
    if (!nom || nom === c.nom) return;
    try {
      await put(`/api/finances/categories/${c.id}`, { nom });
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };
  const supprimerCategorie = async (c) => {
    if (!window.confirm(`Supprimer la catégorie « ${c.nom} » ?`)) return;
    try {
      const res = await del(`/api/finances/categories/${c.id}`);
      toast.success(res?.message || 'Catégorie supprimée');
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };
  const reactiverCategorie = async (c) => {
    try {
      await put(`/api/finances/categories/${c.id}`, { actif: true });
      chargerReferentiels();
    } catch { /* toast via useAxios */ }
  };

  const ongletsDisponibles = [
    { value: 'vente', label: 'Nouvelle vente' },
    { value: 'historique', label: 'Historique' },
    ...(peutGerer ? [{ value: 'articles', label: 'Articles' }, { value: 'categories', label: 'Catégories' }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventes & recettes diverses"
        subtitle="Maillots, uniformes, fournitures, émulation, dons… avec reçu"
        icon={ShoppingBag}
      />
      <SegmentedControl value={onglet} onChange={setOnglet} options={ongletsDisponibles} />

      {onglet === 'vente' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Catalogue</p>
              {articlesActifs.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Aucun article. {peutGerer ? 'Ajoutez-en dans l\'onglet « Articles ».' : ''}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {articlesActifs.map((a) => {
                    const epuise = a.gereStock && (a.stock ?? 0) <= 0;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={epuise}
                        onClick={() => ajouterArticle(a)}
                        className="text-left rounded-lg p-3 disabled:opacity-50"
                        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
                      >
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.nom}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatPrice(a.prix)}{a.gereStock ? ` · stock ${a.stock ?? 0}` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recette diverse (hors catalogue)</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input className={`${input} sm:col-span-2`} placeholder="Libellé (ex. participation émulation)" value={ligneLibre.libelle} onChange={(e) => setLigneLibre({ ...ligneLibre, libelle: e.target.value })} />
                <input className={input} type="number" min="0" placeholder="Montant" value={ligneLibre.prixUnitaire} onChange={(e) => setLigneLibre({ ...ligneLibre, prixUnitaire: e.target.value })} />
                <select className={input} value={ligneLibre.categorieId} onChange={(e) => setLigneLibre({ ...ligneLibre, categorieId: e.target.value })}>
                  <option value="">Catégorie…</option>
                  {categoriesRecette.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <Button size="sm" variant="secondary" icon={Plus} onClick={ajouterLigneLibre}>Ajouter</Button>
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Vente en cours</p>
            {panier.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cliquez sur un article ou ajoutez une recette diverse.</p>
            ) : (
              <div className="space-y-2">
                {panier.map((l) => (
                  <div key={l.cle} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{l.libelle}</span>
                    <input
                      type="number"
                      min="1"
                      className="w-14 px-2 py-1 border rounded text-sm"
                      value={l.quantite}
                      onChange={(e) => setPanier((p) => p.map((x) => (x.cle === l.cle ? { ...x, quantite: Math.max(1, parseInt(e.target.value, 10) || 1) } : x)))}
                    />
                    <span className="w-24 text-right">{formatPrice(l.prixUnitaire * l.quantite)}</span>
                    <button type="button" onClick={() => setPanier((p) => p.filter((x) => x.cle !== l.cle))} title="Retirer">
                      <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t border-[var(--border-subtle)]">
                  <span>Total</span>
                  <span style={{ color: 'var(--color-primary)' }}>{formatPrice(total)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <SegmentedControl
                value={acheteur.type}
                onChange={(type) => setAcheteur({ ...acheteur, type })}
                options={[{ value: 'eleve', label: 'Élève' }, { value: 'client', label: 'Autre acheteur' }]}
              />
              {acheteur.type === 'eleve' ? (
                <QuickSearchSelect
                  items={eleves}
                  value={acheteur.inscriptionId}
                  onChange={(id) => setAcheteur({ ...acheteur, inscriptionId: id })}
                  getOptionLabel={(e) => e.libelle}
                  placeholder="Rechercher un élève (facultatif)"
                />
              ) : (
                <input className={input} placeholder="Nom de l'acheteur (facultatif)" value={acheteur.clientNom} onChange={(e) => setAcheteur({ ...acheteur, clientNom: e.target.value })} />
              )}
              <select className={input} value={paiement.modePaiement} onChange={(e) => setPaiement({ ...paiement, modePaiement: e.target.value })}>
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {paiement.modePaiement !== 'especes' && (
                <input className={input} placeholder="Référence (transaction, chèque…)" value={paiement.reference} onChange={(e) => setPaiement({ ...paiement, reference: e.target.value })} />
              )}
            </div>
            <Button className="w-full" icon={Printer} onClick={enregistrerVente} loading={enregistrement} disabled={!panier.length}>
              Encaisser et imprimer le reçu
            </Button>
          </div>
        </div>
      )}

      {onglet === 'historique' && (
        <DataTable
          loading={loadingVentes}
          data={ventes}
          emptyMessage="Aucune vente"
          columns={[
            { key: 'numero', label: 'N°', render: (v) => `V${String(v).padStart(4, '0')}` },
            { key: 'dateVente', label: 'Date', render: (v) => new Date(v).toLocaleString('fr-FR') },
            { key: 'lignes', label: 'Détail', render: (_, r) => r.lignes.map((l) => `${l.libelle}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`).join(', ') },
            { key: 'acheteur', label: 'Acheteur', render: (v) => v || '—' },
            { key: 'montantTotal', label: 'Montant', render: (v) => <span className="font-semibold">{formatPrice(v)}</span> },
            {
              key: 'statut',
              label: 'Statut',
              render: (v, r) => (v === 'annulee'
                ? <span title={r.motifAnnulation || ''}><Badge variant="danger">Annulée</Badge></span>
                : <Badge variant="success">Payée</Badge>),
            },
            {
              key: 'actions',
              label: '',
              render: (_, r) => (
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="secondary" icon={Printer} onClick={() => openPdf(`/api/ventes/${r.id}/recu-pdf`, `recu-vente-${r.numero}.pdf`)}>Reçu</Button>
                  {peutGerer && r.statut === 'payee' && (
                    <Button size="sm" variant="secondary" icon={Ban} onClick={() => annuler(r)}>Annuler</Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {onglet === 'articles' && peutGerer && (
        <div className="space-y-3">
          <Button icon={Package} onClick={() => setArticleForm({ nom: '', description: '', prix: '', categorieId: '', gereStock: false, stock: '', actif: true })}>
            Nouvel article
          </Button>
          <DataTable
            data={articles}
            emptyMessage="Aucun article"
            columns={[
              { key: 'nom', label: 'Article', render: (v, r) => <span className={r.actif ? '' : 'line-through opacity-60'}>{v}</span> },
              { key: 'prix', label: 'Prix', render: (v) => formatPrice(v) },
              { key: 'categorie', label: 'Catégorie', render: (v) => v?.nom || '—' },
              { key: 'stock', label: 'Stock', render: (v, r) => (r.gereStock ? (v ?? 0) : 'non suivi') },
              {
                key: 'actions',
                label: '',
                render: (_, r) => (
                  <div className="flex gap-1 justify-end">
                    <button type="button" className="p-1.5" title="Modifier" onClick={() => setArticleForm({ ...r, categorieId: r.categorieId || '', stock: r.stock ?? '' })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="p-1.5" title="Supprimer" onClick={() => supprimerArticle(r)}>
                      <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {onglet === 'categories' && peutGerer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {['recette', 'depense'].map((type) => (
            <div key={type} className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Tags className="h-4 w-4" /> {type === 'recette' ? 'Catégories de recettes' : 'Catégories de dépenses'}
              </p>
              {categories.filter((c) => c.type === type).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className={`flex-1 ${c.actif ? '' : 'line-through opacity-60'}`}>{c.nom}</span>
                  {c.systeme && <Badge variant="neutral">Système</Badge>}
                  {!c.systeme && (
                    <>
                      <button type="button" className="p-1" title="Renommer" onClick={() => renommerCategorie(c)}><Pencil className="h-3.5 w-3.5" /></button>
                      {c.actif ? (
                        <button type="button" className="p-1" title="Supprimer" onClick={() => supprimerCategorie(c)}>
                          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => reactiverCategorie(c)}>Réactiver</Button>
                      )}
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <input
                  className={input}
                  placeholder="Nouvelle catégorie"
                  value={nouvelleCategorie.type === type ? nouvelleCategorie.nom : ''}
                  onChange={(e) => setNouvelleCategorie({ type, nom: e.target.value })}
                />
                <Button size="sm" icon={Plus} onClick={creerCategorie} disabled={nouvelleCategorie.type !== type}>Ajouter</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!articleForm}
        onClose={() => setArticleForm(null)}
        title={articleForm?.id ? 'Modifier l\'article' : 'Nouvel article'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setArticleForm(null)}>Annuler</Button>
            <Button onClick={enregistrerArticle}>Enregistrer</Button>
          </>
        }
      >
        {articleForm && (
          <div className="space-y-3">
            <input className={input} placeholder="Nom (ex. Maillot de sport)" value={articleForm.nom} onChange={(e) => setArticleForm({ ...articleForm, nom: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={input} type="number" min="0" placeholder="Prix" value={articleForm.prix} onChange={(e) => setArticleForm({ ...articleForm, prix: e.target.value })} />
              <select className={input} value={articleForm.categorieId} onChange={(e) => setArticleForm({ ...articleForm, categorieId: e.target.value })}>
                <option value="">Catégorie de recette…</option>
                {categoriesRecette.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <input className={input} placeholder="Description (facultatif)" value={articleForm.description || ''} onChange={(e) => setArticleForm({ ...articleForm, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={articleForm.gereStock} onChange={(e) => setArticleForm({ ...articleForm, gereStock: e.target.checked })} />
              Suivre le stock
            </label>
            {articleForm.gereStock && (
              <input className={input} type="number" min="0" placeholder="Quantité en stock" value={articleForm.stock} onChange={(e) => setArticleForm({ ...articleForm, stock: e.target.value })} />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={articleForm.actif} onChange={(e) => setArticleForm({ ...articleForm, actif: e.target.checked })} />
              En vente
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Ventes;
