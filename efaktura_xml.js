// ═══════════════════════════════════════════════════════════════════════════
//  efaktura_xml.js — XML faktúry (ISDOC 6.0.1 a UBL Peppol BIS 3.0) z MODELU
//
//  Prečo samostatný modul (8. 10. 2026, krok 1 NAVRH_EFAKTURA_PREDPLATNE.md):
//  faktúru za predplatné vystavuje SERVER (edge `stripe-webhook`) a ide ako
//  PDF s vloženým ISDOC; od 1. 1. 2027 k nemu pribudne e-faktúra UBL cez
//  sieť Peppol. Appka má oba zapisovače (`isdocXml`,
//  `efakturaXml` v ezivnostnik.html), ale čítajú globálne `firmaData` a server
//  ich použiť nevie. Tu sú tie isté zapisovače nad ČISTÝM MODELOM — volajúci
//  rozhodne všetko (kategória DPH, druh dokladu, adresy) a modul len píše.
//
//  Pravidlá: žiadne importy, žiadna sieť, žiadne `window` — beží v prehliadači
//  aj v Deno (edge cez esm.sh/gh, ako faktura_pdf.js). Poradie prvkov a tvar
//  sú prenesené z appky; ZATIAĽ BEZ cudzej meny (druhý TaxTotal), odkazu
//  riadka na zálohu (`odkazRiadka`) a s kratším zoznamom krajín a bánk —
//  faktúra za predplatné ich nepotrebuje, appka ich doplní pri prechode na
//  modul. Zhodu stráži test_efaktura_xml
//  (výstup appky × výstup modulu nad tou istou faktúrou) a ISDOC aj XSD
//  výrobcu offline. Pomocné pravidlá (escape, rozklad adresy, Peppol
//  účastník, jednotky, krajina) sú KÓPIE pravidiel appky — zhodu na tých
//  istých vstupoch stráži ten istý test (kap. 16: dve kópie sa rozídu, ak
//  ich nič neporovnáva). Appka má raz prejsť na tento modul celá.
//
//  MODEL:
//  {
//    doklad: "380" | "381" | "383" | "388",   // faktúra, dobropis, ťarchopis, k platbe
//    cislo, uuid?, vystavene, dodanie, splatnost?, mena:"EUR",
//    poznamka?, buyerRef?, opravuje?,
//    dodavatel: { nazov, ico, dic, icdph, adresa, orVeta?, iban?, swift? },
//    odberatel: { nazov, ico, dic, icdph, adresa },
//    kategoria: { kod:"S"|"Z"|"O"|"AE"|"E"|"G"|"K", dovod?, bezSadzby?, bezIcDph? },
//    sadzba: 0.23,                              // zlomok, nie percentá
//    riadky: [{ nazov, mn, mj, cena, poznamka? }],
//    sumy: { bez, dph, spolu, prepaid? },       // prepaid = zaplatené vopred
//    platba: { kod:"30"|"48", vs?, iban?, zaplatene? }
//  }
//  `platba.kod` 30 = prevod (IBAN, VS, splatnosť), 48 = karta (zaplatené,
//  na úhradu 0 — žiadny IBAN ani výzva, lebo by zvádzali k druhej úhrade).
// ═══════════════════════════════════════════════════════════════════════════

export const PEPPOL_SCHEMA_SK = "0245";

// Od tohto dňa ide faktúra za predplatné NAVYŠE ako e-faktúra cez sieť Peppol
// (zák. 385/2025). PDF s vloženým ISDOC ostáva aj potom — e-faktúra len
// pribudne, to, čo funguje, sa neruší (Roman 8. 10. 2026). Jediné miesto
// dátumu pre appku aj server.
export const EFAKTURA_POVINNA_OD = "2027-01-01";
export function efakturaSietou(vystavene) {
  return String(vystavene || "").slice(0, 10) >= EFAKTURA_POVINNA_OD;
}

