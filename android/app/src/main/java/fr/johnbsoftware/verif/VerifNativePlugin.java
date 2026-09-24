package fr.johnbsoftware.verif;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;

/**
 * Services natifs de Vérif (src/lib/verifNative.ts) :
 * - readFile / writeFile : fichiers du dossier privé de l'appli (le flux, trop gros pour les préférences) ;
 * - configureDigest / setKnownIds : réglages du rappel quotidien exécuté par {@link DigestWorker}.
 */
@CapacitorPlugin(name = "VerifNative")
public class VerifNativePlugin extends Plugin {

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
