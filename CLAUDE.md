# Plaques moteurs — PWA iPhone de relevé de plaques signalétiques

Cahier des charges d'origine : `PROMPT_Claude_Code_Plaques_Moteurs.md` (Downloads de Paul).
Principe : **une session = un moteur = une ligne Excel.**

## État

- [x] Phase 1 : Réglages, sessions, capture, stockage IndexedDB (sans IA)
- [x] Phase 2 : analyse IA, écran de validation, file d'attente hors ligne (testée avec réponses simulées, pas encore avec la vraie API)
- [x] Phase 3 : export Excel, lot ZIP, partage iOS (testé dans le navigateur, partage iOS simulé)
- [x] Phase 4 : import et consolidation des lots (testé dans le navigateur avec lots simulés de deux appareils)
- [ ] Phase 5 : import de photos existantes (après tests terrain des phases 1 à 4)

## Fichiers

```
index.html             app complète (HTML + CSS + JS), commentée en français
sw.js                  cache hors ligne — changer CACHE à chaque version
manifest.webmanifest
icons/                 180 (iOS), 192, 512
vendor/                librairies figées, jamais de CDN à l'usage
  exifr.full.umd.js    7.1.3
  exceljs.min.js       4.4.0   (chargé à la demande par chargerScript)
  jszip.min.js         3.10.1  (idem)
```

## Règles non négociables

1. La clé API n'est jamais dans le code ni le dépôt (dépôt public). Stockée dans `localStorage` (`pm_reglages.cle`), affichée masquée.
2. Ne jamais inventer une valeur : codes `ILLISIBLE`, `ABSENT`, `NON TROUVÉ` (+ statut `CALCULÉ`).
3. Hors ligne d'abord.
4. Photos uniquement en IndexedDB.
5. Librairies dans `vendor/`, mises en cache par `sw.js`.

## Données

- `localStorage` : `pm_reglages` (nom, initiales, cle, modele, siteDefaut, gps, ecartMin), `pm_persist_demande`.
- IndexedDB `plaques-moteurs` v1 :
  - `sessions` (clé `id`, index `statut`, `datePriseVue`, `site`)
  - `photos` (clé `<ID>_<type>_<n>`, index `sessionId`) : `jpeg` (1568 px, q 0,85) et `miniature` (300 px) en Blob, `datePrise`, `sourceDate` (`exif` | `fichier` | `ordre`), `gps`, `origine`.
- ID de session : `<initiales>-<AAAAMMJJ>-<HHMM>-<4 car.>` (heure de création).
- `datePriseVue` de la session = date de prise de vue la plus ancienne de ses photos.
- Statuts : `capture` → `attente` → `a_valider` → `validee` → `exportee`.

## Analyse IA (section « 9 bis » de index.html)

- `POST /v1/messages` en `fetch` direct (pas de SDK : pas de build). `max_tokens: 16000`.
- `output_config.format` (json_schema `SCHEMA_REPONSE`) garantit le JSON ; `fallbacks: "default"` + en-tête `anthropic-beta: server-side-fallback-2026-07-01` bascule seul sur un autre modèle en cas de refus.
- Si l'API répond 400 avec ces options, nouvel essai en « mode compatible » (sans elles). Le parsing reste tolérant (retire les ```, cherche `{…}`).
- Thinking toujours actif sur ces modèles : ne lire que les blocs `type: "text"`. Pas de prefill, pas de `temperature`.
- 401 → erreur `cle` (bloque la file). 429/5xx → 3 essais (2 s, 6 s). Réseau → reste « attente », repart sur `online` / retour au premier plan / démarrage. JSON invalide → 1 nouvel essai puis erreur `ia`.
- Chaque appel est ajouté à `session.analyses` (date, modèle réellement utilisé, jetons, nb photos, ok) → feuille Journal.
- `valeursDepuisIA()` : un champ `modifie` par l'opérateur n'est jamais écrasé par une nouvelle analyse. Un code ILLISIBLE / ABSENT / NON TROUVÉ n'a jamais de valeur.
- Le tag saisi n'est pas envoyé à l'IA ; un écart tag saisi / tag lu s'affiche en ambre.

## Export (section « 12 ter » de index.html)

- Écran `#/export` : sélection par défaut = sessions `validee` ; mode « Toutes validées » ajoute les `exportee`. Filtres depuis-date, site, opérateur ; cases à cocher.
- **En deux temps** : « Préparer » fabrique le fichier, puis « Partager » appelle `navigator.share` (iOS refuse le partage s'il ne suit pas immédiatement un toucher). Sans partage de fichiers (ordinateur) : téléchargement.
- Partage réussi → sessions `exportee` + `exporteeLe`. Partage annulé (`AbortError`) → rien ne change.
- Excel (`construireExcel`) : feuille **Plaques** (37 colonnes, codes ILLISIBLE / ABSENT / NON TROUVÉ écrits en texte, CALCULÉ → « valeur (CALCULÉ) », ILLISIBLE en plus en rouge gras, miniatures 120 px ancrées, ligne figée, filtre auto) et feuille **Journal** (une ligne par session, jetons cumulés).
- Dates : `dateExcel()` convertit l'heure locale en UTC « identique » car ExcelJS écrit en UTC.
- Lot ZIP : `Plaques_<ini>_<AAAAMMJJ-HHMM>.xlsx`, `photos/<ID>_<type>_<n>.jpg`, `lot.json` (`construireLot`, `schema: 1`, sessions complètes + métadonnées des photos). JPEG stockés sans recompression (`STORE`).

## Import de lots (section « 12 quater » de index.html)

- Bouton « Importer un lot » en haut de l'écran Exporter ; bilan affiché dans une carte (`resultatImport`).
- `lireLot()` vérifie : ZIP lisible, `lot.json` présent, `app === 'plaques-moteurs'`, `schema === 1` (sinon : « mets l'app à jour »).
- `nettoyerSession()` ne recopie que les champs attendus, avec le bon type (le lot est une donnée externe). ID de session et de photo validés par expressions régulières.
- Statut sur l'appareil qui importe : `exportee` → `validee` (pas encore exportée ici, donc incluse dans l'Excel maître). L'opérateur d'origine est conservé. Champs ajoutés : `importeLe`, `lotOrigine`.
- Même ID : contenu identique → « déjà à jour » ; sinon la version au `modifieLe` le plus récent est gardée et un **conflit** est signalé (locale ou importée gardée).
- `DB.remplacerSession()` remplace session + photos en une transaction et garde le `modifieLe` d'origine (`putSessionTelle`), pour que les imports suivants comparent les bonnes dates.
- Miniatures recréées à l'import (elles ne sont pas dans le ZIP).

## Conventions

- Interface en français, verbes d'action, messages d'erreur qui disent quoi faire.
- Style ISA-101 : couleur réservée aux anomalies (`--alarm` rouge, `--warn` ambre).
- Cibles tactiles ≥ 56 px, action principale dans `#actionbar` en bas.
- Tout contenu injecté en `innerHTML` passe par `escHtml()`.
- EXIF lu AVANT la conversion canvas.

## Tester en local

Le serveur de prévisualisation (`mes-notes`, port 3000) sert le dossier parent :
http://localhost:3000/plaques-moteurs/
