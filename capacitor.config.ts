import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.johnbsoftware.verif',
  appName: 'Vérif',
  webDir: 'dist',
  android: {
    // Android 15+ dessine l'appli sous les barres système (edge-to-edge) :
    // Capacitor ajoute les marges nécessaires. Passer à 'force' si les
    // boutons du bas restent cachés sous la barre de navigation.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#2B4C7E',
    },
  },
};

export default config;
