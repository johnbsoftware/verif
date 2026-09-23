package fr.johnbsoftware.verif;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reçoit ce que l'utilisateur partage vers Vérif (texte, lien ou image) depuis
 * une autre appli, et le garde en attente jusqu'à ce que la page le réclame
 * avec take(). Fonctionne aussi quand l'appli était fermée (démarrage à froid) :
 * l'intention de lancement est lue dans load().
 *
 * searchImage() transmet une image reçue à Google Lens (appli Google),
 * ou à défaut ouvre le sélecteur de partage d'Android.
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {

    private static final String TAG = "ShareInbox";
    private static final String GOOGLE_APP = "com.google.android.googlequicksearchbox";
    private static final long MAX_IMAGE_BYTES = 25L * 1024 * 1024;

    private JSObject pending;

    @Override
    public void load() {
        capture(getActivity().getIntent(), false);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        capture(intent, true);
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject result = pending != null ? pending : new JSObject();
        pending = null;
        call.resolve(result);
    }

    /** Lit le texte d'une image reçue (ML Kit, sur le téléphone, sans connexion). */
    @PluginMethod
    public void readText(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Chemin d'image manquant");
            return;
        }
        final TextRecognizer recognizer;
        final InputImage image;
        try {
            image = InputImage.fromFilePath(getContext(), Uri.fromFile(new File(path)));
            recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        } catch (Exception e) {
            Log.e(TAG, "readText", e);
            call.reject("Image illisible", e);
            return;
        }
        recognizer.process(image)
            .addOnSuccessListener(result -> {
                call.resolve(new JSObject().put("text", result.getText()));
                recognizer.close();
            })
            .addOnFailureListener(e -> {
                Log.e(TAG, "readText", e);
                call.reject("Lecture du texte impossible", e);
                recognizer.close();
            });
    }

    @PluginMethod
    public void searchImage(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Chemin d'image manquant");
            return;
        }
        try {
            Context ctx = getContext();
            File file = new File(path);
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mimeOf(file.getName()));
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri("", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try {
                // L'appli Google accepte une image de deux façons : « Enregistrer » (collections)
                // et « Rechercher une image » (Lens). On vise explicitement la seconde.
                Intent lens = new Intent(send);
                ComponentName target = findLensActivity(send);
                if (target != null) lens.setComponent(target);
                else lens.setPackage(GOOGLE_APP);
                getActivity().startActivity(lens);
                call.resolve(new JSObject().put("via", target != null ? "lens" : "google"));
            } catch (ActivityNotFoundException e) {
                Intent chooser = Intent.createChooser(send, "Rechercher cette image avec…");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(chooser);
                call.resolve(new JSObject().put("via", "chooser"));
            }
        } catch (Exception e) {
            Log.e(TAG, "searchImage", e);
            call.reject("Impossible d'ouvrir la recherche d'image", e);
        }
    }

    /** Cherche, dans l'appli Google, l'activité de recherche d'image (Lens) qui accepte ce partage. */
    @SuppressWarnings("deprecation")
    private ComponentName findLensActivity(Intent send) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent probe = new Intent(send).setPackage(GOOGLE_APP);
            List<ResolveInfo> found = pm.queryIntentActivities(probe, 0);
            ResolveInfo byLabel = null;
            for (ResolveInfo ri : found) {
                String name = ri.activityInfo.name.toLowerCase(Locale.ROOT);
                if (name.contains("lens")) return new ComponentName(ri.activityInfo.packageName, ri.activityInfo.name);
                CharSequence label = ri.loadLabel(pm);
                String l = label != null ? label.toString().toLowerCase(Locale.ROOT) : "";
                if (byLabel == null && (l.contains("rechercher") || l.contains("search") || l.contains("lens"))) byLabel = ri;
            }
            if (byLabel != null) return new ComponentName(byLabel.activityInfo.packageName, byLabel.activityInfo.name);
        } catch (Exception e) {
            Log.e(TAG, "findLensActivity", e);
        }
        return null;
    }

    private void capture(Intent intent, boolean notify) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        try {
            JSObject data = new JSObject();
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (text != null) data.put("text", text);
            if (subject != null) data.put("subject", subject);

            // On cherche une image jointe quel que soit le type annoncé : certaines applis
            // envoient « text/plain » avec une image, d'autres « image/* » sans extension.
            Uri stream = Intent.ACTION_SEND_MULTIPLE.equals(action) ? firstStreamOf(intent) : streamOf(intent);
            if (stream != null) {
                String type = null;
                try { type = getContext().getContentResolver().getType(stream); } catch (Exception ignored) { }
                if (type == null) type = intent.getType();
                if (type != null && type.startsWith("image/")) {
                    String path = copyToCache(stream, type);
                    if (path != null) {
                        data.put("imagePath", path);
                        data.put("mimeType", type);
                    }
                }
            }
            pending = data;
            // Consommée : une rotation d'écran ne doit pas rejouer le partage.
            getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
            if (notify) notifyListeners("shareReceived", new JSObject());
        } catch (Exception e) {
            Log.e(TAG, "capture", e);
        }
    }

    @SuppressWarnings("deprecation")
    private Uri streamOf(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        }
        return intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    @SuppressWarnings("deprecation")
    private Uri firstStreamOf(Intent intent) {
        ArrayList<Uri> list = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
            : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        return list != null && !list.isEmpty() ? list.get(0) : null;
    }

    private String copyToCache(Uri uri, String mimeType) {
        File dir = new File(getContext().getCacheDir(), "partages");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) f.delete(); // on ne garde que le dernier partage
        String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
        File out = new File(dir, "partage-" + System.currentTimeMillis() + "." + (ext != null ? ext : "jpg"));
        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
             OutputStream os = new FileOutputStream(out)) {
            if (in == null) return null;
            byte[] buf = new byte[64 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_IMAGE_BYTES) {
                    os.close();
                    out.delete();
                    return null;
                }
                os.write(buf, 0, n);
            }
            return out.getAbsolutePath();
        } catch (Exception e) {
            Log.e(TAG, "copyToCache", e);
            return null;
        }
    }

    private static String mimeOf(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "image/*";
    }
}
