# -*- coding: utf-8 -*-
"""
Generátor ukážkových dát pre eživnostník.

Cieľ nie je „nejaké dáta", ale dáta, na ktorých sa dá odskúšať KAŽDÁ hlavná
funkcia — a to vrátane tých, ktoré potrebujú neporiadok: nespárovaný pohyb,
faktúru po splatnosti, čiastočnú úhradu, víkendovú jazdu s dokladom.
Preto sa generuje skriptom a nie ručne: keď sa schéma zmení, prepíše sa tu.
"""
import json, random, datetime as dt

random.seed(20260726)
r2 = lambda x: round(float(x) + 0.0, 2)
DNI = ["nedeľa","pondelok","utorok","streda","štvrtok","piatok","sobota"]
DPH = 0.23

def sk(d):      return "%d. %d. %d" % (d.day, d.month, d.year)
def iso(d):     return d.strftime("%Y-%m-%d")
def mk(d):      return d.strftime("%Y-%m")

# ── odberatelia ────────────────────────────────────────────────────────────
KLIENTI = [
 dict(nazov="Kaviareň Zrnko & Para, s. r. o.",      ico="51001122", icdph="SK2120011220",
      adresa="Štefánikova 12, 949 01 Nitra",  iban="SK9002000000001111510011"),
 dict(nazov="Pekáreň Vôňa Rána, s. r. o.",          ico="52334455", icdph="SK2120334455",
      adresa="Hlavná 88, 917 01 Trnava",      iban="SK9002000000001111523344"),
 dict(nazov="Kníhkupectvo Sova a Kniha, s. r. o.",  ico="53667788", icdph="SK2120667788",
      adresa="Nám. Mieru 3, 927 01 Šaľa",     iban="SK9002000000001111536677"),
 dict(nazov="Záhradníctvo Zelený Ježko, s. r. o.",  ico="54990011", icdph="SK2120990011",
      adresa="Poľná 41, 934 01 Levice",       iban="SK9002000000001111549900"),
 dict(nazov="Cyklo Servis Rýchle Koleso, s. r. o.", ico="55223344", icdph="SK2120223344",
      adresa="Továrenská 7, 940 02 Nové Zámky", iban="SK9002000000001111552233"),
]

# ── faktúry ────────────────────────────────────────────────────────────────
# (deň vystavenia, klient, položka, mn, mj, cena, stav úhrady)
FA = [
 ("2026-01-16", 0, "Návrh loga a vizuálnej identity",        1, "ks",  1850, "plna"),
 ("2026-02-06", 1, "Redizajn webstránky",                    1, "ks",  2400, "plna"),
 ("2026-02-27", 2, "Grafika pre sociálne siete — balík",     1, "ks",   960, "plna"),
 ("2026-03-24", 3, "Tlačové podklady — letáky a plagáty",    1, "ks",   740, "plna"),
 ("2026-04-14", 4, "UX konzultácia",                        16, "hod",   65, "plna"),
 ("2026-05-06", 0, "Fotografovanie produktov",               1, "ks",  1180, "ciastocna"),
 ("2026-05-29", 1, "Obalový dizajn — rad pečiva",            1, "ks",  1620, "plna"),
 ("2026-06-18", 2, "Ilustrácie do detskej edície",          12, "ks",   140, "posplatnosti"),
 ("2026-07-15", 3, "Katalóg rastlín — sadzba a tlač",        1, "ks",  1340, "nova"),
]

faktury, uhrady_bank = [], []
for i,(den, ki, nazov, mn, mj, cena, stav) in enumerate(FA, start=1):
    d = dt.date.fromisoformat(den)
    k = KLIENTI[ki]
    bez = r2(mn*cena); dph = r2(bez*DPH); spolu = r2(bez+dph)
    cislo = "2026%04d" % i
    faktury.append(dict(
        cislo=cislo, odberatel=k["nazov"], ico=k["ico"], icdph=k["icdph"],
        adresa=k["adresa"], datum=den, vystavenie=den,
        splatnost=iso(d+dt.timedelta(days=14)), vs=cislo,
        bez=bez, dph=dph, spolu=spolu, sadzba=DPH,
        polozky=[dict(nazov=nazov, mn=mn, mj=mj, cena=cena)],
        forma="Bankový prevod"))
    if stav == "plna":
        uhrady_bank.append((d+dt.timedelta(days=random.randint(8,16)), spolu, cislo, k))
    elif stav == "ciastocna":
        uhrady_bank.append((d+dt.timedelta(days=11), r2(spolu*0.5), cislo, k))

