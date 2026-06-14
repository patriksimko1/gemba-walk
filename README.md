# GEMBA Walk 📋

Mobilná webová aplikácia (PWA) na evidenciu a inšpekciu úloh z obhliadky výroby.
Bez build kroku — sú to obyčajné statické súbory. Nasadenie zadarmo na Vercel alebo GitHub Pages.

## Čo appka vie
- ✅ Zoznam nálezov s vyhľadávaním a filtrami (stav, lokalita, priorita)
- ✅ Vytváranie / úprava / mazanie záznamov
- ✅ Fotenie mobilom + automatická kompresia (max 1080 px, ~500 KB)
- ✅ Stav a priorita s farebným označením
- ✅ Dashboard: koláčový graf podľa kategórie, čiarový graf za 30 dní, súhrnné štatistiky
- ✅ Export do Excelu (.xlsx) a CSV
- ✅ Export jedného záznamu do PDF (aj s fotkami)
- ✅ E-mail report cez tlačidlo (otvorí mailového klienta s predvyplneným textom)
- ✅ Tímové zdieľanie cez Supabase (prihlásenie, spoločná databáza)
- ✅ Offline režim — keď vypadne signál, záznam sa uloží lokálne a odošle po pripojení
- ✅ Inštalovateľné na plochu telefónu (PWA)

---

## 1. Vytvor databázu (Supabase) — ~5 minút, zadarmo

1. Choď na **https://supabase.com** → **Start your project** → prihlás sa (cez GitHub).
2. **New project** → zadaj názov, heslo k databáze, región (napr. Frankfurt) → **Create**.
3. Počkaj ~2 min kým sa projekt vytvorí.
4. Vľavo otvor **SQL Editor** → **New query** → vlož celý obsah súboru **`schema.sql`** → **Run**.
   (Vytvorí tabuľku, pravidlá prístupu aj úložisko fotiek.)
5. Vľavo otvor **Project Settings → API** (alebo **Data API**) a skopíruj:
   - **Project URL** (napr. `https://abcdxyz.supabase.co`)
   - **anon public** kľúč (dlhý reťazec)

### Vypni potvrdzovanie e-mailu (pre rýchle interné použitie)
**Authentication → Sign In / Providers → Email** → vypni **Confirm email** → Save.
(Inak musí každý nový používateľ kliknúť na potvrdzovací odkaz v e-maile.)

---

## 2. Doplň kľúče do appky

Otvor súbor **`js/config.js`** a vlož skopírované hodnoty:

```js
window.GEMBA_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...tvoj-anon-kluc...",
  ...
};
```

> `anon public` kľúč je bezpečné vložiť — je verejný a chránený pravidlami RLS.
> **Nikdy** sem nedávaj `service_role` kľúč.

Lokality a kategórie si môžeš v tomto súbore upraviť podľa svojej fabriky.

---

## 3. Vyskúšaj lokálne (voliteľné)

Otvoriť `index.html` priamo (dvojklik) nemusí fungovať kvôli modulom.
Spusti malý server v priečinku projektu:

```bash
# ak máš Python
python3 -m http.server 8080
# potom otvor http://localhost:8080
```

---

## 4. Nasadenie zadarmo

### Možnosť A — Vercel (odporúčam)
1. Nahraj tento priečinok na GitHub (nový repozitár).
2. Choď na **https://vercel.com** → **Add New → Project** → vyber repozitár.
3. Framework Preset: **Other** (žiadny build). Output: koreň projektu.
4. **Deploy** → o chvíľu dostaneš verejnú adresu, napr. `https://gemba-walk.vercel.app`.
5. Túto adresu pošli kolegom — appka funguje na mobile aj desktope.

### Možnosť B — GitHub Pages
1. Repozitár na GitHube → **Settings → Pages**.
2. Source: **Deploy from a branch** → branch `main`, priečinok `/ (root)` → Save.
3. O chvíľu beží na `https://tvojmeno.github.io/nazov-repo/`.

---

## 5. Inštalácia na telefón (PWA)
Otvor adresu v mobile (Chrome/Safari) → menu prehliadača → **Pridať na plochu**.
Appka sa bude správať ako natívna — vlastná ikona, celá obrazovka, otvorí sa aj offline.

---

## Štruktúra súborov
```
gemba/
├── index.html              # vstupný bod
├── css/styles.css          # dizajn (tmavá industriálna téma)
├── js/
│   ├── config.js           # SEM vlož Supabase kľúče
│   └── app.js              # celá logika appky
├── icons/                  # ikony PWA
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # service worker (offline)
├── schema.sql              # nastavenie databázy (spusti v Supabase)
├── vercel.json             # konfigurácia pre Vercel
└── README.md
```

---

## Plánované rozšírenia (fáza 2)
- **SharePoint export** cez Microsoft Graph API — vyžaduje registráciu aplikácie v Azure
  (cez firemné IT). Pridáme, keď budú k dispozícii povolenia tenantu.
- **Automatické serverové e-maily** (Resend / SendGrid) namiesto `mailto`.

## Časté problémy
- **„Treba doplniť pripojenie"** → nevyplnené `config.js`.
- **Prihlásenie hlási „Email not confirmed"** → vypni Confirm email v Supabase (krok 1) alebo klikni na odkaz v e-maile.
- **Fotky sa nenahrajú** → over, že prebehol celý `schema.sql` (vytvára bucket `photos`).
- **Po zmene súborov sa appka neobnoví** → zvýš `VERSION` v `sw.js` a nasaď znova.
