package fr.johnbsoftware.verif;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin maison (reçoit les partages depuis Facebook, TikTok, X…) : à enregistrer avant super.onCreate.
        registerPlugin(ShareInboxPlugin.class);
        // Fichiers privés et rappel quotidien (WorkManager).
        registerPlugin(VerifNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