# ── výdavky ────────────────────────────────────────────────────────────────
# (deň, partner, IČO, popis, kategória, suma s DPH, sadzba, druh, spôsob)
VYD = [
 ("2026-01-08","Adobe Systems Software Ireland","","Creative Cloud — mesačné predplatné","Softvér a služby",72.59,0.23,"Došlá faktúra","prevod"),
 ("2026-01-14","OMV Slovensko, s. r. o.","31340846","Tankovanie","Prevádzka vozidla",68.40,0.23,"Bloček","karta"),
 ("2026-01-22","Papiernictvo Ceruzka, s. r. o.","51778899","Kancelárske potreby","Kancelária",27.96,0.23,"Bloček","karta"),
 ("2026-02-03","WebHost SK, s. r. o.","51665544","Hosting a doména na rok","Softvér a služby",57.48,0.23,"Došlá faktúra","prevod"),
 ("2026-02-05","ZSE Energetické služby, s. r. o.","52820203","Verejné nabíjanie","Prevádzka vozidla",21.90,0.23,"Došlá faktúra","prevod"),
 ("2026-02-11","O2 Slovakia, s. r. o.","35848863","Mobilný paušál","Telefón a internet",30.00,0.23,"Došlá faktúra","prevod"),
 ("2026-02-24","Servis PC Rýchlik, s. r. o.","52119988","Notebook — výmena batérie","Vybavenie",106.80,0.23,"Došlá faktúra","karta"),
 ("2026-03-04","O2 Slovakia, s. r. o.","35848863","Mobilný paušál","Telefón a internet",30.00,0.23,"Došlá faktúra","prevod"),
 ("2026-03-09","Slovnaft, a. s.","31322832","Tankovanie","Prevádzka vozidla",74.15,0.23,"Bloček","karta"),
 ("2026-03-18","Depositphotos","","Fotobanka — ročné predplatné","Softvér a služby",359.88,0.00,"Došlá faktúra","karta"),
 ("2026-03-27","Saba Parking SK, s. r. o.","35844256","Parkovné — centrum mesta","Prevádzka vozidla",9.76,0.23,"Bloček","karta"),
 ("2026-04-02","Adobe Systems Software Ireland","","Creative Cloud — mesačné predplatné","Softvér a služby",72.59,0.23,"Došlá faktúra","prevod"),
 ("2026-04-08","O2 Slovakia, s. r. o.","35848863","Mobilný paušál","Telefón a internet",30.00,0.23,"Došlá faktúra","prevod"),
 ("2026-04-21","EventPro, s. r. o.","53442211","Školenie — typografia v praxi","Vzdelávanie",216.00,0.23,"Došlá faktúra","prevod"),
 ("2026-04-29","Tlačiareň Dobrý Odtlačok, s. r. o.","52667711","Tlač vzoriek pre klienta","Materiál",143.52,0.23,"Došlá faktúra","prevod"),
 ("2026-05-06","O2 Slovakia, s. r. o.","35848863","Mobilný paušál","Telefón a internet",30.00,0.23,"Došlá faktúra","prevod"),
 ("2026-05-13","OMV Slovensko, s. r. o.","31340846","Tankovanie","Prevádzka vozidla",71.28,0.23,"Bloček","karta"),
 ("2026-05-19","Poisťovňa Istota, a. s.","51009988","Poistenie zodpovednosti za škodu","Poistenie",103.50,0.00,"Došlá faktúra","prevod"),
 ("2026-06-03","Adobe Systems Software Ireland","","Creative Cloud — mesačné predplatné","Softvér a služby",72.59,0.23,"Došlá faktúra","prevod"),
 ("2026-06-09","O2 Slovakia, s. r. o.","35848863","Mobilný paušál","Telefón a internet",30.00,0.23,"Došlá faktúra","prevod"),
 ("2026-06-17","Kaviareň Zrnko & Para, s. r. o.","51001122","Pracovné stretnutie — občerstvenie","Reprezentácia",17.52,0.23,"Bloček","karta"),
 ("2026-06-30","Účtovníctvo Presné Číslo, s. r. o.","53881100","Spracovanie účtovníctva Q2","Účtovníctvo a poradenstvo",295.20,0.23,"Došlá faktúra","prevod"),
 ("2026-07-07","O2 Slovakia, s. r. o.","35848863","Mobilný paušál","Telefón a internet",30.00,0.23,"Došlá faktúra","prevod"),
 ("2026-07-13","Slovnaft, a. s.","31322832","Tankovanie","Prevádzka vozidla",66.90,0.23,"Bloček","karta"),
 ("2026-07-20","Fotoateliér Svetlo, s. r. o.","52443399","Prenájom štúdia a svetiel","Materiál",184.00,0.23,"Došlá faktúra","prevod"),
]
SPOSOB = {"prevod":"Bankový prevod","karta":"Kartou","hotovost":"Hotovosť"}

