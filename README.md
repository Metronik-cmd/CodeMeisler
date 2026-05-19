# Meisler Probeaufgabe

Start:

```bash
npm install
npm run dev
```

Build fuer den Server:

```bash
npm run build
```

## Hotkeys

`F6` macht das Fenster auf und wieder zu.
`B` ist Noclip, geht aber nur wenn Aduty aktiv ist.

## Eventss

Client -> Browser:

- `client:playerInfo`
- `client:adminMessage`

Browser -> Client:

- `ui:copyPos`
- `ui:toggleMarker`
- `ui:toggleAduty`
- `ui:toggleNoclip`
- `ui:spawnVehicle`
- `ui:close`

Client -> Server:

- `admin:toggleDuty`
- `admin:spawnVehicle`

## mp.storage

Gespeichert wird:

- `probeShowMarker`
- `probeLastVehicle`

Also ob der Marker an ist und welches Fahrzeug zuletzt gespawnt wurde:D
