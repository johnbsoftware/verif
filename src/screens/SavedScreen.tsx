import type { FactCheck } from '../types';
import { ClaimCard } from '../components/ClaimCard';

export function SavedScreen({ items, onOpen }: { items: FactCheck[]; onOpen: (it: FactCheck) => void }) {
  return (
    <div className="screen">
      <header className="page-head">
        <h1 className="brand brand-sm">Enregistrés</h1>
      </header>
      <main className="list">
        {items.length === 0 ? (
          <p className="empty">
            Rien d’enregistré pour l’instant. Touchez le signet d’une vérification pour la garder ici, même après sa sortie du fil.
          </p>
        ) : (
          items.map((it) => <ClaimCard key={it.id} item={it} onOpen={onOpen} />)
        )}
      </main>
    </div>
  );
}
