# Base44 Toolkit

Extensión local de Chrome para exportar y revisar los archivos de proyecto que expone una sesión autenticada de Base44.

**Versión 4.0.0 · Chrome Manifest V3 · ZIP64**

La versión 4.0.0 incorpora un panel lateral de Chrome, una cola de exportación persistente, exportaciones por lotes y trabajos que se pueden pausar y reanudar. Los archivos se preparan localmente en IndexedDB y se empaquetan en archivos ZIP64. Se calcula CRC-32 para cada entrada y SHA-256 para archivos de hasta 128 MiB.

El centro de restauración incluye una guía de recuperación. La escritura automática en Base44 permanece desactivada hasta que exista una interfaz oficial y documentada de importación.

[Consulta la documentación completa en inglés](../../README.md) para la instalación, la arquitectura, las pruebas y las limitaciones.

**Nota:** No es una copia de seguridad completa de la plataforma. No recupera bases de datos, secretos, variables de entorno ni archivos que Base44 no exponga.
