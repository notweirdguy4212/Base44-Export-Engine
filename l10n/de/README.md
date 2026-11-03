# Base44 Toolkit

Eine lokale Chrome-Erweiterung zum Exportieren und Prüfen von Projektdateien, die eine angemeldete Base44-Sitzung bereitstellt.

**Version 4.0.0 · Chrome Manifest V3 · ZIP64**

Die Version 4.0.0 bietet eine Chrome-Seitenleiste, eine dauerhaft gespeicherte Exportwarteschlange, Batch-Exporte, pausierbare und fortsetzbare Jobs sowie ZIP64-Archive. Dateien werden lokal in IndexedDB zwischengespeichert. CRC-32 wird für alle Archivdateien berechnet; SHA-256 wird für Dateien bis 128 MiB erstellt.

Das Wiederherstellungszentrum stellt einen Ablaufplan bereit. Ein automatischer Schreib-/Importadapter bleibt deaktiviert, bis Base44 eine dokumentierte, unterstützte Importschnittstelle anbietet.

[Die vollständige englische Dokumentation](../../README.md) enthält Installationsanweisungen, Architektur, Tests und Einschränkungen.

**Hinweis:** Dies ist kein vollständiges Plattform-Backup. Datenbanken, Geheimnisse, Umgebungsvariablen und nicht zugängliche Dateien werden nicht wiederhergestellt.
