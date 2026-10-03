import { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Badge, QuickSearchSelect } from '../../components/ui';
import { User, Phone, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, CreditCard, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';

const LIENS_PARENTE = [
  'Père',
  'Mère',
  'Tuteur légal',
  'Oncle / Tante',
  'Grand-parent',
  'Autre responsable',
];

export default function InscriptionWizard({
  open,
  onClose,
  classes = [],
  annees = [],
  eleves = [],
  parents = [],
  fraisInscriptionDefault = 0,
  formatPrice = (v) => `${v} FCFA`,
  onSuccess,
  post,
  get,
}) {
  const { config: tenantConfig } = useTenant();
  // Portail parent : proposé uniquement si le module est activé pour l'école
  const portailDisponible = Boolean(tenantConfig?.moduleParents);
  const [accesParent, setAccesParent] = useState(null);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('nouveau'); // 'nouveau' | 'existant'
  const [parentMode, setParentMode] = useState('nouveau'); // 'nouveau' | 'existant'
  const [saving, setSaving] = useState(false);

  // Form State
  const [anneeScolaireId, setAnneeScolaireId] = useState(
    annees.find((a) => a.actif || a.statut === 'active')?.id || annees[0]?.id || ''
  );

  // Synchronise anneeScolaireId quand la liste des années arrive de l'API
  useEffect(() => {
    if (!anneeScolaireId && annees.length > 0) {
      const active = annees.find((a) => a.actif || a.statut === 'active') || annees[0];
      if (active?.id) setAnneeScolaireId(active.id);
    }
  }, [annees, anneeScolaireId]);

  const [classeId, setClasseId] = useState('');
  const [existingEleveId, setExistingEleveId] = useState('');
  const [existingParentId, setExistingParentId] = useState('');

  const [eleve, setEleve] = useState({
    matricule: `GS-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
    nom: '',
    prenom: '',
    dateNaissance: '',
    sexe: 'M',
    lieuNaissance: '',
    adresse: '',
  });

  const [tuteur, setTuteur] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    lienParente: 'Père',
    adresse: '',
    activerEspaceParent: false,
  });

  const effectiveAnneeId = anneeScolaireId || annees.find((a) => a.actif || a.statut === 'active')?.id || annees[0]?.id || '';

  const availableClasses = useMemo(
    () => classes.filter((c) => !effectiveAnneeId || c.anneeScolaireId === effectiveAnneeId),
    [classes, effectiveAnneeId]
  );

  const selectedClasse = useMemo(
    () => classes.find((c) => c.id === classeId),
    [classes, classeId]
  );

  // Tarif par défaut calculé par le serveur (inscription vs réinscription, classe vs défaut école)
  const [tarifServeur, setTarifServeur] = useState(null);
  const [tarifErreur, setTarifErreur] = useState('');
  const [regime, setRegime] = useState('plein_temps');
  const [servicesChoisis, setServicesChoisis] = useState([]);
  const servicesKey = servicesChoisis.slice().sort().join(',');
  const eleveIdPourTarif = mode === 'existant' ? existingEleveId : '';
  useEffect(() => {
    if (!get || !classeId) {
      setTarifServeur(null);
      return undefined;
    }
    let cancelled = false;
    const params = new URLSearchParams({ classeId, anneeScolaireId: effectiveAnneeId || '', regime });
    if (servicesKey) params.set('services', servicesKey);
    if (eleveIdPourTarif) params.set('eleveId', eleveIdPourTarif);
    get(`/api/inscriptions/frais-preview?${params.toString()}`, { silent: true })
      .then((res) => { if (!cancelled) { setTarifServeur(res || null); setTarifErreur(''); } })
      .catch((err) => {
        if (cancelled) return;
        setTarifServeur(null);
        setTarifErreur(err?.response?.data?.error || '');
      });
    return () => { cancelled = true; };
  }, [get, classeId, effectiveAnneeId, eleveIdPourTarif, regime, servicesKey]);
  const regimesActifs = Boolean(tarifServeur?.regimesActifs);
  const servicesDisponibles = tarifServeur?.servicesDisponibles || [];
  const servicesRetenus = servicesDisponibles.filter((s) => servicesChoisis.includes(s.id));
  const totalServices = servicesRetenus.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const toggleService = (id) => setServicesChoisis((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const UNITE = { mensuelle: 'mois', trimestrielle: 'trimestre', annuelle: 'an', unique: 'paiement' };
  // Changement de classe : on ne garde que les services encore proposés
  useEffect(() => {
    if (!tarifServeur?.servicesDisponibles) return;
    const ok = new Set(tarifServeur.servicesDisponibles.map((s) => s.id));
    setServicesChoisis((prev) => (prev.every((id) => ok.has(id)) ? prev : prev.filter((id) => ok.has(id))));
  }, [tarifServeur]);

  const fraisInscriptionBase = tarifServeur
    ? Number(tarifServeur.fraisInscription || 0)
    : Number(selectedClasse?.fraisInscription || 0) || Number(fraisInscriptionDefault || 0);
  const fraisScolariteBase = tarifServeur
    ? Number(tarifServeur.fraisScolarite || 0)
    : Number(selectedClasse?.fraisScolarite || 0);
  const estReinscription = tarifServeur?.typeFrais === 'reinscription';
  const sourceLabel = {
    classe_inscription: 'tarif de la classe',
    classe_reinscription: 'tarif de la classe',
    ecole_inscription: "défaut de l'école",
    ecole_reinscription: "défaut de l'école",
    aucun: 'aucun tarif défini',
  }[tarifServeur?.sourceFraisInscription] || null;

  // Tarif spécial (cas sociaux, remise) : montants libres + motif obligatoire
  const [tarifSpecial, setTarifSpecial] = useState(false);
  const [tarifCustom, setTarifCustom] = useState({ fraisInscription: '', fraisScolarite: '', motif: '' });

  // Assistant remis à zéro à chaque ouverture : sinon le matricule et les saisies de l'inscription
  // précédente restent en place et bloquent la suivante (matricule déjà utilisé, élève/tuteur préremplis)
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMode('nouveau');
    setParentMode('nouveau');
    setAccesParent(null);
    setSaving(false);
    setClasseId('');
    setExistingEleveId('');
    setExistingParentId('');
    setEleve({
      matricule: `GS-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
      nom: '', prenom: '', dateNaissance: '', sexe: 'M', lieuNaissance: '', adresse: '',
    });
    setTuteur({ nom: '', prenom: '', telephone: '', email: '', lienParente: 'Père', adresse: '', activerEspaceParent: false });
    setRegime('plein_temps');
    setServicesChoisis([]);
    setTarifServeur(null);
    setTarifSpecial(false);
    setTarifCustom({ fraisInscription: '', fraisScolarite: '', motif: '' });
    const active = annees.find((x) => x.actif || x.statut === 'active') || annees[0];
    setAnneeScolaireId(active?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    setTarifCustom((t) => ({
      ...t,
      fraisInscription: String(fraisInscriptionBase),
      fraisScolarite: String(fraisScolariteBase),
    }));
  }, [fraisInscriptionBase, fraisScolariteBase]);

  const fraisInscription = tarifSpecial ? Math.max(0, Number(tarifCustom.fraisInscription) || 0) : fraisInscriptionBase;
  const fraisScolarite = tarifSpecial ? Math.max(0, Number(tarifCustom.fraisScolarite) || 0) : fraisScolariteBase;
  const totalFrais = fraisInscription + fraisScolarite + totalServices;

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

  const validateStep1 = () => {
    if (!effectiveAnneeId) {
      toast.error('Sélectionnez une année scolaire');
      return false;
    }
    if (!classeId) {
      toast.error('Sélectionnez une classe');
      return false;
    }
    if (mode === 'existant') {
      if (!existingEleveId) {
        toast.error('Sélectionnez l\'élève existant');
        return false;
      }
      return true;
    }
    if (!eleve.nom.trim() || !eleve.prenom.trim() || !eleve.matricule.trim() || !eleve.dateNaissance || !eleve.sexe) {
      toast.error('Veuillez remplir tous les champs obligatoires de l\'élève (*)');
      return false;
    }
    const birth = new Date(eleve.dateNaissance);
    const today = new Date();
    if (isNaN(birth.getTime()) || birth > today) {
      toast.error('Date de naissance invalide ou dans le futur');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (parentMode === 'existant') {
      if (!existingParentId) {
        toast.error('Sélectionnez le tuteur dans la liste');
        return false;
      }
      return true;
    }
    if (!tuteur.nom.trim() || !tuteur.telephone.trim()) {
      toast.error('Le nom et le numéro de téléphone du tuteur sont strictement obligatoires (*)');
      return false;
    }
    if (tuteur.telephone.replace(/\D/g, '').length < 6) {
      toast.error('Numéro de téléphone du tuteur invalide');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2()) return;
    if (tarifErreur) {
      toast.error(tarifErreur);
      return;
    }
    if (tarifSpecial && !tarifCustom.motif.trim()) {
      toast.error('Indiquez le motif du tarif spécial');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        classeId,
        anneeScolaireId: effectiveAnneeId,
        eleveId: mode === 'existant' ? existingEleveId : undefined,
        eleve: mode === 'nouveau' ? eleve : undefined,
        parentId: parentMode === 'existant' ? existingParentId : undefined,
        tuteur: parentMode === 'nouveau' ? tuteur : undefined,
        activerEspaceParent: portailDisponible && Boolean(tuteur.activerEspaceParent),
        regime,
        services: servicesChoisis,
        ...(tarifSpecial ? {
          fraisInscription,
          fraisScolarite,
          motifTarifSpecial: tarifCustom.motif.trim(),
        } : {}),
      };

      const result = await post('/api/inscriptions/avec-eleve', payload);
      toast.success('Inscription enregistrée avec succès !');
      onSuccess?.();
      if (result?.accesParent) {
        // Identifiants provisoires affichés une seule fois
        setAccesParent(result.accesParent);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erreur lors de l\'inscription');
    }
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Acheminement d'Inscription Scolaire"
      subtitle="Parcours guidé : Élève → Tuteur Obligatoire → Récapitulatif"
      size="lg"
      footer={accesParent ? null : (
        <div className="flex items-center justify-between w-full">
          <div>
            {step > 1 && (
              <Button
                variant="secondary"
                icon={ArrowLeft}
                onClick={() => setStep(step - 1)}
                disabled={saving}
              >
                Précédent
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            {step < 3 ? (
              <Button icon={ArrowRight} onClick={handleNext}>
                Suivant : {step === 1 ? 'Tuteur obligatoire' : 'Récapitulatif'}
              </Button>
            ) : (
              <Button icon={CheckCircle2} onClick={handleSubmit} loading={saving}>
                Confirmer l'inscription
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {accesParent ? (
        <div className="space-y-4 text-center py-4">
          <ShieldCheck className="h-10 w-10 mx-auto" style={{ color: 'var(--color-success)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Espace parent activé pour {accesParent.nom}</p>
          <div className="inline-block text-left rounded-xl p-4 space-y-1" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm">Identifiant : <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{accesParent.identifiant}</strong></p>
            <p className="text-sm">Mot de passe provisoire : <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{accesParent.motDePasse}</strong></p>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Remettez ces identifiants au parent : ils ne seront plus affichés. Il devra choisir son propre mot de passe à la première connexion.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => window.print()}>Imprimer</Button>
            <Button onClick={() => { setAccesParent(null); onClose(); }}>Terminer</Button>
          </div>
        </div>
      ) : (
      <div className="space-y-6">
        {/* Progress Bar / Stepper Header */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, title: 'Élève & Classe', icon: User },
            { num: 2, title: 'Tuteur / Parent (*)', icon: Phone },
            { num: 3, title: 'Récapitulatif', icon: CheckCircle2 },
          ].map((s) => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <div
                key={s.num}
                className="flex items-center gap-2 p-2.5 rounded-xl border transition-all"
                style={{
                  background: active ? 'var(--color-primary)' : done ? 'var(--surface-overlay)' : 'var(--surface-raised)',
                  borderColor: active ? 'var(--color-primary)' : done ? 'var(--color-primary)' : 'var(--border-subtle)',
                  color: active ? '#ffffff' : done ? 'var(--color-primary)' : 'var(--text-muted)',
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: active ? '#ffffff' : done ? 'var(--color-primary)' : 'var(--surface-hover)',
                    color: active ? 'var(--color-primary)' : done ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {done ? '✓' : s.num}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{s.title}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* STEP 1: ELEVE & CLASSE */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('nouveau')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={mode === 'nouveau'
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Nouvel élève
              </button>
              <button
                type="button"
                onClick={() => setMode('existant')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={mode === 'existant'
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Élève existant
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Année scolaire *</label>
                <select
                  style={inputStyle}
                  value={anneeScolaireId || effectiveAnneeId}
                  onChange={(e) => {
                    setAnneeScolaireId(e.target.value);
                    setClasseId('');
                  }}
                >
                  {annees.map((a) => (
                    <option key={a.id} value={a.id}>{a.libelle} {a.actif ? '(active)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Classe cible *</label>
                <select
                  style={inputStyle}
                  value={classeId}
                  onChange={(e) => setClasseId(e.target.value)}
                >
                  <option value="">Sélectionner une classe</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.cycle}) · {formatPrice(c.fraisScolarite || 0)}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'existant' ? (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sélectionner l'élève existant *</label>
                <QuickSearchSelect
                  items={eleves}
                  value={existingEleveId}
                  onChange={setExistingEleveId}
                  getLabel={(el) => `${el.prenom} ${el.nom} (${el.matricule})`}
                  placeholder="Rechercher par nom, prénom ou matricule..."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Matricule *</label>
                  <input
                    style={inputStyle}
                    value={eleve.matricule}
                    onChange={(e) => setEleve({ ...eleve, matricule: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sexe *</label>
                  <select
                    style={inputStyle}
                    value={eleve.sexe}
                    onChange={(e) => setEleve({ ...eleve, sexe: e.target.value })}
                  >
                    <option value="M">Masculin (Garçon)</option>
                    <option value="F">Féminin (Fille)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom de l'élève *</label>
                  <input
                    style={inputStyle}
                    placeholder="ex: MABIALA"
                    value={eleve.nom}
                    onChange={(e) => setEleve({ ...eleve, nom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Prénom de l'élève *</label>
                  <input
                    style={inputStyle}
                    placeholder="ex: Jean-Paul"
                    value={eleve.prenom}
                    onChange={(e) => setEleve({ ...eleve, prenom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date de naissance *</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={eleve.dateNaissance}
                    onChange={(e) => setEleve({ ...eleve, dateNaissance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Lieu de naissance</label>
                  <input
                    style={inputStyle}
                    placeholder="ex: Brazzaville, Pointe-Noire..."
                    value={eleve.lieuNaissance}
                    onChange={(e) => setEleve({ ...eleve, lieuNaissance: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Adresse de résidence</label>
                  <input
                    style={inputStyle}
                    placeholder="ex: 12 rue des Écoles, Moungali"
                    value={eleve.adresse}
                    onChange={(e) => setEleve({ ...eleve, adresse: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: TUTEUR OBLIGATOIRE */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--text-primary)', border: '1px solid var(--color-primary)30' }}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <span>Les coordonnées du tuteur sont <strong>obligatoires</strong> pour le suivi scolaire, les urgences et l'accès au portail parent.</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setParentMode('nouveau')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={parentMode === 'nouveau'
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Nouveau tuteur
              </button>
              <button
                type="button"
                onClick={() => setParentMode('existant')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={parentMode === 'existant'
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Tuteur déjà enregistré
              </button>
            </div>

            {parentMode === 'existant' ? (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sélectionner le parent / tuteur *</label>
                <QuickSearchSelect
                  items={parents}
                  value={existingParentId}
                  onChange={setExistingParentId}
                  getLabel={(p) => `${p.prenom || ''} ${p.nom || ''} (${p.telephone || p.email || 'Sans contact'})`}
                  placeholder="Rechercher par nom ou numéro de téléphone..."
                />
                {portailDisponible && existingParentId && !parents.find((p) => p.id === existingParentId)?.portailActif && (
                  <label className="flex items-center gap-2 text-sm mt-3 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={tuteur.activerEspaceParent}
                      onChange={(e) => setTuteur({ ...tuteur, activerEspaceParent: e.target.checked })}
                    />
                    Activer l'espace parent de ce tuteur (mot de passe provisoire)
                  </label>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom du tuteur *</label>
                  <input
                    style={inputStyle}
                    placeholder="Nom du tuteur légal"
                    value={tuteur.nom}
                    onChange={(e) => setTuteur({ ...tuteur, nom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Prénom du tuteur</label>
                  <input
                    style={inputStyle}
                    placeholder="Prénom du tuteur"
                    value={tuteur.prenom}
                    onChange={(e) => setTuteur({ ...tuteur, prenom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Numéro de téléphone *</label>
                  <input
                    type="tel"
                    style={inputStyle}
                    placeholder="ex: 06 123 45 67"
                    value={tuteur.telephone}
                    onChange={(e) => setTuteur({ ...tuteur, telephone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Lien de parenté</label>
                  <select
                    style={inputStyle}
                    value={tuteur.lienParente}
                    onChange={(e) => setTuteur({ ...tuteur, lienParente: e.target.value })}
                  >
                    {LIENS_PARENTE.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Adresse email (optionnel)</label>
                  <input
                    type="email"
                    style={inputStyle}
                    placeholder="parent@email.cg"
                    value={tuteur.email}
                    onChange={(e) => setTuteur({ ...tuteur, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Adresse du tuteur</label>
                  <input
                    style={inputStyle}
                    placeholder="Adresse complète"
                    value={tuteur.adresse}
                    onChange={(e) => setTuteur({ ...tuteur, adresse: e.target.value })}
                  />
                </div>
                {portailDisponible && (
                <div className="sm:col-span-2 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] mt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={tuteur.activerEspaceParent}
                      onChange={(e) => setTuteur({ ...tuteur, activerEspaceParent: e.target.checked })}
                    />
                    <div>
                      <span className="text-sm font-semibold block" style={{ color: 'var(--text-primary)' }}>
                        Activer l'accès Espace Parent en ligne (Portail Parent)
                      </span>
                      <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                        Génère un mot de passe provisoire (connexion par téléphone ou email) : absences, sanctions, annonces, factures,
                        et notes / bulletins lorsque la scolarité du mois écoulé est réglée.
                      </span>
                    </div>
                  </label>
                </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: RECAPITULATIF & VALIDATION */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Détail de l'inscription
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Élève</span>
                  <span className="font-semibold block text-[var(--text-primary)]">
                    {mode === 'existant'
                      ? eleves.find((e) => e.id === existingEleveId)?.nom + ' ' + eleves.find((e) => e.id === existingEleveId)?.prenom
                      : `${eleve.nom} ${eleve.prenom} (${eleve.matricule})`}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Sexe : {eleve.sexe === 'M' ? 'Garçon' : 'Fille'} · Naissance : {eleve.dateNaissance || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Classe & Année</span>
                  <span className="font-semibold block text-[var(--text-primary)]">
                    {selectedClasse?.nom || '—'} ({selectedClasse?.cycle || '—'})
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {annees.find((a) => a.id === anneeScolaireId)?.libelle || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Tuteur / Responsable</span>
                  <span className="font-semibold block text-[var(--text-primary)]">
                    {parentMode === 'existant'
                      ? parents.find((p) => p.id === existingParentId)?.nom + ' ' + parents.find((p) => p.id === existingParentId)?.prenom
                      : `${tuteur.nom} ${tuteur.prenom} (${tuteur.lienParente})`}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Tél : {parentMode === 'existant' ? parents.find((p) => p.id === existingParentId)?.telephone : tuteur.telephone}
                  </span>
                </div>
                {portailDisponible && (
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Espace Parent en ligne</span>
                  <Badge variant={tuteur.activerEspaceParent ? 'success' : 'neutral'}>
                    {tuteur.activerEspaceParent ? 'Sera activé' : 'Non activé'}
                  </Badge>
                </div>
                )}
              </div>
            </div>

            {/* Financial summary */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Frais scolaires associés
              </h4>
              {(regimesActifs || servicesDisponibles.length > 0) && (
                <div className="flex flex-wrap items-center gap-4 pb-2 border-b border-[var(--border-subtle)] text-sm">
                  {regimesActifs && (
                    <div className="flex items-center gap-3">
                      <span style={{ color: 'var(--text-secondary)' }}>Régime :</span>
                      {[['plein_temps', 'Plein temps'], ['mi_temps', 'Mi-temps']].map(([val, label]) => (
                        <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="regime" checked={regime === val} onChange={() => setRegime(val)} />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                  {servicesDisponibles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full">
                      <span style={{ color: 'var(--text-secondary)' }}>Services optionnels :</span>
                      {servicesDisponibles.map((s) => (
                        <label key={s.id} className="flex items-center gap-1.5 cursor-pointer" title={s.description || ''}>
                          <input type="checkbox" checked={servicesChoisis.includes(s.id)} onChange={() => toggleService(s.id)} />
                          {s.nom} ({formatPrice(s.tarif)}/{UNITE[s.periodicite] || 'mois'})
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tarifErreur && (
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{tarifErreur}</p>
              )}
              <div className="flex justify-between text-sm py-1 border-b border-[var(--border-subtle)]">
                <span style={{ color: 'var(--text-secondary)' }}>
                  {estReinscription ? 'Frais de réinscription' : "Frais d'inscription"}
                  {!tarifSpecial && sourceLabel && <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>({sourceLabel})</span>}
                </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatPrice(fraisInscription)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b border-[var(--border-subtle)]">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Frais de scolarité{regime === 'mi_temps' ? ' — mi-temps' : ''} ({selectedClasse?.nom || ''}{(() => {
                    const m = Number(regime === 'mi_temps' ? selectedClasse?.fraisMensuelMiTemps : selectedClasse?.fraisMensuel) || 0;
                    return m > 0 ? ` · ${formatPrice(m)}/m` : '';
                  })()})
                </span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatPrice(fraisScolarite)}</span>
              </div>
              {servicesRetenus.map((s) => (
                <div key={s.id} className="flex justify-between text-sm py-1 border-b border-[var(--border-subtle)]">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {s.nom} ({s.nbPeriodes} × {formatPrice(s.tarif)})
                  </span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatPrice(s.total)}</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-bold pt-1">
                <span style={{ color: 'var(--text-primary)' }}>Total à ouvrir au dossier</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatPrice(totalFrais)}</span>
              </div>

              <label className="flex items-center gap-2 text-sm pt-2 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={tarifSpecial}
                  onChange={(e) => setTarifSpecial(e.target.checked)}
                />
                Appliquer un tarif spécial (situation sociale, remise, bourse…)
              </label>
              {tarifSpecial && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {estReinscription ? 'Frais de réinscription' : "Frais d'inscription"} (défaut : {formatPrice(fraisInscriptionBase)})
                    </span>
                    <input
                      type="number"
                      min="0"
                      style={inputStyle}
                      value={tarifCustom.fraisInscription}
                      onChange={(e) => setTarifCustom({ ...tarifCustom, fraisInscription: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                      Scolarité annuelle (défaut : {formatPrice(fraisScolariteBase)})
                    </span>
                    <input
                      type="number"
                      min="0"
                      style={inputStyle}
                      value={tarifCustom.fraisScolarite}
                      onChange={(e) => setTarifCustom({ ...tarifCustom, fraisScolarite: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Motif (obligatoire, conservé dans l'historique)</span>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="Ex. famille en difficulté, orphelin, fratrie…"
                      value={tarifCustom.motif}
                      onChange={(e) => setTarifCustom({ ...tarifCustom, motif: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </Modal>
  );
}
