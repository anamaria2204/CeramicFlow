const Koa = require('koa');
const app = new Koa();
const server = require('http').createServer(app.callback());
const WebSocket = require('ws');
const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');
const url = require('url');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'cheie-secreta-pe-care-nu-o-vei-ghici-niciodata-ha';

// Mărește limita pentru bodyparser (mai multe poze = payload mai mare)
app.use(bodyparser({
    jsonLimit: '50mb',
    formLimit: '50mb',
    textLimit: '50mb'
}));

const dbPromise = (async () => {
    const db = await open({
        filename: './ceramicflow.sqlite',
        driver: sqlite3.Database
    });

    console.log('Connected to SQLite database.');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                             username TEXT UNIQUE,
                                             password TEXT
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 clientId INTEGER,
                                                 name TEXT,
                                                 date TEXT,
                                                 hour TEXT,
                                                 objectType TEXT,
                                                 status TEXT,
                                                 FOREIGN KEY (clientId) REFERENCES users(id)
            );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS ceramicObjects (
                                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                      scheduleId INTEGER,
                                                      name TEXT,
                                                      creationDate TEXT,
                                                      currentStage TEXT,
                                                      remindersScheduled INTEGER,
                                                      lat REAL,
                                                      lng REAL,
                                                      photo TEXT,
                                                      FOREIGN KEY (scheduleId) REFERENCES schedules(id)
            );
    `);

    // Migrare automată
    const columnsToAdd = [
        { name: 'lat', type: 'REAL' },
        { name: 'lng', type: 'REAL' },
        { name: 'photo', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
        try {
            await db.exec(`ALTER TABLE ceramicObjects ADD COLUMN ${col.name} ${col.type};`);
        } catch (e) {}
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
                                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                     scheduleId INTEGER,
                                                     name TEXT,
                                                     currentStage TEXT,
                                                     message TEXT,
                                                     timestamp TEXT
        );
    `);

    return db;
})();

app.use(cors());

