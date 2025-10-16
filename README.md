# CeramiFlow – Programare & Urmărire Proces Ceramică

## 🎯 Descriere
CeramiFlow este o aplicație mobilă în **Ionic React** care permite utilizatorilor să se programeze la sesiuni de creare a unui obiect ceramic și să urmărească întregul proces până la finalizare. Include notificări, sincronizare offline/online, autentificare și servicii locale și externe.

---

## ✅ Entități principale

### Programare
- id (numeric)
- userId (string)
- dataProgramare (date)
- oraProgramare (string)
- tipObiect (string)
- status (programată, finalizată, anulată)

### ObiectCeramic
- id (numeric)
- programareId (numeric)
- nume / descriere (string)
- dataCreare (date)
- etapaCurentă (string: modelare, uscare, ardere, pictare, glazurare, finalizat)
- esteFinalizat (boolean)
- imagine (opțional)
- remindereProgramate (boolean)
- dataUltimeiActualizări (date)

---

## ✅ Funcționalități principale

1. **Programare sesiuni**
  - Creare / editare programare
  - Vizualizare lista programări viitoare
2. **Urmărire obiect ceramic**
  - Timeline / progres pe etape
  - Status actualizat automat
3. **Reminder / Notificări**
  - Notificări locale pentru fiecare etapă
4. **Autentificare**
  - Login / Register (email + parolă)
5. **Offline support**
  - Stocare locală a programărilor și obiectelor
6. **Online sync**
  - Sincronizare cu backend / Firebase când e conexiune
7. **Servicii externe**
  - Harta atelierului (Google Maps)
  - Trimitere email de confirmare
8. **Servicii locale**
  - Cameră pentru poze obiect
  - Notificări locale
9. **Animații**
  - Navigare între pagini
  - Progress bar / timeline animații

---

## 📱 Structura pagini
- Login / Register
- Dashboard (rezumat progres)
- Lista programări
- Detalii obiect ceramic + etape
- Creare / editare programare
- Hartă atelier
- Profil utilizator
- Galerie poze 
