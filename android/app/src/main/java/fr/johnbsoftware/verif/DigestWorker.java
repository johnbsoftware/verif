package fr.johnbsoftware.verif;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Rappel quotidien : chaque matin (7 h 30 par défaut, dès qu'il y a du réseau), télécharge le flux,
 * compte les vérifications nouvelles qui passent les filtres de l'utilisateur (pays, thèmes, langue)
 * et ne notifie que s'il y en a. Se reprogramme pour le lendemain.
 *
 * « Nouvelles » = absentes de la liste des vérifications déjà connues : celles affichées dans l'appli
 * (transmises par setKnownIds) et celles déjà annoncées par un rappel précédent.
 */
public class DigestWorker extends Worker {

    private static final String TAG = "VerifDigest";
    static final String WORK_NAME = "verif-digest";
    private static final String CHANNEL_ID = "digest";
    private static final int NOTIFICATION_ID = 7002;
    private static final String PREFS = "verif_digest";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_HOUR = "hour";
    static final String KEY_MINUTE = "minute";
    static final String KEY_FEED_URL = "feedUrl";
    static final String KEY_COUNTRIES = "countries";
    static final String KEY_THEMES = "themes";
    static final String KEY_ENGLISH = "english";
    static final String KEY_KNOWN = "known";
    private static final String KEY_ATTEMPT = "attempt";
    /** Collecte de GitHub en retard : on réessaie toutes les heures, 4 fois au plus. */
    private static final int MAX_ATTEMPTS = 4;
    private static final long STALE_MS = TimeUnit.HOURS.toMillis(20);

    public DigestWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // --- Programmation ---

    /** Prochain passage : aujourd'hui à l'heure choisie si elle n'est pas passée, sinon demain. */
    static void schedule(Context ctx) {
        SharedPreferences p = prefs(ctx);
        long delay = delayUntil(p.getInt(KEY_HOUR, 7), p.getInt(KEY_MINUTE, 30), 0);
        enqueue(ctx, delay, 0, ExistingWorkPolicy.REPLACE);
    }

    static void cancel(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME);
    }

    /** Millisecondes jusqu'à la prochaine occurrence de hh:mm, au moins minGapMs plus tard. */
    static long delayUntil(int hour, int minute, long minGapMs) {
        long now = System.currentTimeMillis();
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        while (next.getTimeInMillis() <= now + minGapMs) next.add(Calendar.DAY_OF_MONTH, 1);
        return next.getTimeInMillis() - now;
    }

    private static void enqueue(Context ctx, long delayMs, int attempt, ExistingWorkPolicy policy) {
        Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(DigestWorker.class)
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .setConstraints(constraints)
            .setInputData(new Data.Builder().putInt(KEY_ATTEMPT, attempt).build())
            .build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(WORK_NAME, policy, request);
    }

    /** Depuis le travail en cours : APPEND_OR_REPLACE lance la suite une fois celui-ci terminé. */
    private void next(long delayMs, int attempt) {
        enqueue(getApplicationContext(), delayMs, attempt, ExistingWorkPolicy.APPEND_OR_REPLACE);
    }

    private void tomorrow() {
        SharedPreferences p = prefs(getApplicationContext());
        next(delayUntil(p.getInt(KEY_HOUR, 7), p.getInt(KEY_MINUTE, 30), TimeUnit.HOURS.toMillis(2)), 0);
    }

    // --- Travail ---

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences p = prefs(ctx);
        if (!p.getBoolean(KEY_ENABLED, false)) return Result.success();
        int attempt = getInputData().getInt(KEY_ATTEMPT, 0);
        try {
            JSONObject feed = new JSONObject(download(p.getString(KEY_FEED_URL, "")));
            long generated = parseIso(feed.optString("generatedAt", ""));
            if (System.currentTimeMillis() - generated > STALE_MS && attempt < MAX_ATTEMPTS) {
                next(TimeUnit.HOURS.toMillis(1), attempt + 1); // collecte du matin pas encore publiée
                return Result.success();
            }
            announce(ctx, p, feed.optJSONArray("items"));
        } catch (Exception e) {
            Log.w(TAG, "Rappel quotidien : échec", e);
            if (attempt < MAX_ATTEMPTS) {
                next(TimeUnit.HOURS.toMillis(1), attempt + 1);
                return Result.success();
            }
        }
        tomorrow();
        return Result.success();
    }

    private void announce(Context ctx, SharedPreferences p, JSONArray items) throws Exception {
        if (items == null) return;
        String knownRaw = p.getString(KEY_KNOWN, "");
        Set<String> known = new HashSet<>();
        if (!knownRaw.isEmpty()) known.addAll(Arrays.asList(knownRaw.split(",")));
        Set<String> countries = toSet(p.getString(KEY_COUNTRIES, "[]"));
        Set<String> themes = toSet(p.getString(KEY_THEMES, "[]"));
        boolean english = p.getBoolean(KEY_ENGLISH, true);

        List<String> allIds = new ArrayList<>();
        List<JSONObject> fresh = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            String id = it.optString("id", "");
            if (id.isEmpty()) continue;
            allIds.add(id);
            if (known.contains(id)) continue;
            String lang = it.optString("lang", "fr");
            if (!english && !(lang.isEmpty() || lang.toLowerCase(Locale.ROOT).startsWith("fr"))) continue;
            if (!countries.isEmpty() && !countries.contains(it.optString("country", ""))) continue;
            if (!themes.isEmpty() && !themes.contains(it.optString("theme", ""))) continue;
            fresh.add(it);
        }

        // Tout le flux du jour devient « connu » : rien ne sera annoncé deux fois.
        // Premier passage sans liste connue (appli jamais ouverte depuis l'activation) : on n'annonce rien.
        p.edit().putString(KEY_KNOWN, TextUtils.join(",", allIds)).apply(); // String.join : API 26
        if (known.isEmpty() || fresh.isEmpty()) return;
        notify(ctx, fresh);
    }

    @SuppressLint("MissingPermission") // vérifiée par areNotificationsEnabled()
    private void notify(Context ctx, List<JSONObject> fresh) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Vérifications du jour", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Rappel du matin quand de nouvelles vérifications correspondent à vos filtres");
            NotificationManager sys = ctx.getSystemService(NotificationManager.class);
            if (sys != null) sys.createNotificationChannel(channel);
        }

        int n = fresh.size();
        String title = n == 1 ? "1 nouvelle vérification" : n + " nouvelles vérifications";
        String body;
        if (n == 1) {
            JSONObject it = fresh.get(0);
            body = "« " + it.optString("claim", "") + " » — " + it.optString("publisher", "");
        } else {
            body = byTheme(fresh);
        }

        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_verif)
            .setColor(0xFF2B4C7E)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setNumber(n)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        nm.notify(NOTIFICATION_ID, b.build());
    }

    /** « Santé 3 · Politique 2 · Société 1 » (trois thèmes les plus représentés). */
    static String byTheme(List<JSONObject> fresh) {
        Map<String, Integer> counts = new HashMap<>();
        for (JSONObject it : fresh) {
            String t = it.optString("theme", "Divers");
            Integer c = counts.get(t);
            counts.put(t, c == null ? 1 : c + 1);
        }
        List<Map.Entry<String, Integer>> entries = new ArrayList<>(counts.entrySet());
        Collections.sort(entries, (a, b) -> b.getValue() - a.getValue());
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(3, entries.size()); i++) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(entries.get(i).getKey()).append(' ').append(entries.get(i).getValue());
        }
        return sb.toString();
    }

    // --- Utilitaires ---

    private static Set<String> toSet(String json) {
        Set<String> out = new HashSet<>();
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) out.add(a.optString(i, ""));
        } catch (Exception ignored) {
        }
        out.remove("");
        return out;
    }

    /** « 2026-09-23T07:05:52.718Z » → millisecondes (API 24 : pas de java.time). */
    static long parseIso(String iso) {
        if (iso == null || iso.length() < 19) return 0;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(iso.substring(0, 19));
            return d != null ? d.getTime() : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private static String download(String url) throws Exception {
        if (url == null || !url.startsWith("https://")) throw new IllegalStateException("Adresse du flux absente");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestProperty("Cache-Control", "no-cache");
        c.setRequestProperty("Accept", "application/json");
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new IllegalStateException("HTTP " + code);
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return new String(out.toByteArray(), StandardCharsets.UTF_8);
            }
        } finally {
            c.disconnect();
        }
    }
}
