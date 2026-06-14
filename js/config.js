/* ============================================================
   KONFIGURÁCIA — vyplň údaje zo svojho Supabase projektu.
   Nájdeš ich v: Supabase → Project Settings → Data API / API Keys
   (alebo Project Settings → API)
   ------------------------------------------------------------
   POZOR: "anon public" kľúč je BEZPEČNÉ dať sem (je verejný a
   chránený pravidlami RLS). Nikdy sem nedávaj "service_role" kľúč!
   ============================================================ */

window.GEMBA_CONFIG = {
  // napr. "https://abcdxyz.supabase.co"
  SUPABASE_URL: "https://lshkuzehjqjuxdnzakld.supabase.co",

  // "anon public" API kľúč (dlhý reťazec)
  SUPABASE_ANON_KEY: "sb_publishable_K5QrXOPSCwu3t2MAvMy2Ug_YIxNknA-",

  // Voliteľné: zoznam lokalít v roletovom menu
  SITES: ["Location 1", "Location 2", "Location 3", "Location 4", "Location 5"],

  // Voliteľné: kategórie GEMBA
  TOPICS: ["5S", "Ergonómia", "Bezpečnosť", "Odpad", "Štandardizácia"]
};
