# Base44 Toolkit

Extension Chrome locale permettant d’exporter et d’examiner les fichiers de projet accessibles depuis une session Base44 authentifiée.

**Version 4.0.0 · Chrome Manifest V3 · ZIP64**

La version 4.0.0 ajoute un panneau latéral Chrome, une file d’export persistante, les exports par lots et des tâches pouvant être mises en pause puis reprises. Les fichiers sont stockés localement dans IndexedDB avant la création d’archives ZIP64. Un CRC-32 est calculé pour chaque entrée et un SHA-256 pour les fichiers jusqu’à 128 Mio.

Le centre de restauration fournit une procédure de récupération. L’écriture automatique dans Base44 reste désactivée tant qu’une interface d’import officielle et documentée n’est pas disponible.

[Consultez la documentation complète en anglais](../../README.md) pour l’installation, l’architecture, les tests et les limites.

**Remarque :** il ne s’agit pas d’une sauvegarde complète de la plateforme. Les bases de données, secrets, variables d’environnement et fichiers non exposés ne sont pas récupérés.
