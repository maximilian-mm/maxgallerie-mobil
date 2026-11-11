# MaxGallerie mobil

Handy-Ansicht zur Desktop-App MaxGallerie: zeigt Bilder und Videos aus OneDrive und filtert sie nach
Tags, Sammlungen, Sternen, Farben, Gerät und Ordner. Die App liest nur; sie ändert oder löscht nichts.

## So hängt es zusammen

- Die Desktop-App exportiert einen Katalog nach OneDrive (`Apps/MaxGallerie/katalog.json`).
- Diese Web-App meldet sich mit dem Microsoft-Konto an (Berechtigung `Files.Read`), lädt den Katalog
  und holt Vorschaubilder direkt von OneDrive. Bilder und Katalog laufen nie über diesen Webserver.
- Der Ordner `docs` enthält die fertig gebaute App und wird von GitHub Pages ausgeliefert.

## Einrichten

1. Bei Microsoft (Azure-Portal → App-Registrierungen) eine Registrierung anlegen, Plattform
   „Single-Page-Anwendung“, Umleitungs-URI = Adresse dieser App.
2. Die Anwendungs-ID beim ersten Start der App eintragen (oder fest in `src/config.ts`).

Ohne Anmeldung ausprobieren: `?demo` an die Adresse hängen.

## Entwickeln

```bash
npm install
npm run dev
npm run build
```
