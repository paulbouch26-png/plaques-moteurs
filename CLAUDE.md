# Plaques moteurs — PWA iPhone de relevé de plaques signalétiques

Cahier des charges d'origine : `PROMPT_Claude_Code_Plaques_Moteurs.md` (Downloads de Paul).
Principe : **une session = un moteur = une ligne Excel.**

## État

- [x] Phase 1 : Réglages, sessions, capture, stockage IndexedDB (sans IA)
- [ ] Phase 2 : analyse IA, écran de validation, file d'attente hors ligne
- [ ] Phase 3 : export Excel, lot ZIP, partage iOS
- [ ] Phase 4 : import et consolidation des lots
- [ ] Phase 5 : import de photos existantes (après tests terrain des phases 1 à 4)

## Fichiers

```
index.html             app complète (HTML + CSS + JS), commentée en français
sw.js                  cache hors ligne — changer CACHE à chaque version
manifest.webmanifest
icons/                 180 (iOS), 192, 512
vendor/                librairies figées, jamais de CDN à l'usage
  exifr.full.umd.js    7.1.3
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

## Conventions

- Interface en français, verbes d'action, messages d'erreur qui disent quoi faire.
- Style ISA-101 : couleur réservée aux anomalies (`--alarm` rouge, `--warn` ambre).
- Cibles tactiles ≥ 56 px, action principale dans `#actionbar` en bas.
- Tout contenu injecté en `innerHTML` passe par `escHtml()`.
- EXIF lu AVANT la conversion canvas.

## Tester en local

Le serveur de prévisualisation (`mes-notes`, port 3000) sert le dossier parent :
http://localhost:3000/plaques-moteurs/
