# Compilare "Denti & Cura" per Windows

Il progetto è pronto per essere impacchettato come app desktop con Electron. L'app carica lo
stesso `Studio_Dentistico.html` di sempre: nessuna riscrittura, funziona identica a quella nel
browser, ma gira in una finestra propria, senza barra indirizzi, con icona e collegamento nel
menu Start su Windows.

## 1. Requisiti

- [Node.js](https://nodejs.org) LTS (18 o superiore) installato sul computer che compila.
- Da un Mac (come questo), per generare l'installer **.exe** (NSIS) serve anche **Wine**:
  ```bash
  brew install --cask wine-stable
  ```
  Se non vuoi installare Wine, puoi generare solo la versione **portable** (un unico .exe senza
  installazione), che non richiede Wine, oppure compilare direttamente su un PC Windows, oppure
  usare un runner Windows su GitHub Actions (il modo più pulito, vedi punto 4).

## 2. Primo avvio (per provare l'app come finestra desktop, anche su Mac)

```bash
cd "/Volumes/NVME_500/Progetti/Studio Dentistico"
npm install
npm start
```

Si apre la stessa app in una finestra nativa. **Dentro Electron i dati non usano più
`localStorage`**: vengono salvati cifrati in un file (`dati.enc`) nella cartella dati dell'app
(`%APPDATA%\Denti & Cura` su Windows, `~/Library/Application Support/Denti & Cura` su Mac),
cifrato con `safeStorage` di Electron tramite il portachiavi del sistema operativo (DPAPI su
Windows). Il file non è leggibile aprendolo con un editor di testo. Se l'app viene aperta invece
direttamente nel browser (doppio clic sull'HTML, senza Electron), continua a usare
`localStorage` come prima - il codice riconosce da solo in quale contesto si trova.

## 3. Generare l'installer Windows

```bash
npm run dist:win
```

Il risultato viene creato in `dist/`:
- `Denti & Cura Setup 1.0.0.exe` - installer (NSIS), con collegamento su desktop e menu Start.
- `Denti & Cura 1.0.0.exe` (portable) - un solo file eseguibile, nessuna installazione.

Se non hai installato Wine e la build NSIS fallisce, usa:
```bash
npm run dist:win:portable
```

## 4. Alternativa senza Wine: compilare su GitHub Actions

È già pronto il workflow `.github/workflows/build-windows.yml`: compila l'installer su un runner
Windows vero e gratuito di GitHub, senza bisogno di Wine né di un PC Windows.

Per usarlo:
1. Metti il progetto su GitHub (se non l'hai già fatto): `git init`, `git add -A`,
   `git commit -m "Denti & Cura"`, poi crea una repository su GitHub e fai il push.
2. Il workflow parte da solo ad ogni push su `main`/`master` che tocca i file dell'app, oppure
   avvialo a mano dalla scheda **Actions** della repository → "Build Windows installer" →
   **Run workflow**.
3. A build finita (qualche minuto), apri la run e scarica l'artifact
   **denti-e-cura-windows**: dentro trovi l'installer e la versione portable, pronti da inviare
   o installare su un PC Windows.

## 5. Icona dell'app

Non è ancora presente un'icona personalizzata. Electron userà quella di default. Per un'icona
tua: crea un file `build/icon.ico` (256x256, formato .ico multi-risoluzione) e aggiungi in
`package.json`, dentro `"win"`, la riga `"icon": "build/icon.ico"`.

## Backup automatico su cartella

Dentro Electron, "Scegli cartella di backup" nelle Impostazioni usa il dialogo nativo
(`dialog.showOpenDialog`) e il modulo `fs` di Node, gestiti dal processo main - non l'API del
browser. Ogni 2 ore viene copiata nella cartella scelta una copia del file `dati.enc`, già
cifrata, con nome tipo `backup-denti-cura-2026-09-12-1430.enc`. La cartella scelta e la data
dell'ultimo backup restano salvate in `backup-config.json` nella cartella dati dell'app, quindi
il backup automatico riparte da solo ad ogni riavvio, senza dover scegliere di nuovo la cartella.
Se l'app viene aperta invece direttamente nel browser (senza Electron), questa funzione usa
ancora l'API `showDirectoryPicker` di Chrome/Edge come fallback, con lo stesso comportamento di
prima.
