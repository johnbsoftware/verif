import type { Feed } from '../types';
import { EFCSN_URL, IFCN_URL } from '../config';
import { openArticle } from '../lib/native';
import { Back, External } from '../components/Icons';

// « Pourquoi ces sources ? » : comment Vérif choisit ses sources, ce qui fait la fiabilité
// d'un organisme de vérification, et la fiche de chaque organisme (collector/sources.json → about).

export function SourcesScreen({ feed, onBack }: { feed: Feed | null; onBack: () => void }) {
  const sources = [...(feed?.sources ?? [])].sort((a, b) => b.total - a.total);
  return (
    <div className="screen detail" role="dialog" aria-modal="true" aria-label="Pourquoi ces sources ?">
      <header className="detail-head">
        <button className="back" onClick={onBack} aria-label="Retour">
          <Back /> Retour
        </button>
      </header>
      <main className="detail-body">
        <h1 className="detail-claim">Pourquoi ces sources ?</h1>

        <section className="stack-8">
          <h2 className="section-title">Comment Vérif les choisit</h2>
          <p className="intro">
            Vérif ne juge rien elle-même. Elle reprend les vérifications des organismes de fact-checking dont les articles
            sont recensés par <strong>Google Fact Check Tools</strong> : ceux qui publient, avec chaque vérification, un
            balisage normalisé (ClaimReview) indiquant l'affirmation, son auteur et la conclusion.
          </p>
          <p className="intro">
            Chaque carte cite son organisme et renvoie vers l'article complet : c'est là que se trouvent les preuves
            (documents, chiffres, images d'origine), pour juger sur pièces.
          </p>
        </section>

        <section className="stack-8">
          <h2 className="section-title">Qu'est-ce qui rend un vérificateur fiable ?</h2>
          <p className="intro">
            Personne ne décrète la vérité ; on peut en revanche juger une méthode. Le repère le plus utilisé est le code de
            principes de l'<strong>IFCN</strong> (International Fact-Checking Network), et son équivalent européen
            l'<strong>EFCSN</strong>. Les signataires s'engagent, sous contrôle extérieur chaque année, à :
          </p>
          <ul className="tips">
            <li><strong>Vérifier tous les camps</strong>, sans parti pris ;</li>
            <li><strong>Montrer leurs sources</strong>, pour que chacun puisse refaire la vérification ;</li>
            <li><strong>Dire qui les finance</strong> ;</li>
            <li><strong>Expliquer leur méthode</strong> et le choix des sujets ;</li>
            <li><strong>Corriger publiquement</strong> leurs erreurs.</li>
          </ul>
          <div className="row gap-8 wrap">
            <button className="secondary" onClick={() => openArticle(IFCN_URL)}>Registre IFCN <External /></button>
            <button className="secondary" onClick={() => openArticle(EFCSN_URL)}>EFCSN <External /></button>
          </div>
        </section>

        <section className="stack-8">
          <h2 className="section-title">Les limites</h2>
          <p className="intro">
            Les vérificateurs choisissent ce qu'ils vérifient : le nombre de vérifications sur un sujet ou une personne
            reflète ce choix, pas une mesure de sincérité. Ils peuvent se tromper ; les signataires s'engagent à le
            corriger. La parole d'une personnalité, quel que soit son rang, est vérifiée comme toute autre affirmation :
            sur les faits.
          </p>
        </section>

        <section className="stack-8">
          <h2 className="section-title">Les organismes suivis</h2>
          <div className="group">
            {sources.map((s) => (
              <button key={s.site} className="group-row about-row tall" onClick={() => openArticle(`https://${s.site}`)}>
                <span className="stack-2">
                  <span>
                    {s.name}
                    {s.about?.ifcn && <span className="tag tag-ifcn">Signataire IFCN</span>}
                    {s.about?.efcsn && <span className="tag tag-ifcn">Membre EFCSN</span>}
                  </span>
                  <span className="muted small">
                    {[s.about?.media, s.country, `${s.total} vérification${s.total > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                  </span>
                  {s.about?.note && <span className="muted small">{s.about.note}</span>}
                </span>
                <External />
              </button>
            ))}
          </div>
          <p className="fineprint">
            Le statut IFCN / EFCSN n'est indiqué que lorsqu'il a été vérifié sur les registres officiels ; consultez-les pour
            les autres organismes.
          </p>
        </section>
      </main>
    </div>
  );
}
