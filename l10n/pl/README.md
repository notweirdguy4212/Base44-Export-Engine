# Base44 Toolkit

Lokalne rozszerzenie Chrome do eksportowania i analizowania plików projektu udostępnianych przez uwierzytelnioną sesję Base44.

**Wersja 4.0.0 · Chrome Manifest V3 · ZIP64**

Wersja 4.0.0 dodaje panel boczny Chrome, trwałą kolejkę eksportów, eksport wsadowy oraz zadania, które można wstrzymywać i wznawiać. Pliki są lokalnie przechowywane w IndexedDB, a następnie pakowane do archiwum ZIP64. Dla każdego wpisu obliczany jest CRC-32, a SHA-256 dla plików do 128 MiB.

Centrum przywracania udostępnia instrukcję odzyskiwania. Automatyczny zapis do Base44 pozostaje wyłączony do czasu udostępnienia oficjalnego, udokumentowanego interfejsu importu.

[Pełna dokumentacja po angielsku](../../README.md) opisuje instalację, architekturę, testy i ograniczenia.

**Uwaga:** To nie jest pełna kopia zapasowa platformy. Narzędzie nie odzyskuje baz danych, sekretów, zmiennych środowiskowych ani plików niedostępnych w projekcie.