// Prevádzkovateľ = dodávateľ faktúr za predplatné. Z TOHTO objektu skladá UBL
// poštár (odoslanie sieťou) aj stripe-webhook (príloha e-mailu) — inak by
// doklad v sieti a v e-maile mohol niesť iného dodávateľa. Appka má kópiu
// `SAAS_DODAVATEL` a webhook `DODAVATEL` (kreslenie PDF); zhodu všetkých troch
// stráži test_efaktura_xml. Adresa je podľa RPO (Stromová 6150/10).
export const PREVADZKOVATEL = Object.freeze({
  nazov: "Ing. Roman Slivka - agile management",
  adresa: "Stromová 6150/10, 900 27 Bernolákovo",
  ico: "56649797",
  dic: "1122176264",
  icdph: "SK1122176264",
  iban: "SK59 5600 0000 0007 6001 1001",
});

// ── pomocné pravidlá (kópie appky, zhodu stráži test_efaktura_xml) ──────────
export function xmlEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function rozlozAdresu(a) {
  const mm = String(a || "").match(/^(.+?)\s+([\d/]+)[,\s]\s*(\d{3}\s?\d{2})\s+(.+)$/);
  if (mm) return { ulica: mm[1].trim(), cislo: mm[2].trim(), psc: mm[3].replace(/\s/g, ""), mesto: mm[4].trim() };
  return { ulica: String(a || ""), cislo: "", psc: "", mesto: "" };
}
export function peppolUcastnik(dic, icdph) {
  const cistit = (v) => String(v || "").replace(/\s/g, "");
  return (cistit(dic) || cistit(icdph)).replace(/^SK/i, "");
}
export function ublJednotka(mj) {
  const m = String(mj || "").toLowerCase();
  if (/člov|clov|deň|den|md|day/.test(m)) return "DAY";
  if (/hod|hour|hd/.test(m)) return "HUR";
  if (/ks|kus|pcs|piece/.test(m)) return "H87";
  if (/kg/.test(m)) return "KGM";
  if (/l\b|liter|litr/.test(m)) return "LTR";
  if (/m2|m²/.test(m)) return "MTK";
  if (/mesiac|month/.test(m)) return "MON";
  return "C62";
}
export function ublKrajina(icdph) {
  const m = String(icdph || "").trim().toUpperCase().match(/^([A-Z]{2})/);
  return m ? m[1] : "SK";
}
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
const n2 = (v) => (+v || 0).toFixed(2);
const datum = (d) => String(d || "").slice(0, 10);

// UUID pre ISDOC — z čísla dokladu, nie náhodný: to isté PDF vystavené znova
// (stiahnutie v appke, opakovaný e-mail) nesie ten istý doklad, nie nový.
export function uuidZTextu(t) {
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  const s = String(t || "");
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    h3 = Math.imul(h3 ^ c, 3266489917) >>> 0; h4 = Math.imul(h4 ^ c, 668265263) >>> 0;
  }
  const hx = [h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, "0")).join("");
  return `${hx.slice(0, 8)}-${hx.slice(8, 12)}-4${hx.slice(13, 16)}-${"89ab"[parseInt(hx[16], 16) & 3]}${hx.slice(17, 20)}-${hx.slice(20, 32)}`;
}

const ISDOC_KRAJINY = { SK: "Slovensko", CZ: "Česko", AT: "Rakúsko", DE: "Nemecko", HU: "Maďarsko", PL: "Poľsko" };
const ISDOC_BANKY = { "0200": "Všeobecná úverová banka", "0900": "Slovenská sporiteľňa", "1100": "Tatra banka",
  "1111": "UniCredit Bank", "5600": "Prima banka Slovensko", "6500": "365.bank", "7500": "Československá obchodná banka",
  "8330": "Fio banka", "8360": "mBank", "3100": "Prima banka Slovensko" };
function isdocUcet(iban) {
  const i = String(iban || "").replace(/\s/g, "").toUpperCase();
  const m = i.match(/^SK\d{2}(\d{4})(\d{6})(\d{10})$/);
  if (!m) return { id: "", kod: "", nazov: "" };
  const pred = m[2].replace(/^0+/, ""), cislo = m[3].replace(/^0+(?=\d)/, "");
  return { id: (pred ? pred + "-" : "") + cislo, kod: m[1], nazov: ISDOC_BANKY[m[1]] || "" };
}