vydavky, tankovania = [], []
for i,(den, partner, ico, popis, kat, spolu, sadz, druh, sposob) in enumerate(VYD):
    bez = r2(spolu/(1+sadz)) if sadz else r2(spolu)
    dph = r2(spolu-bez)
    vid = "demo_v%02d" % i
    vydavky.append(dict(
        id=vid, cislo="D2026%03d" % (i+1), druh=druh, partner=partner, ico=ico,
        popis=popis, kategoria=kat, datum=den, mesiac=int(den[5:7]),
        bez=bez, dph=dph, spolu=spolu, sadzba=sadz,
        uhrada=SPOSOB[sposob], mena="EUR"))
    if popis == "Tankovanie":
        litre = r2(spolu/1.62)
        tankovania.append(dict(id="demo_t%02d" % i, vydavokId=vid, datum=den,
                               litre=litre, suma=spolu, stanica=partner,
                               mesiac=mk(dt.date.fromisoformat(den)), zdroj="demo"))

# ── nabíjania (ZSE) ────────────────────────────────────────────────────────
nabijania = []
for m in range(1, 8):
    prvy = dt.date(2026, m, 1)
    nabijania.append(dict(karta="692233", typ="Mesačný poplatok", stanica="",
                          datum=iso(prvy), zaciatok="02:00", koniec="02:00",
                          kwh=0, suma=11.68, mesiac=mk(prvy)))
for den, kwh, suma, stanica in [
    ("2026-02-04", 18.42, 7.92, "ZSE Nitra — Mlyny"),
    ("2026-03-11", 21.06, 9.05, "ZSE Trnava — City Aréna"),
    ("2026-04-23", 16.88, 7.26, "ZSE Bratislava — Eurovea"),
    ("2026-05-30", 20.87, 8.97, "ZSE RK Kozí vŕšok Ultra"),
    ("2026-06-26", 19.34, 8.31, "ZSE Levice — Nákupná zóna"),
    ("2026-07-17", 17.55, 7.55, "ZSE Nové Zámky — OC Aquario")]:
    nabijania.append(dict(karta="692233", typ="Nabíjanie", stanica=stanica,
                          datum=den, zaciatok="13:26", koniec="14:15",
                          kwh=kwh, suma=suma, mesiac=den[:7]))

# ── kniha jázd ─────────────────────────────────────────────────────────────
TRASY = [
 ("Nitra – Bratislava – Nitra",   182, "Stretnutie s klientom Kaviareň Zrnko & Para"),
 ("Nitra – Trnava – Nitra",       103, "Fotografovanie produktov Pekáreň Vôňa Rána"),
 ("Nitra – Šaľa – Nitra",          57, "Stretnutie Kníhkupectvo Sova a Kniha"),
 ("Nitra – Levice – Nitra",        94, "Prezentácia Záhradníctvo Zelený Ježko"),
 ("Nitra – Nové Zámky – Nitra",    78, "Konzultácia Cyklo Servis Rýchle Koleso"),
 ("Nitra – Piešťany – Nitra",     119, "Fotenie interiéru kaviarne"),
 ("Nitra – Nitra (centrum)",       11, "Tlačiareň — odovzdanie podkladov"),
]
TANK_DNI = {t["datum"] for t in tankovania}

