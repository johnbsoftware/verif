import type { FactCheck } from '../types';
import { longDate } from '../lib/format';
import { socialLabel } from '../data/social';
import { openArticle, shareCheck } from '../lib/native';
import { VerdictBadge } from '../components/VerdictBadge';
import { Back, Bookmark, External, ShareIcon } from '../components/Icons';

interface Props {
  item: FactCheck;
  saved: boolean;
  onBack: () => void;
  onToggleSave: (it: FactCheck) => void;
}

export function DetailScreen({ item, saved, onBack, onToggleSave }: Props) {
  return (
    <div className="screen detail">
      <header className="detail-head">
        <button className="back" onClick={onBack} aria-label="Retour">
          <Back /> Retour
        </button>
        <div className="row">
          <button className="icon-btn" onClick={() => onToggleSave(item)} aria-label={saved ? 'Retirer des enregistrés' : 'Enregistrer'} aria-pressed={saved}>
            <Bookmark size={20} filled={saved} />
          </button>
          <button className="icon-btn" onClick={() => shareCheck(item)} aria-label="Partager">
            <ShareIcon />
          </button>
        </div>
      </header>

      <main className="detail-body">
        <div className="stack-14">
          <div className="row gap-10">
            <VerdictBadge verdict={item.verdict} large />
            <span className="muted small">
              {item.theme === item.country ? item.country : `${item.country} · ${item.theme}`}
              {socialLabel(item) ? ` · ${socialLabel(item)}` : ''}
            </span>
          </div>
          <h1 className="detail-claim">« {item.claim} »</h1>
          <p className="muted small">
            {item.claimant ? `Affirmation de : ${item.claimant}` : 'Auteur de l’affirmation non précisé'}
            {item.claimDate ? ` · ${longDate(item.claimDate)}` : ''}
          </p>
        </div>

        <section className="panel">
          <h2 className="section-title">Conclusion du vérificateur</h2>
          <p className="panel-rating">{item.rating || 'Voir l’article'}</p>
          {item.title && <p className="panel-title">{item.title}</p>}
          {item.summary && (
            <>
              <p className="panel-summary">{item.summary}</p>
              <p className="fineprint">Résumé publié par {item.publisher} avec son article.</p>
            </>
          )}
        </section>

        <section className="source">
          <h2 className="section-title">Vérifié par</h2>
          <div className="stack-2">
            <span className="source-name">{item.publisher}</span>
            <span className="muted small">Publié le {longDate(item.reviewDate)} · {item.site}</span>
          </div>
          <button className="primary" onClick={() => openArticle(item.url)}>
            Lire la vérification complète <External />
          </button>
          <p className="fineprint">
            Vérif ne juge pas elle-même : chaque verdict provient de l’organisme cité, recensé par Google Fact Check Tools.
            Le classement Faux / Trompeur / Vrai est une traduction automatique de sa conclusion.
          </p>
        </section>
      </main>
    </div>
  );
}
