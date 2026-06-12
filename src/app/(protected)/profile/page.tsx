"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const TIMEZONES = [
  { value: "Europe/Istanbul",     label: "İstanbul (UTC+3)" },
  { value: "Europe/Berlin",       label: "Berlin / Orta Avrupa (UTC+1/+2)" },
  { value: "Europe/London",       label: "Londra (UTC+0/+1)" },
  { value: "Europe/Paris",        label: "Paris (UTC+1/+2)" },
  { value: "Europe/Moscow",       label: "Moskova (UTC+3)" },
  { value: "America/New_York",    label: "New York (UTC-5/-4)" },
  { value: "America/Chicago",     label: "Chicago (UTC-6/-5)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)" },
  { value: "America/Sao_Paulo",   label: "São Paulo (UTC-3)" },
  { value: "Africa/Cairo",        label: "Kahire (UTC+2)" },
  { value: "Asia/Dubai",          label: "Dubai (UTC+4)" },
  { value: "Asia/Kolkata",        label: "Hindistan (UTC+5:30)" },
  { value: "Asia/Tokyo",          label: "Tokyo (UTC+9)" },
  { value: "Asia/Shanghai",       label: "Çin (UTC+8)" },
  { value: "Australia/Sydney",    label: "Sidney (UTC+10/+11)" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    calorieTarget: "",
    proteinTarget: "",
    carbTarget: "",
    fatTarget: "",
    height: "",
    weight: "",
    stepTarget: "",
    waterTarget: "",
    sleepTarget: "",
    // Social
    username:      "",
    isPublic:      true,
    shareSteps:    true,
    shareCalories: true,
    shareWorkout:  true,
    shareStreak:   true,
    // Timezone
    timezone:      "Europe/Berlin",
  });
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  // ── Role ────────────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);

  // ── GDPR ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ── Push notifications ──────────────────────────────────────────────
  type NotifState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";
  const [notifState, setNotifState] = useState<NotifState>("loading");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Detect current notification state (supported / denied / subscribed / unsubscribed)
  const refreshNotifState = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotifState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setNotifState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setNotifState(sub ? "subscribed" : "unsubscribed");
    } catch {
      setNotifState("unsubscribed");
    }
  }, []);

  useEffect(() => {
    fetch("/api/user/goals")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name ?? "",
          calorieTarget: data.calorieTarget ?? "",
          proteinTarget: data.proteinTarget ?? "",
          carbTarget: data.carbTarget ?? "",
          fatTarget: data.fatTarget ?? "",
          height: data.height ?? "",
          weight: data.weight ?? "",
          stepTarget: data.stepTarget ?? "10000",
          waterTarget: data.waterTarget ?? "2.5",
          sleepTarget: data.sleepTarget ?? "8",
          username:      data.username      ?? "",
          isPublic:      data.isPublic      ?? true,
          shareSteps:    data.shareSteps    ?? true,
          shareCalories: data.shareCalories ?? true,
          shareWorkout:  data.shareWorkout  ?? true,
          shareStreak:   data.shareStreak   ?? true,
          timezone:      data.timezone      ?? "Europe/Berlin",
        });
        setLoading(false);
      });

    fetch("/api/user/token")
      .then((r) => r.json())
      .then((data) => setApiToken(data.token));

    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data?.role === "ADMIN"));

    refreshNotifState();
  }, [refreshNotifState]);

  function validateUsername(val: string): string | null {
    if (!val) return null; // empty is allowed (no username)
    if (val.length < 3)  return "En az 3 karakter";
    if (val.length > 20) return "En fazla 20 karakter";
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return "Sadece harf, rakam ve _ kullanilabilir";
    return null;
  }

  async function save() {
    const usernameErr = validateUsername(form.username);
    if (usernameErr) { setUsernameError(usernameErr); return; }
    setUsernameError(null);
    await fetch("/api/user/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generateToken() {
    setGeneratingToken(true);
    const res = await fetch("/api/user/token", { method: "POST" });
    const data = await res.json();
    setApiToken(data.token);
    setGeneratingToken(false);
  }

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setNotifState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotifState(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setNotifState("subscribed");
    } catch (err) {
      console.error("[push] subscribe failed", err);
      setNotifState("unsubscribed");
    }
  }

  async function disableNotifications() {
    setNotifState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setNotifState("unsubscribed");
    } catch {
      setNotifState("unsubscribed");
    }
  }

  async function sendTestNotification() {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data.sent > 0 ? "✓ Test bildirimi gönderildi!" : "Bildirim gönderilemedi.");
    } catch {
      setTestResult("Hata oluştu.");
    } finally {
      setTestSending(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  }

  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
    return buffer;
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/user/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fittrack-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await fetch("/api/user/account", { method: "DELETE" });
      await authClient.signOut();
      router.push("/login");
    } catch {
      setDeleting(false);
    }
  }

  async function copyToken() {
    if (!apiToken) return;
    await navigator.clipboard.writeText(apiToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  if (loading) return <main className="p-6 text-zinc-400">Loading...</main>;

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-zinc-400">Set your targets and body info</p>
      </div>

      <div className="space-y-4">
        {/* Personal */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Personal Info</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Name</label>
              <input value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                placeholder="Your name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input type="number" value={form.height}
                  onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="175" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input type="number" step="0.1" value={form.weight}
                  onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder="75" />
              </div>
            </div>
          </div>
        </div>

        {/* Nutrition */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Nutrition Targets</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "calorieTarget", label: "Calories", placeholder: "2400", unit: "kcal" },
              { key: "proteinTarget", label: "Protein", placeholder: "150", unit: "g" },
              { key: "carbTarget", label: "Carbs", placeholder: "200", unit: "g" },
              { key: "fatTarget", label: "Fat", placeholder: "70", unit: "g" },
            ].map(({ key, label, placeholder, unit }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-zinc-400">{label} ({unit})</label>
                <input type="number" value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>

        {/* Daily targets */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Daily Targets</h2>
          <div className="space-y-3">
            {[
              { key: "stepTarget", label: "Step Goal", placeholder: "10000", unit: "steps" },
              { key: "waterTarget", label: "Water Goal", placeholder: "2.5", unit: "L" },
              { key: "sleepTarget", label: "Sleep Goal", placeholder: "8", unit: "hrs" },
            ].map(({ key, label, placeholder, unit }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-zinc-400">{label} ({unit})</label>
                <input type="number" step="0.1" value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                  placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-300">Saat Dilimi</h2>
          <p className="mb-3 text-xs text-zinc-500">Sabah bildirimleri bu saate gore gonderilir.</p>
          <select
            value={form.timezone ?? "Europe/Berlin"}
            onChange={(e) => setForm(p => ({ ...p, timezone: e.target.value }))}
            className="w-full rounded-xl bg-zinc-800 p-3 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-600"
          >
            <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
            <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
            <option value="Europe/London">Europe/London (UTC+0/+1)</option>
            <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
            <option value="Europe/Rome">Europe/Rome (UTC+1/+2)</option>
            <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
            <option value="Europe/Athens">Europe/Athens (UTC+2/+3)</option>
            <option value="America/New_York">America/New_York (UTC-5/-4)</option>
            <option value="America/Chicago">America/Chicago (UTC-6/-5)</option>
            <option value="America/Denver">America/Denver (UTC-7/-6)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
            <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
            <option value="Africa/Cairo">Africa/Cairo (UTC+2)</option>
            <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
            <option value="Asia/Karachi">Asia/Karachi (UTC+5)</option>
            <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
            <option value="Asia/Dhaka">Asia/Dhaka (UTC+6)</option>
            <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
            <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
            <option value="Australia/Sydney">Australia/Sydney (UTC+10/+11)</option>
            <option value="Pacific/Auckland">Pacific/Auckland (UTC+12/+13)</option>
          </select>
        </div>

        {/* Social Profile */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Sosyal Profil</h2>
            {form.username && (
              <Link
                href={`/social/${form.username}`}
                className="text-xs text-green-400 hover:text-green-300 transition-colors"
              >
                Profilimi Gör →
              </Link>
            )}
          </div>

          {/* Username */}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-zinc-400">Kullanici adi</label>
            <div className="flex items-center rounded-xl bg-zinc-800 px-3 py-2 focus-within:ring-1 focus-within:ring-zinc-600">
              <span className="mr-1 text-sm text-zinc-500">@</span>
              <input
                value={form.username}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
                  setForm((p) => ({ ...p, username: v }));
                  setUsernameError(validateUsername(v));
                }}
                placeholder="kullanici_adi"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            {usernameError && (
              <p className="mt-1 text-xs text-red-400">{usernameError}</p>
            )}
            <p className="mt-1 text-[11px] text-zinc-600">Min 3, max 20 karakter. Harf, rakam ve _</p>
          </div>

          {/* Privacy toggles */}
          <div className="space-y-2">
            {[
              { key: "isPublic",      label: "Profilim herkese acik" },
              { key: "shareSteps",    label: "Adim sayimi paylasın" },
              { key: "shareCalories", label: "Kalori bilgimi paylasın" },
              { key: "shareWorkout",  label: "Antrenman bilgimi paylasın" },
              { key: "shareStreak",   label: "Streak bilgimi paylasın" },
            ].map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl bg-zinc-800/50 px-3 py-2">
                <span className="text-xs text-zinc-300">{label}</span>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    form[key as keyof typeof form] ? "bg-green-600" : "bg-zinc-700"
                  }`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form[key as keyof typeof form] ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
            ))}
          </div>
        </div>

        <button onClick={save}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-700">
          {saved ? "Saved ✓" : "Save Profile"}
        </button>

        {/* Push Notifications */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-300">🔔 Bildirimler</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Günlük hatırlatıcılar: öğün logu ve antrenman takibi
          </p>

          {notifState === "unsupported" && (
            <p className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-500">
              Bu tarayıcı push bildirimlerini desteklemiyor.
            </p>
          )}

          {notifState === "denied" && (
            <div className="rounded-xl bg-red-950/40 px-3 py-2 text-xs text-red-400">
              Bildirim izni engellendi. Tarayıcı ayarlarından fittrack için izin ver.
            </div>
          )}

          {notifState === "loading" && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-green-500" />
              Kontrol ediliyor…
            </div>
          )}

          {(notifState === "unsubscribed" || notifState === "subscribed") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-200">
                    {notifState === "subscribed" ? "✅ Bildirimler açık" : "Bildirimler kapalı"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {notifState === "subscribed"
                      ? "Her gün 20:00'de öğün & antrenman hatırlatıcısı"
                      : "Aç ve günlük hatırlatıcılar al"}
                  </p>
                </div>
                <button
                  onClick={notifState === "subscribed" ? disableNotifications : enableNotifications}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                    notifState === "subscribed"
                      ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      : "bg-green-600 text-white hover:bg-green-500"
                  }`}
                >
                  {notifState === "subscribed" ? "Kapat" : "Bildirimleri Aç"}
                </button>
              </div>

              {notifState === "subscribed" && (
                <div className="space-y-1">
                  {isAdmin && (
                    <>
                  <button
                    onClick={sendTestNotification}
                    disabled={testSending}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    {testSending ? "Gönderiliyor…" : "🔔 Test Bildirimi Gönder"}
                  </button>
                  {testResult && (
                    <p className="text-center text-xs text-green-400">{testResult}</p>
                  )}
                    </>
                  )}
                </div>
              )}

              {notifState === "unsubscribed" && (
                <div className="rounded-xl bg-zinc-800/50 px-3 py-2">
                  <p className="mb-1.5 text-[11px] font-medium text-zinc-300">Günlük hatırlatıcılar:</p>
                  <ul className="space-y-0.5 text-[11px] text-zinc-500">
                    <li>🍽️ Öğün logu olmayan günler saat 20:00&apos;de</li>
                    <li>💪 3 gündür antrenman logu yoksa</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* API Token */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-300">📱 iPhone Steps Sync</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Auto-sync your steps from iPhone Health every 3 hours
          </p>

          {apiToken ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-800 p-3">
                <p className="mb-1 text-xs text-zinc-500">Your API Token</p>
                <p className="break-all font-mono text-xs text-zinc-300">{apiToken}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyToken}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                    tokenCopied ? "bg-green-800 text-green-300" : "bg-zinc-800 hover:bg-zinc-700"
                  }`}>
                  {tokenCopied ? "Copied ✓" : "Copy Token"}
                </button>
                <button onClick={generateToken} disabled={generatingToken}
                  className="rounded-xl bg-zinc-800 px-4 text-sm hover:bg-zinc-700 disabled:opacity-50">
                  Refresh
                </button>
              </div>
              <div className="rounded-xl bg-zinc-800/50 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">Setup Instructions:</p>
                <ol className="space-y-1 text-xs text-zinc-500">
                  <li>1. Copy your token above</li>
                  <li>2. Open iPhone Shortcuts app</li>
                  <li>3. Create new shortcut with automation</li>
                  <li>4. Set trigger: Time of Day, every 3 hours</li>
                  <li>5. Add action: Get Health Sample (Steps)</li>
                  <li>6. Add action: Get Contents of URL</li>
                  <li>7. URL: <span className="text-zinc-300 break-all">https://fittrack-ten-umber.vercel.app/api/sync/steps</span></li>
                  <li>8. Method: POST, Body: JSON</li>
                  <li>9. Add header: Authorization: Bearer YOUR_TOKEN</li>
                  <li>10. Body: {`{"steps": [Health Sample Value]}`}</li>
                </ol>
              </div>
            </div>
          ) : (
            <button onClick={generateToken} disabled={generatingToken}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {generatingToken ? "Generating..." : "Generate API Token"}
            </button>
          )}
        </div>
        {/* GDPR — Data & Privacy */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-1 text-sm font-semibold text-zinc-300">🔒 Veri & Gizlilik</h2>
          <p className="mb-3 text-xs text-zinc-500">
            GDPR kapsamında verilerinizi indirebilir veya hesabınızı kalıcı olarak silebilirsiniz.{" "}
            <Link href="/privacy" className="text-green-400 hover:underline">Gizlilik Politikası →</Link>
          </p>
          <div className="flex gap-2">
            <button
              onClick={exportData}
              disabled={exporting}
              className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? "İndiriliyor…" : "⬇ Verilerimi İndir"}
            </button>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); }}
              className="flex-1 rounded-xl bg-red-950/60 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-900/60 border border-red-900/40 transition-colors"
            >
              🗑 Hesabımı Sil
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-900/50 bg-zinc-900 p-6">
            <h2 className="mb-1 text-base font-bold text-white">Hesabı Sil</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Bu işlem <span className="font-semibold text-red-400">geri alınamaz.</span>{" "}
              Tüm verileriniz (antrenmanlar, öğünler, ölçümler) kalıcı olarak silinir.
            </p>
            <p className="mb-2 text-xs text-zinc-500">
              Onaylamak için <span className="font-mono text-zinc-300">SİL</span> yazın:
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="SİL"
              className="mb-4 w-full rounded-xl bg-zinc-800 p-3 text-sm outline-none focus:ring-1 focus:ring-red-800 placeholder:text-zinc-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium hover:bg-zinc-700"
              >
                İptal
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== "SİL" || deleting}
                className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {deleting ? "Siliniyor…" : "Hesabı Kalıcı Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}