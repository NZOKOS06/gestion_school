import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { useDebounce } from '../../hooks/useDebounce';
import { PageHeader, SearchInput, Card, Button } from '../../components/ui';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowRight,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';

const NouvelleVente = () => {
  const navigate = useNavigate();
  const { formatPrice } = useTenant();
  const { get, post, loading } = useAxios();
  
  const [search, setSearch] = useState('');
  const [medicaments, setMedicaments] = useState([]);
  const [panier, setPanier] = useState([]);
  const [nomClient, setNomClient] = useState('');
  const [telephoneClient, setTelephoneClient] = useState('');
  const [typeVente, setTypeVente] = useState('comptoir');
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      searchMedicaments();
    }
  }, [debouncedSearch]);

  const searchMedicaments = async () => {
    try {
      const response = await get(`/api/medicaments?search=${debouncedSearch}&limit=10`);
      setMedicaments(response.data);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const addToPanier = (med) => {
    const existant = panier.find(p => p.medicamentId === med.id);
    if (existant) {
      if (existant.quantite < med.stockTotal) {
        setPanier(panier.map(p => 
          p.medicamentId === med.id 
            ? { ...p, quantite: p.quantite + 1, sousTotal: (p.quantite + 1) * p.prixUnitaire }
            : p
        ));
      } else {
        toast.error('Stock insuffisant');
      }
    } else {
      setPanier([...panier, {
        medicamentId: med.id,
        dci: med.dci,
        nomCommercial: med.nomCommercial,
        formeGalenique: med.formeGalenique,
        prixUnitaire: parseFloat(med.prixVente),
        quantite: 1,
        sousTotal: parseFloat(med.prixVente),
        stockDisponible: med.stockTotal
      }]);
    }
    setSearch('');
    setMedicaments([]);
  };

  const updateQuantite = (id, delta) => {
    setPanier(panier.map(p => {
      if (p.medicamentId === id) {
        const newQuantite = p.quantite + delta;
        if (newQuantite < 1) return p;
        if (newQuantite > p.stockDisponible) {
          toast.error('Stock insuffisant');
          return p;
        }
        return { ...p, quantite: newQuantite, sousTotal: newQuantite * p.prixUnitaire };
      }
      return p;
    }));
  };

  const removeFromPanier = (id) => {
    setPanier(panier.filter(p => p.medicamentId !== id));
  };

  const totalPanier = panier.reduce((sum, p) => sum + p.sousTotal, 0);

  const handleSubmit = async () => {
    if (panier.length === 0) {
      toast.error('Le panier est vide');
      return;
    }

    try {
      const lignes = panier.map(p => ({
        medicamentId: p.medicamentId,
        quantite: p.quantite,
        prixUnitaire: p.prixUnitaire
      }));

      const response = await post('/api/ventes', {
        typeVente,
        nomClient: nomClient || undefined,
        telephoneClient: telephoneClient || undefined,
        lignes
      }, { silent: true });

      toast.success('Vente créée avec succès');
      
      if (typeVente === 'comptoir') {
        navigate('/caissier');
      } else {
        navigate('/staff/mes-ventes');
      }
    } catch (error) {
      console.error('Create vente error:', error);
      const details = error.response?.data?.details;
      if (details?.length) {
        details.forEach(d => toast.error(d.message));
      } else {
        toast.error(error.response?.data?.error || 'Erreur lors de la création');
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvelle vente"
        subtitle="Recherchez des médicaments et validez la vente"
        icon={Package}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recherche et résultats */}
        <div className="space-y-4">
          <SearchInput
            data-testid="search-medicament"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un médicament..."
            loading={loading}
          />

          {medicaments.length > 0 && (
            <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm border border-[var(--border-subtle)] max-h-64 overflow-y-auto">
              {medicaments.map((med) => (
                <button
                  key={med.id}
                  data-testid="medicament-card"
                  onClick={() => addToPanier(med)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--surface-hover)] border-b border-[var(--border-subtle)] last:border-b-0 flex justify-between items-center transition-colors"
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{med.dci}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {med.nomCommercial} - {med.formeGalenique}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm" style={{ color: 'var(--color-primary)' }}>
                      {formatPrice(med.prixVente)}
                    </p>
                    <p
                      className={`text-xs ${
                        med.stockTotal <= 10 ? 'text-[#EF4444] font-medium' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      Stock: {med.stockTotal}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Infos client */}
          <Card title="Informations client" icon={Package}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Type de vente
                  </label>
                  <select
                    value={typeVente}
                    onChange={(e) => setTypeVente(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="comptoir">Comptoir</option>
                    <option value="livraison">Livraison</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Nom client (optionnel)
                </label>
                <input
                  data-testid="nom-client"
                  type="text"
                  value={nomClient}
                  onChange={(e) => setNomClient(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Nom du client"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Téléphone (optionnel)
                </label>
                <input
                  data-testid="tel-client"
                  type="tel"
                  value={telephoneClient}
                  onChange={(e) => setTelephoneClient(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Numéro de téléphone"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Panier */}
        <Card
          title="Panier"
          subtitle={<span data-testid="panier-count">{panier.length} article(s)</span>}
          icon={ShoppingCart}
        >
          {panier.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center py-8">Le panier est vide</p>
          ) : (
            <div className="space-y-3">
              {panier.map((item) => (
                <div
                  key={item.medicamentId}
                  className="flex items-center justify-between p-3 bg-[var(--surface-hover)] rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {item.dci}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatPrice(item.prixUnitaire)}/u
                    </p>
                  </div>

                  <div className="flex items-center gap-1 mx-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Minus}
                      onClick={() => updateQuantite(item.medicamentId, -1)}
                    />
                    <span className="w-8 text-center font-medium text-sm">
                      {item.quantite}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Plus}
                      onClick={() => updateQuantite(item.medicamentId, 1)}
                    />
                  </div>

                  <div className="text-right min-w-[80px]">
                    <p className="font-medium text-sm">
                      {formatPrice(item.sousTotal)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => removeFromPanier(item.medicamentId)}
                    className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] ml-1"
                  />
                </div>
              ))}

              <div className="border-t border-[var(--border-subtle)] pt-4 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-[var(--text-primary)]">
                    Total
                  </span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {formatPrice(totalPanier)}
                  </span>
                </div>

                <Button
                  data-testid="btn-creer-vente"
                  loading={loading}
                  disabled={loading || panier.length === 0}
                  icon={ArrowRight}
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                >
                  Valider la vente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default NouvelleVente;
