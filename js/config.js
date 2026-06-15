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
 SITES: ["Koridor", "CR2", "CR1", "Bake Rolls", "Sklad Surovín", "Sklad Hotových výrobkov"],

  // Voliteľné: kategórie GEMBA
  TOPICS: ["5S", "Ergonómia", "Bezpečnosť", "Odpad", "Štandardizácia"]
};