jazdy, tacho = [], 42150
den = dt.date(2026, 1, 5)
i = 0
while den <= dt.date(2026, 7, 24):
    dow = den.weekday()                      # 0 = pondelok
    vikend = dow >= 5
    # víkendová jazda len občas — a v deň tankovania ju necháme naschvál,
    # aby bolo na čom ukázať, že sprievodca ju nepresunie
    if vikend and iso(den) not in TANK_DNI and random.random() > 0.16:
        den += dt.timedelta(days=1); continue
    if not vikend and random.random() > 0.55:
        den += dt.timedelta(days=1); continue
    trasa, km, ucel = TRASY[i % len(TRASY)]
    km = km + random.randint(-6, 6)
    hh = random.randint(7, 15); mm = random.choice([0,5,10,15,20,25,30,35,40,45,50,55])
    rych = random.randint(38, 54)
    minuty = max(8, round(km/rych*60))
    # hybrid: elektrina na kratších trasách, benzín sa pridá na dlhých
    kwh = r2(km * random.uniform(0.145, 0.178) * 100 / 100)
    lit = r2(km * random.uniform(0.030, 0.052)) if km > 110 else 0
    jazdy.append(dict(
        id="demo_j%03d" % i,
        datum="%s %02d:%02d" % (sk(den), hh, mm),
        dt=dt.datetime(den.year, den.month, den.day, hh, mm).isoformat()+".000Z",
        den=DNI[(dow+1) % 7], vodic="Zuzana Vzorová",
        cesta=trasa, ucel=ucel, km=km,
        poc=tacho, kon=tacho+km,
        doba="%02d:%02d" % (minuty//60, minuty%60), rychlost=round(km/(minuty/60)),
        celkKWh=kwh, celkL=lit,
        spotrebaKWh=r2(kwh/km*100), spotrebaL=r2(lit/km*100) if lit else 0,
        mesiac=mk(den), zdroj="demo", doplnene=False))
    tacho += km; i += 1
    den += dt.timedelta(days=random.randint(1, 3))

# Víkendová jazda s dokladom o tankovaní. Nie je to kozmetika: presne na takom
# dni sa dá ukázať, prečo sprievodca niektoré víkendové jazdy presunúť odmieta.
vikendove = [j for j in jazdy if j["den"] in ("sobota","nedeľa")]
if vikendove:
    jv = vikendove[len(vikendove)//2]
    dv = jv["dt"][:10]
    vid = "demo_v_vikend"
    vydavky.append(dict(id=vid, cislo="D2026026", druh="Bloček",
        partner="OMV Slovensko, s. r. o.", ico="31340846", popis="Tankovanie",
        kategoria="Prevádzka vozidla", datum=dv, mesiac=int(dv[5:7]),
        bez=r2(62.80/1.23), dph=r2(62.80-r2(62.80/1.23)), spolu=62.80,
        sadzba=0.23, uhrada="Kartou", mena="EUR"))
    tankovania.append(dict(id="demo_t_vikend", vydavokId=vid, datum=dv,
        litre=r2(62.80/1.62), suma=62.80, stanica="OMV Slovensko, s. r. o.",
        mesiac=dv[:7], zdroj="demo"))

# ── bankový výpis ──────────────────────────────────────────────────────────
IBAN_MOJ = "SK1111000000001234567890"
vypis = []
def pohyb(d, suma, smer, proti, vs, popis, iban="", **kw):
    z = dict(id="demo_tx%03d" % len(vypis), dt=d.isoformat()+"T00:00:00.000Z",
             datum=iso(d), suma=r2(abs(suma)), smer=smer, proti=proti, vs=vs,
             popis=popis, ibanProti=iban, mesiac=mk(d))
    z.update(kw); vypis.append(z); return z

# príjmy za faktúry — VS sedí, úhrada sa odvodí sama (nič nie je „priradené")
for d, suma, cislo, k in uhrady_bank:
    pohyb(d, suma, "prijem", k["nazov"], cislo,
          "Úhrada faktúry " + cislo, k["iban"])

# výdavky — väčšina priradená, tri zámerne nie (je na čom ukázať párovanie)
NEPRIRADIT = {"D2026010", "D2026014", "D2026022"}
for v in vydavky:
    if v["uhrada"] == "Hotovosť":
        continue
    d = dt.date.fromisoformat(v["datum"])
    t = pohyb(d, v["spolu"], "vydaj", v["partner"], v["cislo"].replace("D",""),
              v["popis"], "SK5002000000002222" + (v["ico"] or "000000")[:6])
    if v["cislo"] not in NEPRIRADIT:
        t["uhrady"] = [dict(typ="vydavok", cislo=v["cislo"], suma=v["spolu"], datum=v["datum"])]
        t["potvrdenaZhoda"] = dict(typ="vydavok", cislo=v["cislo"])

# odvody, dane, banka, súkromné prevody
for m in range(1, 8):
    pohyb(dt.date(2026, m, 8), 121.92, "vydaj", "Union zdravotná poisťovňa", "1050123456",
          "Odvod zdravotné poistenie", "SK6065000000009999")
    pohyb(dt.date(2026, m, 12), 12.90, "vydaj", "Tatra banka, a. s.", "",
          "Poplatok za vedenie účtu", "SK3011000000003333")
    pohyb(dt.date(2026, m, 20), random.choice([400, 500, 600]), "vydaj",
          "VZOROVÁ ZUZANA", "", "Prevod na súkromný účet",
          "SK8956000000009942097003")
for q, den in [("Q1", "2026-03-31"), ("Q2", "2026-06-30")]:
    pohyb(dt.date.fromisoformat(den), 738.25, "vydaj", "Daňový úrad Nitra", "1050123456",
          "Preddavok na daň z príjmov " + q, "SK1180000000007000080036")
pohyb(dt.date(2026, 4, 27), 84.00, "prijem", "Sociálna poisťovňa", "",
      "Vrátenie preplatku", "SK5265000000001111")

vypis.sort(key=lambda t: t["datum"])
for n, t in enumerate(vypis):
    t["id"] = "demo_tx%03d" % n

# ── majetok ────────────────────────────────────────────────────────────────
majetok = [
 dict(id="demo_m1", nazov="Škoda Superb iV (plug-in hybrid)", typMajetku="odpisovany",
      vstupnaCena=38900.00, datumZaradenia="2025-03-14", odpisovaSkupina=0,
      poznamka="Vozidlo v obchodnom majetku, kniha jázd sa vedie."),
 dict(id="demo_m2", nazov="MacBook Pro 14\"", typMajetku="odpisovany",
      vstupnaCena=2640.00, datumZaradenia="2025-09-02", odpisovaSkupina=0,
      poznamka=""),
 dict(id="demo_m3", nazov="Fotoaparát Sony A7 IV + objektívy", typMajetku="drobny",
      vstupnaCena=1720.00, datumZaradenia="2026-02-10", odpisovaSkupina=0,
      poznamka="Drobný majetok — jednorazovo do výdavkov."),
]

# ── výkazy prác a protokoly ────────────────────────────────────────────────
def vykaz(rok, mes, nazov, aktivity):
    prvy = dt.date(rok, mes, 1)
    posl = (dt.date(rok, mes+1, 1) - dt.timedelta(days=1)) if mes < 12 else dt.date(rok,12,31)
    pol, dni = [], 0
    d = prvy
    while d <= posl:
        if d.weekday() < 5 and random.random() > 0.25:
            pol.append(dict(datum=iso(d), hodiny=8,
                            poznamka=random.choice(aktivity),
                            aktivity=[random.choice(aktivity)]))
            dni += 1
        d += dt.timedelta(days=1)
    return dict(projekt=nazov, zakazka="DEMO0001", pracovnik="Zuzana Vzorová",
                obdobie="%d.%d.%d - %d.%d.%d" % (prvy.day, prvy.month, rok, posl.day, posl.month, rok),
                polozky=pol, hodiny=dni*8, dni=dni)

AKT = ["Návrh vizuálnej identity — koncept","Sadzba tlačových podkladov",
       "Konzultácia s klientom","Fotografovanie produktov","Retuš a postprodukcia",
       "Príprava dát pre tlačiareň","Návrh obalového dizajnu","Korektúry a schvaľovanie"]
vykazy = [vykaz(2026, 5, "Redizajn značky — Kaviareň Zrnko & Para", AKT),
          vykaz(2026, 6, "Obalový dizajn — Pekáreň Vôňa Rána", AKT)]

protokoly = [dict(
    cislo="AP_05_2026", datum="2026-06-02", obdobie="1.5.2026 - 31.5.2026",
    dni=vykazy[0]["dni"], tarifa=420, suma=vykazy[0]["dni"]*420,
    pracovnik="Zuzana Vzorová", miesto="Nitra",
    dodavatel="Zuzana Vzorová — Ateliér Modrý Bocian", dodavatelIco="50 123 456",
    objednavatel="Kaviareň Zrnko & Para, s. r. o.", schvalil="Ján Zrnko",
    text="Na základe zmluvy o dielo a priloženého výkazu prác objednávateľ potvrdzuje, "
         "že dodávateľ vykonal požadované práce v rozsahu:")]

# ── settings ───────────────────────────────────────────────────────────────
settings = {
 "dphPlatca": True, "sadzbaDPH": DPH,
 "danPrijem": 0.15, "zdravSadzba": 0.16, "zpSadzba2026": 0.16,
 "nezdanitCast2026": 5966.73, "limit15pct": 60000,
 "preddavokZP": 121.92, "preddavokDanQ": 738.25, "preddavokDanOd": "2026-01",
 "socOdvodyMes": 0, "socOdvodyOd": "2026-07",
 "odpisAutoMes": 0,
 # kniha jázd
 "kjTypVozidla": "phev", "kjNazovVozidla": "Škoda Superb iV",
 "kjVodic": "Zuzana Vzorová", "kjNormaBenzin": 5.6, "kjNormaElektro": 16.4,
 "kjNormaElektrina": 16.4, "kjCenaElektro": 0.15, "kjPriemRychlost": 45,
 "kjTrasaDefault": "Nitra – Bratislava – Nitra", "kjTrasa": "Nitra – Bratislava – Nitra",
 "kjUcel": "Stretnutie s klientom", "kjAutoLimit": 50,
 "kjOptVikendMax": 40, "kjOptDlhaJazda": 120, "kjOptDenMin": 45,
 "kjOptDenMax": 100, "kjOptDialkova": 200,
 # fakturácia
 "dodavatel": "Zuzana Vzorová — Ateliér Modrý Bocian",
 "dodavatelAdresa": "Slnečná 14, 949 01 Nitra",
 "dodavatelIco": "50 123 456", "dodavatelIcDph": "SK1050123456",
 "miestoPodpisu": "Nitra", "denTarifa": 420, "stravneDen": 5.12,
 "zakazkaCislo": "DEMO0001", "projektNazov": "Ateliér Modrý Bocian — klientske projekty",
 "odberatelia": [dict(nazov=k["nazov"], adresa=k["adresa"], ico=k["ico"],
                      icdph=k["icdph"], skratka=k["nazov"].split(",")[0]) for k in KLIENTI],
 "dodavatelia": [dict(nazov="Zuzana Vzorová — Ateliér Modrý Bocian",
                      adresa="Slnečná 14, 949 01 Nitra", ico="50 123 456",
                      icdph="SK1050123456", skratka="Ateliér Modrý Bocian",
                      pracovnik="Zuzana Vzorová")],
 # pravidlo na súkromné prevody — nech je vidieť, že sa dajú vypnúť
 "ignorPravidla": [dict(typ="iban", hodnota="SK8956000000009942097003",
                        nazov="Súkromný účet (prevody)"),
                   dict(typ="popis", hodnota="Poplatok za vedenie",
                        nazov="Bankové poplatky")],
 "vykazHodinyMod": "pausal", "vykazPausalHodin": 8,
 "vykazVylucit": "obed,lunch,súkromné,dovolenka",
 "castyUlohy": AKT,
}

partneri = [dict(nazov=k["nazov"], ico=k["ico"], icdph=k["icdph"], adresa=k["adresa"],
                 typ="odberatel") for k in KLIENTI]

demo = {
 "schema": 1,
 "meta": dict(nazov="Zuzana Vzorová — Ateliér Modrý Bocian", ico="50123456",
              dic="1050123456", icdph="SK1050123456",
              adresa="Slnečná 14, 949 01 Nitra", iban=IBAN_MOJ,
              vozidlo="Škoda Superb iV", email="zuzana@modrybocian.sk",
              telefon="+421 900 123 456"),
 "settings": settings,
 "faktury": faktury, "vydavky": vydavky, "vypis": vypis,
 "jazdy": jazdy, "tankovania": tankovania, "nabijania": nabijania,
 "majetok": majetok, "vykazy": vykazy, "protokoly": protokoly,
 "partneri": partneri,
 "dan": [], "dph": {}, "naklady": [], "dokumenty": [], "udalostiFS": [],
 "danovePriznania": {}, "priznanieB": {}, "kjTrasyVolby": {},
 "dovolenka": {"2026": {"narok": 25, "mesiace": {m: 0 for m in
     ["Január","Február","Marec","Apríl","Máj","Jún","Júl","August",
      "September","Október","November","December"]}}},
}

json.dump(demo, open("firma_demo.json","w",encoding="utf-8"), ensure_ascii=False)
print("faktúry:", len(faktury), "· výdavky:", len(vydavky), "· pohyby:", len(vypis),
      "· jazdy:", len(jazdy), "· km:", sum(j["km"] for j in jazdy),
      "· tankovania:", len(tankovania), "· nabíjania:", len(nabijania))
print("obrat bez DPH:", r2(sum(f["bez"] for f in faktury)),
      "· výdavky spolu:", r2(sum(v["spolu"] for v in vydavky)))
