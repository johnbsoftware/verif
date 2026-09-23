export type Verdict = 'faux' | 'trompeur' | 'vrai' | 'autre';

/** Une vérification, telle que produite par collector/normalize.mjs. */
export interface FactCheck {
  id: string;
  claim: string;
  claimant: string | null;
  claimDate: string | null;
  /** Verdict tel qu'écrit par l'éditeur (« Photo sortie de son contexte »…). */
  rating: string;
  verdict: Verdict;
  theme: string;
  country: string;
  lang: string;
  publisher: string;
  site: string;
  title: string | null;
  /** Résumé écrit par la rédaction (balise d'aperçu de l'article) ; null si introuvable. */
  summary?: string | null;
  url: string;
  reviewDate: string;
}

export interface FeedSource {
  site: string;
  name: string;
  country: string;
  lang: string;
  fetchedToday: number;
  total: number;
  error?: string;
}

export interface Feed {
  version: number;
  generatedAt: string;
  /** Présent sur le flux de démonstration livré avec l'appli. */
  demo?: boolean;
  keepDays?: number;
  sources: FeedSource[];
  items: FactCheck[];
}

export interface Settings {
  /** Pays affichés ; vide = tous. */
  countries: string[];
  /** Thèmes suivis ; vide = tous. */
  themes: string[];
  dailyDigest: boolean;
  /** Afficher aussi les vérifications rédigées en anglais. */
  english: boolean;
  /** Une seule carte par sujet quand plusieurs vérifications portent sur la même affirmation. */
  grouped: boolean;
}

export type Tab = 'feed' | 'check' | 'saved' | 'filters';