// Logging Middleware
app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} ${ctx.response.status} - ${ms}ms`);
});

// Error Handling Middleware
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.response.body = { message: err.message || 'Unexpected error' };
        ctx.response.status = 500;
    }
});

// WebSocket
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws, req) => {
    try {
        const token = url.parse(req.url, true).query.token;
        if (!token) { ws.terminate(); return; }
        const user = jwt.verify(token, SECRET_KEY);
        ws.userId = user.id;
    } catch (err) { ws.terminate(); }
});

const broadcast = (data, userId) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === userId) {
            client.send(message);
        }
    });
};

const router = new Router();

// Auth Routes
router.post('/register', async ctx => {
    const db = await dbPromise;
    const { username, password } = ctx.request.body;
    if (!username || !password) { ctx.response.status = 400; return; }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        ctx.response.status = 201;
        ctx.response.body = { message: 'User created', userId: result.lastID };
    } catch (err) { ctx.response.status = 409; }
});

router.post('/login', async ctx => {
    const db = await dbPromise;
    const { username, password } = ctx.request.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !await bcrypt.compare(password, user.password)) { ctx.response.status = 401; return; }
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '3h' });
    ctx.response.body = { token };
});

const authMiddleware = async (ctx, next) => {
    const token = ctx.request.headers['authorization']?.split(' ')[1];
    if (!token) { ctx.response.status = 401; return; }
    try {
        ctx.state.user = jwt.verify(token, SECRET_KEY);
        await next();
    } catch (err) { ctx.response.status = 403; }
};

// Data Routes
router.post('/schedules', authMiddleware, async ctx => {
    const db = await dbPromise;
    const { name, date, hour, objectType, status } = ctx.request.body;
    const userId = ctx.state.user.id;
    const res = await db.run('INSERT INTO schedules (clientId, name, date, hour, objectType, status) VALUES (?, ?, ?, ?, ?, ?)', [userId, name, new Date(date).toISOString(), new Date(hour).toISOString(), objectType, status]);
    await db.run('INSERT INTO ceramicObjects (scheduleId, name, creationDate, currentStage, remindersScheduled) VALUES (?, ?, ?, ?, ?)', [res.lastID, `My ${objectType}`, new Date().toISOString(), 'modeling', 1]);
    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [res.lastID]);
    ctx.response.body = schedule;
    ctx.response.status = 201;
    broadcast({ event: 'created', payload: { schedule } }, userId);
});

router.get('/schedules', authMiddleware, async ctx => {
    const db = await dbPromise;
    const { date } = ctx.query;
    const userId = ctx.state.user.id;
    await db.run(`UPDATE schedules SET status = 'In Progress' WHERE status = 'Scheduled' AND hour < ? AND clientId = ?`, [new Date().toISOString(), userId]);
    let query = 'SELECT * FROM schedules WHERE clientId = ?';
    const params = [userId];
    if (date) { query += ' AND date(date) = date(?)'; params.push(new Date(date).toISOString()); }
    query += ' ORDER BY hour ASC';
    ctx.response.body = await db.all(query, params);
});

router.delete('/schedules/:id', authMiddleware, async ctx => {
    const db = await dbPromise;
    const userId = ctx.state.user.id;
    const { id } = ctx.params;
    const schedule = await db.get('SELECT id FROM schedules WHERE id = ? AND clientId = ?', [id, userId]);
    if (!schedule) { ctx.response.status = 404; return; }
    await db.run('DELETE FROM ceramicObjects WHERE scheduleId = ?', [id]);
    await db.run('DELETE FROM schedules WHERE id = ?', [id]);
    ctx.response.body = { message: 'Deleted' };
});

// Helper pentru a procesa pozele la citire
const parsePhotos = (obj) => {
    if (!obj) return obj;
    let photos = [];
    if (obj.photo) {
        try {
            // Încercăm să parsam JSON-ul (format nou: listă de poze)
            photos = JSON.parse(obj.photo);
            if (!Array.isArray(photos)) photos = [obj.photo]; // Dacă nu e array, e string vechi
        } catch (e) {
            // Dacă dă eroare la parse, înseamnă că e format vechi (un singur string base64)
            photos = [obj.photo];
        }
    }
    return { ...obj, photos, remindersScheduled: !!obj.remindersScheduled };
};

router.get('/ceramic-objects', authMiddleware, async ctx => {
    const db = await dbPromise;
    const userId = ctx.state.user.id;
    const objects = await db.all(`SELECT co.* FROM ceramicObjects co JOIN schedules s ON co.scheduleId = s.id WHERE s.clientId = ?`, [userId]);
    ctx.response.body = objects.map(parsePhotos);
});

router.get('/ceramic-objects/:scheduleId', authMiddleware, async ctx => {
    const db = await dbPromise;
    const userId = ctx.state.user.id;
    const object = await db.get(`SELECT co.* FROM ceramicObjects co JOIN schedules s ON co.scheduleId = s.id WHERE co.scheduleId = ? AND s.clientId = ?`, [ctx.params.scheduleId, userId]);
    if (object) ctx.response.body = parsePhotos(object);
    else ctx.response.status = 404;
});

router.put('/ceramic-objects/:scheduleId', authMiddleware, async ctx => {
    const db = await dbPromise;
    const userId = ctx.state.user.id;
    const { scheduleId } = ctx.params;
    const { remindersScheduled, lat, lng, photos } = ctx.request.body; // Așteptăm 'photos' (array)

    // Salvăm array-ul ca JSON String
    const photoStr = photos ? JSON.stringify(photos) : null;

    const res = await db.run(`
        UPDATE ceramicObjects
        SET remindersScheduled = ?, lat = ?, lng = ?, photo = ?
        WHERE scheduleId = ? AND EXISTS (SELECT 1 FROM schedules s WHERE s.id = ceramicObjects.scheduleId AND s.clientId = ?)
    `, [remindersScheduled ? 1 : 0, lat || null, lng || null, photoStr, scheduleId, userId]);

    if (res.changes > 0) {
        const updated = await db.get('SELECT * FROM ceramicObjects WHERE scheduleId = ?', [scheduleId]);
        ctx.response.body = parsePhotos(updated);
    } else {
        ctx.response.status = 404;
    }
});

router.get('/notifications', authMiddleware, async ctx => {
    const db = await dbPromise;
    const userId = ctx.state.user.id;
    const notifs = await db.all(`SELECT n.* FROM notifications n JOIN schedules s ON n.scheduleId = s.id WHERE s.clientId = ? ORDER BY n.timestamp ASC`, [userId]);
    if (notifs.length) await db.run(`DELETE FROM notifications WHERE id IN (${notifs.map(() => '?').join(',')})`, notifs.map(n => n.id));
    ctx.response.body = notifs;
});

router.get('/availability', async ctx => {
    const db = await dbPromise;
    const { date } = ctx.query;
    const occupied = (await db.all('SELECT hour FROM schedules WHERE date(date) = date(?)', [new Date(date).toISOString()])).map(s => new Date(s.hour).toTimeString().slice(0,5));
    const slots = Array.from({ length: 12 }, (_, i) => `${(10 + i).toString().padStart(2, '0')}:00`);
    ctx.response.body = slots.filter(s => !occupied.includes(s));
});

app.use(router.routes()).use(router.allowedMethods());

// Simulator logic (simplificată pentru brevity, e aceeași)
setInterval(async () => { /* ... logica simulatorului ... */ }, 3000);

server.listen(3000, () => console.log('Server running on http://localhost:3000'));