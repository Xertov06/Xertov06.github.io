# BR — suivi personnel hors connexion

Application web sans dépendance ni compilation (HTML, CSS, JavaScript). Les données restent sur l'appareil, dans le stockage local du navigateur. Aucune requête réseau n'est faite.

## Lancer l'application

- **Le plus simple** : double-cliquer sur `index.html`. Tout fonctionne, hors connexion compris.
- **Pour l'installer comme une application** (PWA, icône sur l'écran d'accueil, cache hors connexion) : servir le dossier en local, puis ouvrir l'adresse dans Chrome, Edge ou Safari.
  ```
  python -m http.server 8000
  ```
  Ouvrir ensuite http://localhost:8000 et choisir « Installer l'application » dans le navigateur.

> Les données sont propres à chaque navigateur et à chaque adresse : `file://…` et `http://localhost:8000` ont chacun leur stockage. Pour passer de l'un à l'autre, utiliser **Réglages → Exporter / Importer**.

## Pages

| Page | Contenu |
|---|---|
| Accueil | Saisie rapide (stepper + « Enregistrer maintenant »), chiffres du jour, de la semaine et du mois, 14 derniers jours, dernières saisies, raccourcis vers les statistiques |
| Historique | Saisies regroupées par jour, filtre par mois, recherche dans les notes, modification et suppression (avec « Annuler ») |
| Statistiques → **Activité annuelle** | Calendrier thermique d'une année, navigation entre les années, légende par niveaux, détail d'une journée au clic ou au clavier (flèches), récapitulatif de l'année, graphique mois par mois |
| Statistiques → **Comparateur** | Deux journées, semaines, mois, années ou périodes libres ; total, moyenne quotidienne, jours actifs, journée la plus active, saisies, heure la plus active ; écart (B − A) et évolution en % ; répartition horaire et évolution comparées, avec vue tableau |
| Statistiques → **Mes records** | 9 records recalculés automatiquement, avec la date, le record précédent, l'écart et l'historique complet de chaque record |
| Réglages | Thème (auto, clair, sombre), export JSON et CSV, import (fusion ou remplacement), protection du stockage, suppression totale |

## Règles de calcul

- **Saisie** : une date, une heure, un nombre de BR (de 1 à 9999) et une note facultative. Les dates futures sont refusées.
- **Heatmap** : 5 niveaux. Le niveau 0 (couleur neutre) correspond aux jours sans événement. Les 4 autres niveaux sont des tranches égales jusqu'au maximum de l'année affichée ; la légende indique les plages exactes.
- **Comparateur** : A est la référence. Écart = B − A, évolution = (B − A) / A. Si A vaut 0, l'évolution est marquée « n.c. » (non calculable). La moyenne quotidienne ne compte que les jours déjà écoulés, pour qu'une période en cours ne soit pas pénalisée.
- **Records** : les données sont parcourues dans l'ordre chronologique. Un record est établi chaque fois qu'une valeur dépasse **strictement** le meilleur score précédent ; une égalité ne remplace pas le record mais est signalée (« égalé N fois »). Le record précédent et l'historique sont donc recalculés à partir des données présentes : ils sont conservés tant que les saisies concernées existent.
- **Période sans événement** : nombre de jours sans saisie entre deux jours actifs, ou depuis la dernière saisie jusqu'à aujourd'hui (signalée « en cours »).
- **Heure et jour de la semaine les plus fréquents** : calculés sur le nombre total de BR ; la comparaison se fait avec la 2ᵉ valeur.

## Structure

```
index.html            page unique et fenêtres de saisie et de confirmation
css/styles.css        identité visuelle, thèmes clair et sombre, animations, responsive
js/util.js            dates (index de jour sans fuseau horaire), formatage français, icônes
js/store.js           stockage local, import et export, synchronisation entre onglets
js/stats.js           calculs purs : périodes, heatmap, écarts, records
js/charts.js          graphiques SVG (barres, courbes, infobulles, vue tableau)
js/ui.js              notifications, formulaire de saisie, confirmation
js/views.js           Accueil, Historique, Réglages
js/heatmap.js         Activité annuelle
js/compare.js         Comparateur
js/records.js         Mes records
js/app.js             navigation, thème, détection des nouveaux records
sw.js                 cache hors connexion (incrémenter VERSION après chaque modification)
```

Les données sont stockées sous la clé `br.events.v1` du stockage local.
