import { useState, useEffect, useMemo } from 'react';
import { Button, Modal, Badge, QuickSearchSelect } from '../../components/ui';
import { User, Phone, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, CreditCard, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

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
}) {
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
    activerEspaceParent: true,
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

  const fraisScolarite = Number(selectedClasse?.fraisScolarite || 0);
  const totalFrais = Number(fraisInscriptionDefault || 0) + fraisScolarite;

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
    setSaving(true);
    try {
      const payload = {
        classeId,
        anneeScolaireId: effectiveAnneeId,
        eleveId: mode === 'existant' ? existingEleveId : undefined,
        eleve: mode === 'nouveau' ? eleve : undefined,
        parentId: parentMode === 'existant' ? existingParentId : undefined,
        tuteur: parentMode === 'nouveau' ? tuteur : undefined,
      };

      await post('/api/inscriptions/avec-eleve', payload);
      toast.success('Inscription enregistrée avec succès !');
      onSuccess?.();
      onClose();
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
      footer={
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
      }
    >
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
                    <option key={c.id} value={c.id}>{c.nom} ({c.cycle}) — {formatPrice(c.fraisScolarite || 0)}</option>
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
                        Génère automatiquement les accès de connexion (téléphone/email + mot de passe temporaire) pour suivre les notes, absences et paiements.
                      </span>
                    </div>
                  </label>
                </div>
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
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Espace Parent en ligne</span>
                  <Badge variant={tuteur.activerEspaceParent ? 'success' : 'neutral'}>
                    {tuteur.activerEspaceParent ? 'Activé' : 'Désactivé'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-overlay)] space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Frais scolaires associés
              </h4>
              <div className="flex justify-between text-sm py-1 border-b border-[var(--border-subtle)]">
                <span style={{ color: 'var(--text-secondary)' }}>Frais d'inscription de base</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatPrice(fraisInscriptionDefault)}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b border-[var(--border-subtle)]">
                <span style={{ color: 'var(--text-secondary)' }}>Frais de scolarité annuels ({selectedClasse?.nom})</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatPrice(fraisScolarite)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1">
                <span style={{ color: 'var(--text-primary)' }}>Total à ouvrir au dossier</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatPrice(totalFrais)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
