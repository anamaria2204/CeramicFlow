# CeramiFlow – Programare & Urmărire Proces Ceramică

## 🎯 Descriere generală
CeramiFlow este o aplicație mobilă dezvoltată în **Ionic React** care permite utilizatorilor să se **programeze la sesiuni de creare a unui obiect ceramic** și să **urmărească întregul proces de producție** până la finalizare.  
Aplicația oferă **notificări, sincronizare offline/online, autentificare, servicii locale și externe**, îndeplinind toate cerințele proiectului.

---

## ✅ Obiective principale
- Programare sesiuni într-un atelier de ceramică
- Vizualizare proces de producție (etape)
- Reminder pentru fiecare etapă (ex: pictare, ardere finală)
- Stocare date offline + sincronizare online
- Autentificare utilizator
- Funcționalități moderne (hărți, cameră, animații)

---

## ✅ Funcționalități detaliate (conform cerințelor profesorului)

### 1. Afișare listă de item-uri
**Item principal:** Programare / Obiect ceramic
Proprietăți:
- `id` (numeric)
- `numeObiect` (string)
- `dataSesiune` (date)
- `etapaCurenta` (string / boolean)
- `esteFinalizat` (boolean)
- (opțional: preț, descriere, poză)

Lista afișează toate programările și statusul obiectului.

---

### 2. Adăugare / Editare item
- Formular pentru creare programare nouă
- Editare programare existentă
- Validări de câmpuri
- Salvare locală și online (sync când e conectat)

---

### 3. Autentificare utilizator
- Login / Register (email + parolă)
- Menținerea sesiunii
- Opțional: Firebase Auth

---

### 4. Suport offline
- Salvare item-uri în local storage / IndexedDB
- Aplicația funcționează fără internet
- Mark pentru item-uri nesincronizate

---

### 5. Suport online + sincronizare
- Conectare la server / API / Firebase
- La reconectare:
  - Se trimit modificările deja făcute
  - Se actualizează datele din cloud

---

### 6. Servicii externe
Exemple posibile:
- Afișare locație atelier pe **Google Maps**
- Navigare către atelier
- Trimitere email de confirmare către utilizator

---

### 7. Servicii locale (device)
Exemple posibile:
- Cameră – utilizatorul poate face poze obiectului creat
- Notificări locale – reminder pentru etape
- (Opțional) senzori telefon

---

### 8. Animații
- Animații de tranziție între pagini
- Animație pentru progresul etapelor (timeline / progres bar)
- Animarea apariției item-urilor în listă


## 🛠️ Tehnologii
- Ionic React
- Capacitor (Camera, Storage, Notifications, Network)
- IndexedDB / Capacitor Storage
- REST API / Firebase (backend)
- Google Maps API
- CSS / Ionic Animations


