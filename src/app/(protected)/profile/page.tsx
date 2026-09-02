"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { METRICS } from "@/lib/metrics";

const TIMEZONE_OPTIONS = [
  "Europe/Istanbul", "Europe/Berlin", "Europe/London", "Europe/Paris",
  "Europe/Rome", "Europe/Moscow", "Europe/Athens", "America/New_York",
  "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
  "Africa/Cairo", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
  "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

function extractTotpSecret(totpUri: string): string {
  try {
    const query = totpUri.split("?")[1] ?? "";
    return new URLSearchParams(query).get("secret") ?? "";
  } catch {
    return "";
  }
}

function validateUsername(val: string): string | null {
  if (!val) return null; // empty is allowed (no username)
  if (val.length < 3) return "At least 3 characters";
  if (val.length > 20) return "En fazla 20 karakter";
  if (!/^[a-zA-Z0-9_]+$/.test(val)) return "Only letters, numbers and _ are allowed";
  return null;
}

// ── Collapsible settings section ──
function Section({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-zinc-800/40"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-base">{icon}</span>}
          <div>
            <p className="text-sm font-semibold text-zinc-200">{title}</p>
            {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="border-t border-zinc-800 p-4">{children}</div>}
    </div>
  );
}

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
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

  // ── Security: 2FA + Passkeys ────────────────────────────────────────
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<{ id: string; name?: string | null; createdAt?: string | Date | null }[]>([]);
  const [twoFactorStep, setTwoFactorStep] = useState<"idle" | "password" | "verify">("idle");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const refreshPasskeys = useCallback(async () => {
    const res = await fetch("/api/auth/passkey/list-user-passkeys");
    if (!res.ok) return;
    setPasskeys(await res.json());
  }, []);

  async function startTwoFactorEnroll() {
    setSecurityError("");
    if (!twoFactorPassword) { setTwoFactorStep("password"); return; }
    setSecurityBusy(true);
    const { data, error } = await authClient.twoFactor.enable({ password: twoFactorPassword });
    setSecurityBusy(false);
    if (error) { setSecurityError(error.message ?? "Failed to start 2FA setup"); return; }
    setTotpUri(data?.totpURI ?? "");
    setBackupCodes(data?.backupCodes ?? []);
    setTwoFactorStep("verify");
  }

  async function confirmTwoFactor() {
    setSecurityError("");
    setSecurityBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: twoFactorCode });
    setSecurityBusy(false);
    if (error) { setSecurityError(error.message ?? "Invalid code"); return; }
    setTwoFactorEnabled(true);
    setTwoFactorStep("idle");
    setTwoFactorPassword("");
    setTwoFactorCode("");
  }

  async function disableTwoFactor() {
    const password = prompt("Enter your password to disable 2FA:");
    if (!password) return;
    setSecurityBusy(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setSecurityBusy(false);
    if (error) { setSecurityError(error.message ?? "Failed to disable 2FA"); return; }
    setTwoFactorEnabled(false);
  }

  async function addPasskey() {
    setSecurityError("");
    setAddingPasskey(true);
    const { error } = await authClient.passkey.addPasskey({
      name: typeof navigator !== "undefined" ? navigator.userAgent.split(" ")[0] : "My device",
    });
    setAddingPasskey(false);
    if (error) { setSecurityError(error.message ?? "Failed to add passkey"); return; }
    refreshPasskeys();
  }

  async function removePasskey(id: string) {
    await fetch("/api/auth/passkey/delete-passkey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refreshPasskeys();
  }

  // ── Push notifications ──────────────────────────────────────────────
  type NotifState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";
  const [notifState, setNotifState] = useState<NotifState>("loading");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

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
      .then((data) => {
        setIsAdmin(data?.role === "ADMIN");
        setTwoFactorEnabled(Boolean(data?.twoFactorEnabled));
      });

    refreshPasskeys();
    queueMicrotask(() => void refreshNotifState());
  }, [refreshNotifState, refreshPasskeys]);

  useEffect(() => {
    if (loading || !hasChanges || validateUsername(form.username)) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      setSaveError(false);
      try {
        const res = await fetch("/api/user/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Profile could not be saved");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form, hasChanges, loading]);

  function updateForm(patch: Partial<typeof form>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setHasChanges(true);
    setSaved(false);
    setSaveError(false);
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
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
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
      setTestResult(data.sent > 0 ? "✓ Test notification sent!" : "Could not send notification.");
    } catch {
      setTestResult("Something went wrong.");
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

  const inputClass =
    "w-full rounded-xl bg-zinc-800 p-3 outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-600";

  // Merged targets (nutrition + daily), each tinted with its metric color.
  const targets = [
    { key: "calorieTarget", label: "Calories", placeholder: "2400", unit: "kcal", color: METRICS.calories.hex, step: "1" },
    { key: "proteinTarget", label: "Protein", placeholder: "150", unit: "g", color: METRICS.protein.hex, step: "1" },
    { key: "carbTarget", label: "Carbs", placeholder: "200", unit: "g", color: METRICS.carbs.hex, step: "1" },
    { key: "fatTarget", label: "Fat", placeholder: "70", unit: "g", color: METRICS.fat.hex, step: "1" },
    { key: "stepTarget", label: "Steps", placeholder: "10000", unit: "steps", color: METRICS.steps.hex, step: "1" },
    { key: "waterTarget", label: "Water", placeholder: "2.5", unit: "L", color: METRICS.water.hex, step: "0.1" },
    { key: "sleepTarget", label: "Sleep", placeholder: "8", unit: "saat", color: METRICS.sleep.hex, step: "0.5" },
  ] as const;

  return (
    <main className="mx-auto max-w-lg p-4 pb-24">
      <div className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-green-400/80">Ayarlar</p>
        <h1 className="mt-1 text-2xl font-bold">Profile</h1>
        <p className="text-sm text-zinc-400">Manage your targets and account settings</p>
      </div>

      {/* Save status — sticky-ish indicator */}
      {(saving || saved || saveError) && (
        <p className={`mb-3 text-right text-xs ${saveError ? "text-red-400" : saved ? "text-green-400" : "text-zinc-500"}`} aria-live="polite">
          {saveError ? "Kaydedilemedi" : saved ? "Kaydedildi ✓" : "Kaydediliyor…"}
        </p>
      )}

      <div className="space-y-3">
        {/* 1. Personal */}
        <Section title="Personal Info" subtitle="Name, height, weight" icon="👤" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Name</label>
              <input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} className={inputClass} placeholder="Your name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Height (cm)</label>
                <input type="number" value={form.height} onChange={(e) => updateForm({ height: e.target.value })} className={inputClass} placeholder="175" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Weight (kg)</label>
                <input type="number" step="0.1" value={form.weight} onChange={(e) => updateForm({ weight: e.target.value })} className={inputClass} placeholder="75" />
              </div>
            </div>
          </div>
        </Section>

        {/* 2. Targets (merged nutrition + daily) */}
        <Section title="Targets" subtitle="Nutrition and daily targets" icon="🎯" defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            {targets.map(({ key, label, placeholder, unit, color, step }) => (
              <div key={key}>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {label} ({unit})
                </label>
                <input
                  type="number"
                  step={step}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => updateForm({ [key]: e.target.value })}
                  className={inputClass}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* 3. Timezone */}
        <Section title="Timezone" subtitle="Notification timing" icon="🕑">
          <p className="mb-3 text-xs text-zinc-500">Morning notifications follow this timezone.</p>
          <select
            value={form.timezone ?? "Europe/Berlin"}
            onChange={(e) => updateForm({ timezone: e.target.value })}
            className="w-full rounded-xl bg-zinc-800 p-3 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-600"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Section>

        {/* 4. Social profile */}
        <Section title="Social Profile" subtitle="Username and privacy" icon="🌐">
          {form.username && (
            <div className="mb-3 text-right">
              <Link href={`/social/${form.username}`} className="text-xs text-green-400 transition-colors hover:text-green-300">
                View My Profile →
              </Link>
            </div>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-zinc-400">Username</label>
            <div className="flex items-center rounded-xl bg-zinc-800 px-3 py-2 focus-within:ring-1 focus-within:ring-zinc-600">
              <span className="mr-1 text-sm text-zinc-500">@</span>
              <input
                value={form.username}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
                  updateForm({ username: v });
                  setUsernameError(validateUsername(v));
                }}
                placeholder="username"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            {usernameError && <p className="mt-1 text-xs text-red-400">{usernameError}</p>}
            <p className="mt-1 text-[11px] text-zinc-600">Min 3, max 20 characters. Letters, numbers and _</p>
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Gizlilik</p>
          <div className="space-y-2">
            {[
              { key: "isPublic",      label: "My profile is public" },
              { key: "shareSteps",    label: "Share my step count" },
              { key: "shareCalories", label: "Share my calories" },
              { key: "shareWorkout",  label: "Share my workouts" },
              { key: "shareStreak",   label: "Share my streak" },
            ].map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl bg-zinc-800/50 px-3 py-2">
                <span className="text-xs text-zinc-300">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!form[key as keyof typeof form]}
                  aria-label={label}
                  onClick={() => updateForm({ [key]: !form[key as keyof typeof form] })}
                  className={`relative h-5 w-9 rounded-full transition-colors ${form[key as keyof typeof form] ? "bg-green-600" : "bg-zinc-700"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form[key as keyof typeof form] ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </label>
            ))}
          </div>
        </Section>

        {/* 4b. Security: 2FA + Passkeys */}
        <Section title="Security" subtitle="Passkeys and two-factor login" icon="🛡️">
          <div className="space-y-4">
            {/* Passkeys */}
            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-300">Passkeys (Face ID / Touch ID / Windows Hello)</p>
              {passkeys.length === 0 && (
                <p className="mb-2 text-[11px] text-zinc-500">No passkeys registered yet.</p>
              )}
              <div className="mb-2 space-y-1.5">
                {passkeys.map((pk) => (
                  <div key={pk.id} className="flex items-center justify-between rounded-xl bg-zinc-800/50 px-3 py-2">
                    <span className="text-xs text-zinc-300">{pk.name || "Unnamed device"}</span>
                    <button
                      onClick={() => removePasskey(pk.id)}
                      className="text-[11px] font-semibold text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addPasskey}
                disabled={addingPasskey}
                className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {addingPasskey ? "Waiting for device…" : "+ Add a Passkey"}
              </button>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* 2FA */}
            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-300">Two-Factor Authentication</p>

              {twoFactorEnabled && twoFactorStep === "idle" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">✅ 2FA is enabled</p>
                  <button
                    onClick={disableTwoFactor}
                    disabled={securityBusy}
                    className="rounded-xl bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/60"
                  >
                    Disable
                  </button>
                </div>
              )}

              {!twoFactorEnabled && twoFactorStep === "idle" && (
                <button
                  onClick={() => setTwoFactorStep("password")}
                  className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                  Enable 2FA
                </button>
              )}

              {twoFactorStep === "password" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-zinc-500">Confirm your password to start setup:</p>
                  <input
                    type="password"
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-xl bg-zinc-800 p-2.5 text-xs outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setTwoFactorStep("idle"); setTwoFactorPassword(""); }}
                      className="flex-1 rounded-xl bg-zinc-800 py-2 text-xs font-medium hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={startTwoFactorEnroll}
                      disabled={securityBusy || !twoFactorPassword}
                      className="flex-1 rounded-xl bg-green-600 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      {securityBusy ? "..." : "Continue"}
                    </button>
                  </div>
                </div>
              )}

              {twoFactorStep === "verify" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-zinc-500">Scan this QR with your authenticator app (Google Authenticator, Authy, etc.):</p>
                  {totpUri && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                      alt="2FA QR code"
                      className="mx-auto rounded-xl bg-white p-2"
                      width={180}
                      height={180}
                    />
                  )}
                  {totpUri && (
                    <div className="rounded-xl bg-zinc-800/50 p-2.5">
                      <p className="mb-1 text-[10px] font-semibold text-zinc-400">
                        Can&apos;t scan? Enter this code manually in your authenticator app:
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 break-all font-mono text-xs text-zinc-200">
                          {extractTotpSecret(totpUri).match(/.{1,4}/g)?.join(" ") ?? extractTotpSecret(totpUri)}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(extractTotpSecret(totpUri));
                            setSecretCopied(true);
                            setTimeout(() => setSecretCopied(false), 1500);
                          }}
                          className="shrink-0 rounded-lg bg-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-600"
                        >
                          {secretCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                  {backupCodes.length > 0 && (
                    <div className="rounded-xl bg-zinc-800/50 p-2">
                      <p className="mb-1 text-[10px] font-semibold text-zinc-400">Backup codes (save these somewhere safe):</p>
                      <p className="break-all font-mono text-[10px] text-zinc-300">{backupCodes.join("  ")}</p>
                    </div>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-xl bg-zinc-800 p-2.5 text-center text-sm tracking-widest outline-none focus:ring-1 focus:ring-zinc-600"
                  />
                  <button
                    onClick={confirmTwoFactor}
                    disabled={securityBusy || twoFactorCode.length < 6}
                    className="w-full rounded-xl bg-green-600 py-2.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {securityBusy ? "Verifying…" : "Confirm & Enable"}
                  </button>
                </div>
              )}

              {securityError && <p className="mt-2 text-xs text-red-400">{securityError}</p>}
            </div>
          </div>
        </Section>

        {/* 5. Notifications */}
        <Section title="Notifications" subtitle="Daily reminders" icon="🔔">
          {notifState === "unsupported" && (
            <p className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-500">This browser doesn't support push notifications.</p>
          )}
          {notifState === "denied" && (
            <div className="rounded-xl bg-red-950/40 px-3 py-2 text-xs text-red-400">Notification permission blocked. Allow FitTrack in your browser settings.</div>
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
                    {notifState === "subscribed" ? "✅ Notifications on" : "Notifications off"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {notifState === "subscribed" ? "Daily meal & workout reminder at 20:00" : "Turn on to get daily reminders"}
                  </p>
                </div>
                <button
                  onClick={notifState === "subscribed" ? disableNotifications : enableNotifications}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                    notifState === "subscribed" ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600" : "bg-green-600 text-white hover:bg-green-500"
                  }`}
                >
                  {notifState === "subscribed" ? "Turn Off" : "Turn On Notifications"}
                </button>
              </div>

              {notifState === "subscribed" && isAdmin && (
                <div className="space-y-1">
                  <button
                    onClick={sendTestNotification}
                    disabled={testSending}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {testSending ? "Sending…" : "🔔 Send Test Notification"}
                  </button>
                  {testResult && <p className="text-center text-xs text-green-400">{testResult}</p>}
                </div>
              )}

              {notifState === "unsubscribed" && (
                <div className="rounded-xl bg-zinc-800/50 px-3 py-2">
                  <p className="mb-1.5 text-[11px] font-medium text-zinc-300">Daily reminders:</p>
                  <ul className="space-y-0.5 text-[11px] text-zinc-500">
                    <li>🍽️ At 20:00 on days with no meal log</li>
                    <li>💪 When no workout is logged for 3 days</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 6. Connected devices — iPhone Steps Sync */}
        <Section title="Connected Devices" subtitle="iPhone step sync" icon="📱">
          <p className="mb-3 text-xs text-zinc-500">Automatically sync your steps from iPhone Health every 3 hours.</p>
          {apiToken ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-800 p-3">
                <p className="mb-1 text-xs text-zinc-500">API Token</p>
                <p className="break-all font-mono text-xs text-zinc-300">{apiToken}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyToken}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${tokenCopied ? "bg-green-800 text-green-300" : "bg-zinc-800 hover:bg-zinc-700"}`}
                >
                  {tokenCopied ? "Copied ✓" : "Copy Token"}
                </button>
                <button onClick={generateToken} disabled={generatingToken} className="rounded-xl bg-zinc-800 px-4 text-sm hover:bg-zinc-700 disabled:opacity-50">
                  Yenile
                </button>
              </div>
              {/* Setup steps tucked behind a disclosure to keep the section light */}
              <details className="rounded-xl bg-zinc-800/50 p-3">
                <summary className="cursor-pointer text-xs font-medium text-zinc-300">Setup steps (Shortcuts)</summary>
                <ol className="mt-2 space-y-1 text-xs text-zinc-500">
                  <li>1. Copy the token above</li>
                  <li>2. Open the iPhone Shortcuts app</li>
                  <li>3. Create a new automation</li>
                  <li>4. Trigger: Time of Day, every 3 hours</li>
                  <li>5. Action: Get Health Sample (Steps)</li>
                  <li>6. Action: Get Contents of URL</li>
                  <li>7. URL: <span className="break-all text-zinc-300">https://fittrack-ten-umber.vercel.app/api/sync/steps</span></li>
                  <li>8. Method: POST, Body: JSON</li>
                  <li>9. Header: Authorization: Bearer YOUR_TOKEN</li>
                  <li>10. Body: {`{"steps": [Health Sample Value]}`}</li>
                </ol>
              </details>
            </div>
          ) : (
            <button onClick={generateToken} disabled={generatingToken} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {generatingToken ? "Generating..." : "Generate API Token"}
            </button>
          )}
        </Section>

        {/* 7. Data & privacy (danger zone) */}
        <Section title="Data & Privacy" subtitle="Export or delete account" icon="🔒">
          <p className="mb-3 text-xs text-zinc-500">
            Under GDPR you can download your data or permanently delete your account.{" "}
            <Link href="/privacy" className="text-green-400 hover:underline">Privacy Policy →</Link>
          </p>
          <div className="flex gap-2">
            <button
              onClick={exportData}
              disabled={exporting}
              className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {exporting ? "Downloading…" : "⬇ Download My Data"}
            </button>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); }}
              className="flex-1 rounded-xl border border-red-900/40 bg-red-950/60 py-2.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60"
            >
              🗑 Delete My Account
            </button>
          </div>
        </Section>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-900/50 bg-zinc-900 p-6">
            <h2 className="mb-1 text-base font-bold text-white">Delete Account</h2>
            <p className="mb-4 text-sm text-zinc-400">
              This action <span className="font-semibold text-red-400">cannot be undone.</span>{" "}
              All your data (workouts, meals, measurements) will be permanently deleted.
            </p>
            <p className="mb-2 text-xs text-zinc-500">
              Type <span className="font-mono text-zinc-300">DELETE</span> to confirm:
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="mb-4 w-full rounded-xl bg-zinc-800 p-3 text-sm outline-none focus:ring-1 focus:ring-red-800 placeholder:text-zinc-600"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium hover:bg-zinc-700">
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="flex-1 rounded-xl bg-red-700 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Permanently Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
