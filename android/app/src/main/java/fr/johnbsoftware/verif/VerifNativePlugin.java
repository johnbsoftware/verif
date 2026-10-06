package fr.johnbsoftware.verif;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;

/**
 * Services natifs de Vérif (src/lib/verifNative.ts) :
 * - readFile / writeFile : fichiers du dossier privé de l'appli (le flux, trop gros pour les préférences) ;
 * - configureDigest / setKnownIds : réglages du rappel quotidien exécuté par {@link DigestWorker} ;
 * - translate : traduction anglais → français sur le téléphone (ML Kit, modèle d'environ 30 Mo
 *   téléchargé une fois ; aucun texte n'est envoyé à un serveur).
 */
@CapacitorPlugin(name = "VerifNative")
public class VerifNativePlugin extends Plugin {

    private Translator translator;

    private synchronized Translator translator() {
        if (translator == null) {
            TranslatorOptions options = new TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.ENGLISH)
                .setTargetLanguage(TranslateLanguage.FRENCH)
                .build();
            translator = Translation.getClient(options);
        }
        return translator;
    }

    @Override
    protected void handleOnDestroy() {
        if (translator != null) translator.close();
        translator = null;
        super.handleOnDestroy();
    }

    /**
     * Traduit une liste de textes (même ordre en sortie ; texte vide → vide). Télécharge le modèle
     * la première fois (Wi-Fi ou données mobiles). Erreur « download » si le téléchargement échoue.
     */
    @PluginMethod
    public void translate(PluginCall call) {
        JSArray input = call.getArray("texts", new JSArray());
        final List<String> texts = new ArrayList<>();
        for (int i = 0; i < input.length(); i++) texts.add(input.optString(i, ""));
        final Translator t = translator();
        t.downloadModelIfNeeded(new DownloadConditions.Builder().build())
            .addOnSuccessListener(unused -> {
                List<Task<String>> tasks = new ArrayList<>();
                for (String text : texts) tasks.add(text.isEmpty() ? Tasks.forResult("") : t.translate(text));
                Tasks.whenAllSuccess(tasks)
                    .addOnSuccessListener(results -> {
                        JSArray out = new JSArray();
                        for (Object r : results) out.put(r == null ? "" : r.toString());
                        JSObject res = new JSObject();
                        res.put("texts", out);
                        call.resolve(res);
                    })
                    .addOnFailureListener(e -> call.reject("Traduction impossible", "translate", e));
            })
            .addOnFailureListener(e -> call.reject("Téléchargement du traducteur impossible", "download", e));
    }

    /** Nom simple uniquement (pas de « / » ni de « .. ») : on reste dans le dossier de l'appli. */
    private static String safeName(String name) {
        if (name == null || name.isEmpty() || !name.matches("[A-Za-z0-9._-]+") || name.startsWith(".")) return null;
        return name;
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String name = safeName(call.getString("name"));
        if (name == null) {
            call.reject("Nom de fichier invalide");
            return;
        }
        File file = new File(getContext().getFilesDir(), name);
        JSObject result = new JSObject();
        if (!file.exists()) {
            call.resolve(result);
            return;
        }
        try (InputStream in = new FileInputStream(file)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream((int) Math.max(1024, file.length()));
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            result.put("data", new String(out.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (IOException e) {
            call.reject("Lecture impossible", e);
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String name = safeName(call.getString("name"));
        String data = call.getString("data");
        if (name == null || data == null) {
            call.reject("Nom ou contenu manquant");
            return;
        }
        File dir = getContext().getFilesDir();
        File tmp = new File(dir, name + ".tmp");
        File file = new File(dir, name);
        // Écriture dans un fichier temporaire puis renommage : jamais de flux à moitié écrit.
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write(data.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            call.reject("Écriture impossible", e);
            return;
        }
        if (!tmp.renameTo(file)) {
            file.delete();
            if (!tmp.renameTo(file)) {
                call.reject("Écriture impossible");
                return;
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void configureDigest(PluginCall call) {
        Context ctx = getContext();
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        JSArray countries = call.getArray("countries", new JSArray());
        JSArray themes = call.getArray("themes", new JSArray());
        SharedPreferences.Editor edit = DigestWorker.prefs(ctx).edit()
            .putBoolean(DigestWorker.KEY_ENABLED, enabled)
            .putInt(DigestWorker.KEY_HOUR, call.getInt("hour", 7))
            .putInt(DigestWorker.KEY_MINUTE, call.getInt("minute", 30))
            .putString(DigestWorker.KEY_FEED_URL, call.getString("feedUrl", ""))
            .putString(DigestWorker.KEY_COUNTRIES, countries.toString())
            .putString(DigestWorker.KEY_THEMES, themes.toString())
            .putBoolean(DigestWorker.KEY_ENGLISH, Boolean.TRUE.equals(call.getBoolean("english", true)));
        edit.apply();
        if (enabled) DigestWorker.schedule(ctx);
        else DigestWorker.cancel(ctx);
        call.resolve();
    }

    @PluginMethod
    public void setKnownIds(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        StringBuilder sb = new StringBuilder();
        JSONArray arr = ids;
        for (int i = 0; i < arr.length(); i++) {
            String id = arr.optString(i, "");
            if (id.isEmpty()) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(id);
        }
        DigestWorker.prefs(getContext()).edit().putString(DigestWorker.KEY_KNOWN, sb.toString()).apply();
        call.resolve();
    }
}
