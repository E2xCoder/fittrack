"use client";

import { useState } from "react";
import Link from "next/link";

const TR = () => (
  <div className="space-y-8 text-sm text-zinc-300">
    <section>
      <h2 className="mb-2 text-base font-bold text-white">FitTrack Nedir?</h2>
      <p className="text-zinc-400">
        FitTrack, beslenme takibi, antrenman günlüğü ve vücut ölçümlerini kaydetmenize
        yarayan kişisel bir sağlık uygulamasıdır. Hizmet Berlin, Almanya merkezli olarak
        sunulmakta olup Avrupa Birliği Genel Veri Koruma Yönetmeliği (GDPR / DSGVO) kapsamında
        faaliyet göstermektedir.
      </p>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">Hangi Veriler Toplanıyor?</h2>
      <ul className="space-y-2 text-zinc-400">
        <li><span className="font-medium text-zinc-200">Hesap bilgileri —</span> ad, e-posta adresi, şifre özeti (hash).</li>
        <li><span className="font-medium text-zinc-200">Sağlık verileri —</span> kilo, boy, vücut yağ oranı, beden ölçüleri, günlük adım ve su miktarı, uyku süresi.</li>
        <li><span className="font-medium text-zinc-200">Beslenme verileri —</span> öğün logları, kalori ve makro besin değerleri.</li>
        <li><span className="font-medium text-zinc-200">Antrenman verileri —</span> egzersiz adı, set, tekrar, ağırlık, RPE değerleri.</li>
        <li><span className="font-medium text-zinc-200">Cihaz bilgileri —</span> push bildirimleri için tarayıcı abonelik anahtarları (isteğe bağlı).</li>
        <li><span className="font-medium text-zinc-200">API token —</span> iPhone adım senkronizasyonu için oluşturulan token (isteğe bağlı).</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">Veriler Nasıl Kullanılıyor?</h2>
      <ul className="space-y-2 text-zinc-400">
        <li>Yalnızca size ait ilerleme istatistiklerini hesaplamak ve görselleştirmek için.</li>
        <li>Günlük hatırlatıcı bildirimleri göndermek için (yalnızca izin verirseniz).</li>
        <li>Verileriniz üçüncü taraflarla <span className="text-white font-medium">asla paylaşılmaz</span>, reklam veya profilleme amacıyla kullanılmaz.</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">Ne Kadar Saklanıyor?</h2>
      <p className="text-zinc-400">
        Verileriniz, hesabınız aktif olduğu sürece saklanır. Hesabınızı sildiğinizde tüm
        kişisel verileriniz kalıcı olarak ve geri alınamaz şekilde silinir. Yedek kopyalar
        en fazla 30 gün içinde sistemden kaldırılır.
      </p>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">Haklarınız (GDPR Madde 15-22)</h2>
      <ul className="space-y-2 text-zinc-400">
        <li><span className="font-medium text-zinc-200">Erişim hakkı —</span> Profile → "Verilerimi İndir" butonu ile tüm verilerinizi JSON formatında indirebilirsiniz.</li>
        <li><span className="font-medium text-zinc-200">Silme hakkı (Unutulma) —</span> Profile → "Hesabımı Sil" ile hesabınızı ve tüm verilerinizi kalıcı olarak silebilirsiniz.</li>
        <li><span className="font-medium text-zinc-200">Taşınabilirlik hakkı —</span> İndirilen JSON dosyası makine tarafından okunabilir standarttadır.</li>
        <li><span className="font-medium text-zinc-200">İtiraz hakkı —</span> Herhangi bir veri işleme faaliyetine itiraz etmek için aşağıdaki e-posta adresine yazabilirsiniz.</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">İletişim</h2>
      <p className="text-zinc-400">
        Gizlilik ile ilgili sorularınız için:{" "}
        <a href="mailto:3mr3ren@gmail.com" className="text-green-400 hover:underline">
          3mr3ren@gmail.com
        </a>
        <br />
        Son güncelleme: Haziran 2026
      </p>
    </section>
  </div>
);

const EN = () => (
  <div className="space-y-8 text-sm text-zinc-300">
    <section>
      <h2 className="mb-2 text-base font-bold text-white">What is FitTrack?</h2>
      <p className="text-zinc-400">
        FitTrack is a personal health application for nutrition tracking, workout logging,
        and body measurement recording. The service is operated from Berlin, Germany and
        complies with the EU General Data Protection Regulation (GDPR / DSGVO).
      </p>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">What Data is Collected?</h2>
      <ul className="space-y-2 text-zinc-400">
        <li><span className="font-medium text-zinc-200">Account data —</span> name, email address, hashed password.</li>
        <li><span className="font-medium text-zinc-200">Health data —</span> weight, height, body fat %, body measurements, daily steps, water intake, sleep duration.</li>
        <li><span className="font-medium text-zinc-200">Nutrition data —</span> meal logs, calorie and macronutrient values.</li>
        <li><span className="font-medium text-zinc-200">Workout data —</span> exercise name, sets, reps, weight, RPE values.</li>
        <li><span className="font-medium text-zinc-200">Device data —</span> browser push subscription keys for notifications (optional).</li>
        <li><span className="font-medium text-zinc-200">API token —</span> token generated for iPhone step sync (optional).</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">How is the Data Used?</h2>
      <ul className="space-y-2 text-zinc-400">
        <li>Solely to calculate and visualize your personal progress statistics.</li>
        <li>To send daily reminder notifications (only if you opt in).</li>
        <li>Your data is <span className="text-white font-medium">never shared</span> with third parties and is never used for advertising or profiling.</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">How Long is Data Retained?</h2>
      <p className="text-zinc-400">
        Your data is retained for as long as your account is active. When you delete your
        account, all personal data is permanently and irreversibly deleted. Backup copies
        are purged within 30 days.
      </p>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">Your Rights (GDPR Art. 15–22)</h2>
      <ul className="space-y-2 text-zinc-400">
        <li><span className="font-medium text-zinc-200">Right of access —</span> Download all your data as JSON via Profile → "Download My Data".</li>
        <li><span className="font-medium text-zinc-200">Right to erasure —</span> Permanently delete your account and all data via Profile → "Delete Account".</li>
        <li><span className="font-medium text-zinc-200">Right to portability —</span> The downloaded JSON file is in a machine-readable standard format.</li>
        <li><span className="font-medium text-zinc-200">Right to object —</span> Contact us at the email below to object to any data processing.</li>
      </ul>
    </section>

    <section>
      <h2 className="mb-2 text-base font-bold text-white">Contact</h2>
      <p className="text-zinc-400">
        For privacy-related questions:{" "}
        <a href="mailto:3mr3ren@gmail.com" className="text-green-400 hover:underline">
          3mr3ren@gmail.com
        </a>
        <br />
        Last updated: June 2026
      </p>
    </section>
  </div>
);

export default function PrivacyPage() {
  const [lang, setLang] = useState<"tr" | "en">("en");

  return (
    <main className="mx-auto max-w-2xl p-6 pb-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="mb-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
            ← FitTrack
          </Link>
          <h1 className="text-2xl font-black text-white">
            {lang === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}
          </h1>
        </div>
        <div className="flex rounded-xl border border-zinc-700 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setLang("tr")}
            className={`px-3 py-2 transition-colors ${lang === "tr" ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
          >
            TR
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-2 transition-colors ${lang === "en" ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        {lang === "tr" ? <TR /> : <EN />}
      </div>
    </main>
  );
}