// ── UBL Peppol BIS 3.0 ─────────────────────────────────────────────────────
// Vracia { xml, prijemca, odosielatel, chyba[] } ako `efakturaXml` v appke.
export function ublXml(M) {
  const ubl = xmlEsc;
  const D = M.dodavatel || {}, O = M.odberatel || {}, kat = M.kategoria || { kod: "S" };
  const MENA = M.mena || "EUR";
  const sadzba = +M.sadzba || 0, sadzbaPct = Math.round(sadzba * 100);
  const jeDobropis = M.doklad === "381";
  const KOREN = jeDobropis ? "CreditNote" : "Invoice";
  const katPercent = kat.bezSadzby ? "" : `
        <cbc:Percent>${sadzbaPct}</cbc:Percent>`;
  const katDovod = kat.dovod ? `
        <cbc:TaxExemptionReason>${ubl(kat.dovod)}</cbc:TaxExemptionReason>` : "";
  const dodIcDph = String(D.icdph || "").replace(/\s/g, "");
  const odbIcDph = O.icdph || "";
  const oa = rozlozAdresu(O.adresa), da = rozlozAdresu(D.adresa);
  const dodEndpoint = peppolUcastnik(D.dic, D.icdph);
  const odbEndpoint = peppolUcastnik(O.dic, O.icdph);
  const datVyst = datum(M.vystavene), datDod = datum(M.dodanie || M.vystavene);
  const datSplat = M.splatnost ? datum(M.splatnost) : "";
  let lineXml = "", lineTotal = 0;
  (M.riadky || []).forEach((p, i) => {
    const mn = +p.mn || 1, cena = +p.cena || 0, sumaR = r2(mn * cena); lineTotal = r2(lineTotal + sumaR);
    lineXml += `
  <cac:${KOREN}Line>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:${jeDobropis ? "Credited" : "Invoiced"}Quantity unitCode="${ublJednotka(p.mj)}">${mn}</cbc:${jeDobropis ? "Credited" : "Invoiced"}Quantity>
    <cbc:LineExtensionAmount currencyID="${MENA}">${sumaR.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${ubl(p.nazov || "Položka")}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${kat.kod}</cbc:ID>${katPercent}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${MENA}">${cena.toFixed(2)}</cbc:PriceAmount></cac:Price>
  </cac:${KOREN}Line>`;
  });
  const S = M.sumy || {};
  const bez = r2(lineTotal || S.bez), dph = S.dph != null ? r2(S.dph) : r2(bez * sadzba), spolu = r2(bez + dph);
  const karta = String((M.platba || {}).kod) === "48";
  // Karta: celá suma je zaplatená — PrepaidAmount = spolu, na úhradu 0
  // (BR-CO-16). Inak zaplatené vopred len to, čo model povie.
  const prepaid = karta ? spolu : r2(S.prepaid || 0);
  const splatit = r2(spolu - prepaid);
  // `!== 0`, nie `> 0`: dobropis zaplatený (vrátený) kartou má zápornú sumu
  // a teda aj záporné „zaplatené vopred“ — inak by na úhradu ostalo 0 bez
  // PrepaidAmount a doklad by porušil BR-CO-16 (úhrada = spolu − zaplatené).
  const prepaidXml = prepaid !== 0 ? "\n    <cbc:PrepaidAmount currencyID=\"" + MENA + "\">" + prepaid.toFixed(2) + "</cbc:PrepaidAmount>" : "";
  const odbKrajina = ublKrajina(odbIcDph);
  const dodavka = (kat.kod === "K") ? `
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${datDod}</cbc:ActualDeliveryDate>
    <cac:DeliveryLocation><cac:Address><cac:Country><cbc:IdentificationCode>${odbKrajina}</cbc:IdentificationCode></cac:Country></cac:Address></cac:DeliveryLocation>
  </cac:Delivery>` : "";
  const odkazNaPovodny = M.opravuje ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference><cbc:ID>${ubl(M.opravuje)}</cbc:ID></cac:InvoiceDocumentReference>
  </cac:BillingReference>` : "";
  const poznamka = String(M.poznamka || "").trim() ? `
  <cbc:Note>${ubl(String(M.poznamka).trim())}</cbc:Note>` : "";
  // Faktúra zaplatená kartou splatnosť nemá — DueDate sa vynechá (je
  // nepovinný, keď je na úhradu 0, BR-CO-25).
  const hlavicka = jeDobropis ? `
  <cbc:IssueDate>${datVyst}</cbc:IssueDate>
  <cbc:TaxPointDate>${datDod}</cbc:TaxPointDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>${poznamka}` : `
  <cbc:IssueDate>${datVyst}</cbc:IssueDate>${datSplat ? `
  <cbc:DueDate>${datSplat}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>${ubl(M.doklad || "380")}</cbc:InvoiceTypeCode>${poznamka}
  <cbc:TaxPointDate>${datDod}</cbc:TaxPointDate>`;
  const P = M.platba || {};
  const vs = String(P.vs || "").replace(/\s/g, "");
  const platbaXml = karta ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>48</cbc:PaymentMeansCode>${vs ? `
    <cbc:PaymentID>/VS${ubl(vs)}/</cbc:PaymentID>` : ""}
  </cac:PaymentMeans>` : `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>/VS${ubl(vs)}/</cbc:PaymentID>
    <cac:PayeeFinancialAccount><cbc:ID>${ubl(String(P.iban || D.iban || "").replace(/\s/g, ""))}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${KOREN} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${KOREN}-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${ubl(M.cislo || "")}</cbc:ID>${hlavicka}
  <cbc:DocumentCurrencyCode>${MENA}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${ubl(M.buyerRef || M.cislo || "")}</cbc:BuyerReference>${odkazNaPovodny}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${PEPPOL_SCHEMA_SK}">${ubl(dodEndpoint)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${ubl(D.nazov || "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${ubl((da.ulica + " " + da.cislo).trim())}</cbc:StreetName>
        <cbc:CityName>${ubl(da.mesto)}</cbc:CityName>
        <cbc:PostalZone>${ubl(da.psc)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${(dodIcDph && !kat.bezIcDph) ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${ubl(dodIcDph)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${ubl(D.nazov || "")}</cbc:RegistrationName>
        <cbc:CompanyID>${ubl(String(D.ico || "").replace(/\s/g, ""))}</cbc:CompanyID>${D.orVeta ? `
        <cbc:CompanyLegalForm>${ubl(D.orVeta)}</cbc:CompanyLegalForm>` : ""}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="${PEPPOL_SCHEMA_SK}">${ubl(odbEndpoint)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${ubl(O.nazov || "")}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${ubl((oa.ulica + " " + oa.cislo).trim())}</cbc:StreetName>
        <cbc:CityName>${ubl(oa.mesto)}</cbc:CityName>
        <cbc:PostalZone>${ubl(oa.psc)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${odbKrajina}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${(odbIcDph && !kat.bezIcDph) ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${ubl(String(odbIcDph).replace(/\s/g, ""))}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${ubl(O.nazov || "")}</cbc:RegistrationName>
        ${O.ico ? `<cbc:CompanyID>${ubl(String(O.ico).replace(/\s/g, ""))}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>${dodavka}${platbaXml}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${MENA}">${dph.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${MENA}">${bez.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${MENA}">${dph.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${kat.kod}</cbc:ID>${kat.bezSadzby ? "" : `
        <cbc:Percent>${sadzbaPct}</cbc:Percent>`}${katDovod}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${MENA}">${bez.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${MENA}">${bez.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${MENA}">${spolu.toFixed(2)}</cbc:TaxInclusiveAmount>${prepaidXml}
    <cbc:PayableAmount currencyID="${MENA}">${splatit.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lineXml}
</${KOREN}>`;
  const chyba = [];
  if (!dodEndpoint) chyba.push("DIČ dodávateľa");
  if (!odbEndpoint) chyba.push("DIČ alebo IČ DPH odberateľa");
  return { xml, cislo: String(M.cislo || ""), prijemca: odbEndpoint, odosielatel: dodEndpoint, chyba };
}

// ── ISDOC 6.0.1 ────────────────────────────────────────────────────────────
// Tvar ako `isdocXml` v appke; platba kartou = PaymentMeansCode 48 bez
// bankových údajov (Details je v XSD nepovinné), prevod = 42 s účtom.
const ISDOC_DRUH = { "380": "1", "381": "2", "383": "3", "388": "5" };
export function isdocXml(M) {
  const esc = xmlEsc;
  const D = M.dodavatel || {}, O = M.odberatel || {};
  const sadzba = +M.sadzba || 0, sadzbaPct = Math.round(sadzba * 100);
  const da = rozlozAdresu(D.adresa), oa = rozlozAdresu(O.adresa);
  const odbKrajina = ublKrajina(O.icdph);
  const kraj = (k) => ISDOC_KRAJINY[k] || k;
  const S = M.sumy || {};
  const P = M.platba || {};
  const karta = String(P.kod) === "48";
  const lines = (M.riadky || []).map((p, i) => {
    const lineBez = r2((+p.mn || 0) * (+p.cena || 0)), lineDph = r2(lineBez * sadzba);
    return `      <InvoiceLine>
         <ID>${i + 1}</ID>
         <InvoicedQuantity unitCode="${esc(p.mj || "ks")}">${n2(p.mn)}</InvoicedQuantity>
         <LineExtensionAmount>${n2(lineBez)}</LineExtensionAmount>
         <LineExtensionAmountTaxInclusive>${n2(lineBez + lineDph)}</LineExtensionAmountTaxInclusive>
         <LineExtensionTaxAmount>${n2(lineDph)}</LineExtensionTaxAmount>
         <UnitPrice>${n2(p.cena)}</UnitPrice>
         <UnitPriceTaxInclusive>${n2(r2((+p.cena || 0) * (1 + sadzba)))}</UnitPriceTaxInclusive>
         <ClassifiedTaxCategory><Percent>${sadzbaPct}</Percent><VATCalculationMethod>0</VATCalculationMethod><VATApplicable>true</VATApplicable></ClassifiedTaxCategory>
         <Note languageID="sk">${esc(p.poznamka || "")}</Note>
         <Item><Description>${esc(p.nazov)}</Description></Item>
      </InvoiceLine>`;
  }).join("\n");
  const ucet = isdocUcet(P.iban || D.iban);
  const platba = karta ? `
   <PaymentMeans>
      <Payment>
         <PaidAmount>${n2(S.spolu)}</PaidAmount>
         <PaymentMeansCode>48</PaymentMeansCode>
      </Payment>
   </PaymentMeans>` : `
   <PaymentMeans>
      <Payment>
         <PaidAmount>${n2(S.spolu)}</PaidAmount>
         <PaymentMeansCode>42</PaymentMeansCode>
         <Details>
            <PaymentDueDate>${esc(datum(M.splatnost))}</PaymentDueDate>
            <ID>${esc(ucet.id)}</ID>
            <BankCode>${esc(ucet.kod)}</BankCode>
            <Name>${esc(ucet.nazov)}</Name>
            <IBAN>${esc(String(P.iban || D.iban || "").replace(/\s/g, ""))}</IBAN>
            <BIC>${esc(D.swift || "")}</BIC>
            <VariableSymbol>${esc(String(P.vs || M.cislo || "").replace(/\D/g, ""))}</VariableSymbol>
         </Details>
      </Payment>
   </PaymentMeans>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
   <DocumentType>${ISDOC_DRUH[M.doklad || "380"] || "1"}</DocumentType>
   <ID>${esc(M.cislo)}</ID>
   <UUID>${esc(M.uuid || uuidZTextu(M.cislo))}</UUID>
   <IssuingSystem>eživnostník</IssuingSystem>
   <IssueDate>${datum(M.vystavene)}</IssueDate>
   <TaxPointDate>${datum(M.dodanie || M.vystavene)}</TaxPointDate>
   <VATApplicable>true</VATApplicable>
   <ElectronicPossibilityAgreementReference />
   <Note languageID="sk">${esc(M.poznamka || ((M.riadky || [])[0] || {}).nazov || "")}</Note>
   <LocalCurrencyCode>EUR</LocalCurrencyCode>
   <CurrRate>1</CurrRate>
   <RefCurrRate>1</RefCurrRate>
   <AccountingSupplierParty><Party>
      <PartyIdentification><ID>${esc(D.ico)}</ID></PartyIdentification>
      <PartyName><Name>${esc(D.nazov)}</Name></PartyName>
      <PostalAddress><StreetName>${esc(da.ulica)}</StreetName><BuildingNumber>${esc(da.cislo)}</BuildingNumber><CityName>${esc(da.mesto)}</CityName><PostalZone>${esc(da.psc)}</PostalZone><Country><IdentificationCode>SK</IdentificationCode><Name>${esc(kraj("SK"))}</Name></Country></PostalAddress>
      <PartyTaxScheme><CompanyID>${esc(D.icdph)}</CompanyID><TaxScheme>VAT</TaxScheme></PartyTaxScheme>${D.dic ? `
      <PartyTaxScheme><CompanyID>${esc(D.dic)}</CompanyID><TaxScheme>TIN</TaxScheme></PartyTaxScheme>` : ""}${D.orVeta ? `
      <RegisterIdentification><Preformatted>${esc(D.orVeta)}</Preformatted></RegisterIdentification>` : ""}
   </Party></AccountingSupplierParty>
   <AccountingCustomerParty><Party>
      <PartyIdentification><ID>${esc(O.ico || "")}</ID></PartyIdentification>
      <PartyName><Name>${esc(O.nazov || "")}</Name></PartyName>
      <PostalAddress><StreetName>${esc(oa.ulica)}</StreetName><BuildingNumber>${esc(oa.cislo)}</BuildingNumber><CityName>${esc(oa.mesto)}</CityName><PostalZone>${esc(oa.psc)}</PostalZone><Country><IdentificationCode>${esc(odbKrajina)}</IdentificationCode><Name>${esc(kraj(odbKrajina))}</Name></Country></PostalAddress>
      <PartyTaxScheme><CompanyID>${esc(O.icdph || "")}</CompanyID><TaxScheme>VAT</TaxScheme></PartyTaxScheme>${O.dic ? `
      <PartyTaxScheme><CompanyID>${esc(O.dic)}</CompanyID><TaxScheme>TIN</TaxScheme></PartyTaxScheme>` : ""}
   </Party></AccountingCustomerParty>${M.opravuje ? `
   <OriginalDocumentReferences><OriginalDocumentReference><ID>${esc(M.opravuje)}</ID></OriginalDocumentReference></OriginalDocumentReferences>` : ""}
   <InvoiceLines>
${lines}
   </InvoiceLines>
   <TaxTotal>
      <TaxSubTotal>
         <TaxableAmount>${n2(S.bez)}</TaxableAmount>
         <TaxAmount>${n2(S.dph)}</TaxAmount>
         <TaxInclusiveAmount>${n2(S.spolu)}</TaxInclusiveAmount>
         <AlreadyClaimedTaxableAmount>0.00</AlreadyClaimedTaxableAmount>
         <AlreadyClaimedTaxAmount>0.00</AlreadyClaimedTaxAmount>
         <AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>
         <DifferenceTaxableAmount>${n2(S.bez)}</DifferenceTaxableAmount>
         <DifferenceTaxAmount>${n2(S.dph)}</DifferenceTaxAmount>
         <DifferenceTaxInclusiveAmount>${n2(S.spolu)}</DifferenceTaxInclusiveAmount>
         <TaxCategory><Percent>${sadzbaPct}</Percent><VATApplicable>true</VATApplicable></TaxCategory>
      </TaxSubTotal>
      <TaxAmount>${n2(S.dph)}</TaxAmount>
   </TaxTotal>
   <LegalMonetaryTotal>
      <TaxExclusiveAmount>${n2(S.bez)}</TaxExclusiveAmount>
      <TaxInclusiveAmount>${n2(S.spolu)}</TaxInclusiveAmount>
      <AlreadyClaimedTaxExclusiveAmount>0.00</AlreadyClaimedTaxExclusiveAmount>
      <AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>
      <DifferenceTaxExclusiveAmount>${n2(S.bez)}</DifferenceTaxExclusiveAmount>
      <DifferenceTaxInclusiveAmount>${n2(S.spolu)}</DifferenceTaxInclusiveAmount>
      <PaidDepositsAmount>0.00</PaidDepositsAmount>
      <PayableAmount>${n2(S.spolu)}</PayableAmount>
   </LegalMonetaryTotal>${platba}
</Invoice>`;
}

// ── Faktúra za predplatné (riadok `saas_faktury`) → model ──────────────────
// Dodanie = prvý deň aktívneho predplatného (`obdobie_od`), pri karte deň
// platby (Roman 8. 10. 2026). Sumy idú z riadku — tie strhol Stripe a tie sú
// na PDF; prepočet tu by vedel dať o cent iné DPH než doklad.
export function modelEfakturySaas(r, dodavatel, opts = {}) {
  const D = dodavatel || {};
  // `saas_faktury.sadzba_dph` je ZLOMOK (0.23, predvolená hodnota stĺpca aj to,
  // čo zapisuje stripe-webhook) — rovnako ho číta `modelSaasFaktury` vo
  // faktura_pdf.js. 8. 10. 2026 sa tu delil stovkou podľa ručne zloženej vzorky
  // so sadzbou 23 a ISDOC by niesol 0 % (zistené pred prvou faktúrou).
  // Hodnota nad 1 by bola percento — prevedie sa, nech sa z nej nestane 2300 %.
  const s0 = +r.sadzba_dph || 0.23;
  const sadzba = s0 > 1 ? s0 / 100 : s0;
  const zaklad = +r.zaklad || 0;
  // Dobropis (`typ = dobropis`, rad D, admin_66): sumy v riadku sú ZÁPORNÉ
  // (tak drží dobropisy celá appka — spec 100.2, `dobropisZaporne`), riadok má
  // množstvo −1 a KLADNÚ cenu (záporná jednotková cena = BR-27).
  const dobropis = r.typ === "dobropis";
  // Prevod (admin_67): faktúra vzniká až po pripísaní platby — je zaplatená
  // celá (PrepaidAmount = spolu, na úhradu 0), dátum úhrady = deň pripísania.
  const prevod = (opts.platba || r.uhrada) === "prevod";
  return {
    doklad: dobropis ? "381" : "380",
    opravuje: dobropis ? String(r.opravuje || "") : "",
    cislo: String(r.cislo || ""),
    uuid: opts.uuid || uuidZTextu("saas:" + (r.cislo || "")),
    vystavene: datum(r.vystavene),
    dodanie: datum(dodanieSaas(r)),
    splatnost: prevod && r.uhradene ? datum(r.uhradene) : null,
    mena: r.mena || "EUR",
    poznamka: r.popis || "",
    buyerRef: String(r.cislo || ""),
    dodavatel: { nazov: D.nazov, ico: D.ico, dic: D.dic, icdph: D.icdph, adresa: D.adresa, orVeta: D.orVeta || "", iban: D.iban, swift: D.swift },
    odberatel: { nazov: r.odb_nazov || "", ico: r.odb_ico || "", dic: r.odb_dic || "", icdph: r.odb_icdph || "", adresa: r.odb_adresa || "" },
    kategoria: { kod: sadzba > 0 ? "S" : "O", ...(sadzba > 0 ? {} : { dovod: "Dodávateľ nie je platiteľ DPH", bezSadzby: true, bezIcDph: true }) },
    sadzba,
    riadky: [dobropis
      ? { nazov: r.popis || "Dobropis — predplatné eživnostník", mn: -1, mj: "mesiac", cena: Math.abs(zaklad) }
      : { nazov: r.popis || "Predplatné eživnostník", mn: 1, mj: "mesiac", cena: zaklad }],
    sumy: { bez: zaklad, dph: +r.dph || 0, spolu: +r.spolu || 0, ...(prevod ? { prepaid: +r.spolu || 0 } : {}) },
    platba: { kod: prevod ? "30" : "48", vs: opts.vs || r.vs || "", iban: D.iban },
  };
}

// Deň dodania (zdaniteľného plnenia) faktúry za predplatné. Pravidlo je prvý
// deň predplatného (Roman 8. 10. 2026) — pri karte aj pri prvej platbe
// prevodom je to deň platby. Obnova prevodom zaplatená PRED začiatkom obdobia
// je platba vopred: daňová povinnosť vzniká jej prijatím (§ 19 ods. 4 ZDPH),
// takže platí skorší z dvoch dátumov. Druhá kópia je vo faktura_pdf.js
// (modelSaasFaktury) — zhodu PDF = ISDOC = UBL stráži test_efaktura_xml.
export function dodanieSaas(r) {
  const od = String(r.obdobie_od || r.vystavene || "").slice(0, 10);
  const uhr = String(r.uhradene || "").slice(0, 10);
  return r.uhrada === "prevod" && /^\d{4}-\d{2}-\d{2}$/.test(uhr) && /^\d{4}-\d{2}-\d{2}$/.test(od) && uhr < od ? uhr : (r.obdobie_od || r.vystavene);
}
