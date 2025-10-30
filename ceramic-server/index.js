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
                                                      FOREIGN KEY (scheduleId) REFERENCES schedules(id)
            );
    `);

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

app.use(bodyparser());
app.use(cors());

app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} ${ctx.response.status} - ${ms}ms`);
});

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.response.body = { message: err.message || 'Unexpected error' };
        ctx.response.status = 500;
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    try {
        const token = url.parse(req.url, true).query.token;
        if (!token) {
            ws.terminate();
            return;
        }

        const user = jwt.verify(token, SECRET_KEY);
        ws.userId = user.id;
        console.log(`WebSocket client connected: user ${ws.userId}`);

    } catch (err) {
        console.log('WebSocket auth failed:', err.message);
        ws.terminate();
    }
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

router.post('/register', async ctx => {
    const db = await dbPromise;
    const { username, password } = ctx.request.body;
    if (!username || !password) { ctx.response.status = 400; ctx.response.body = { message: 'Username and password are required.' }; return; }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        ctx.response.status = 201;
        ctx.response.body = { message: 'User created successfully', userId: result.lastID };
    } catch (err) {
        ctx.response.status = 409; ctx.response.body = { message: 'Username already taken.' };
    }
});

router.post('/login', async ctx => {
    const db = await dbPromise;
    const { username, password } = ctx.request.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) { ctx.response.status = 401; ctx.response.body = { message: 'Invalid credentials.' }; return; }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) { ctx.response.status = 401; ctx.response.body = { message: 'Invalid credentials.' }; return; }
    const payload = { id: user.id, username: user.username };
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '3h' });
    ctx.response.body = { message: 'Logged in successfully', token: token };
});

const authMiddleware = async (ctx, next) => {
    const authHeader = ctx.request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) { ctx.response.status = 401; ctx.response.body = { message: 'No token provided.' }; return; }
    try {
        const user = jwt.verify(token, SECRET_KEY);
        ctx.state.user = user;
        await next();
    } catch (err) {
        ctx.response.status = 403; ctx.response.body = { message: 'Invalid token.' };
    }
};

router.post('/schedules', authMiddleware, async ctx => {
    const db = await dbPromise;
    const { name, date, hour, objectType, status } = ctx.request.body;
    const loggedInUserId = ctx.state.user.id;

    const result = await db.run(
        'INSERT INTO schedules (clientId, name, date, hour, objectType, status) VALUES (?, ?, ?, ?, ?, ?)',
        [loggedInUserId, name, new Date(date).toISOString(), new Date(hour).toISOString(), objectType, status]
    );
    const newScheduleId = result.lastID;

    await db.run(
        'INSERT INTO ceramicObjects (scheduleId, name, creationDate, currentStage, remindersScheduled) VALUES (?, ?, ?, ?, ?)',
        [newScheduleId, `My ${objectType}`, new Date().toISOString(), 'modeling', 1]
    );

    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [newScheduleId]);
    ctx.response.body = schedule;
    ctx.response.status = 201;
    broadcast({ event: 'created', payload: { schedule } }, loggedInUserId);
});

router.get('/schedules', authMiddleware, async ctx => {
    const db = await dbPromise;
    const { date } = ctx.query;
    const now = new Date().toISOString();
    const loggedInUserId = ctx.state.user.id;

    await db.run(
        `UPDATE schedules SET status = 'In Progress' WHERE status = 'Scheduled' AND hour < ? AND clientId = ?`,
        [now, loggedInUserId]
    );

    let query = 'SELECT * FROM schedules WHERE clientId = ?';
    const params = [loggedInUserId];

    if (date) {
        query += ' AND date(date) = date(?)';
        params.push(new Date(date).toISOString());
    }
    query += ' ORDER BY hour ASC';

    const result = await db.all(query, params);
    ctx.response.body = result;
    ctx.response.status = 200;
});

router.delete('/schedules/:id', authMiddleware, async ctx => {
    const db = await dbPromise;
    const loggedInUserId = ctx.state.user.id;
    const { id } = ctx.params; // ID-ul programării de șters

    try {
        const schedule = await db.get(
            `SELECT id FROM schedules WHERE id = ? AND clientId = ?`,
            [id, loggedInUserId]
        );

        if (!schedule) {
            ctx.response.status = 404;
            ctx.response.body = { message: 'Schedule not found or access denied.' };
            return;
        }

        await db.run(`DELETE FROM ceramicObjects WHERE scheduleId = ?`, [id]);

        await db.run(`DELETE FROM schedules WHERE id = ?`, [id]);

        ctx.response.status = 200;
        ctx.response.body = { message: 'Schedule canceled successfully.' };

    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Failed to cancel schedule.', error: err.message };
    }
});

router.put('/schedules/:id', authMiddleware, async ctx => {
    const db = await dbPromise;
    const loggedInUserId = ctx.state.user.id;
    const { id } = ctx.params; // ID-ul programării de modificat
    const { hour } = ctx.request.body; // Noua oră

    if (!hour) {
        ctx.response.status = 400;
        ctx.response.body = { message: 'New hour is required.' };
        return;
    }

    try {
        const result = await db.run(
            `UPDATE schedules SET hour = ? WHERE id = ? AND clientId = ?`,
            [new Date(hour).toISOString(), id, loggedInUserId]
        );

        if (result.changes === 0) {
            ctx.response.status = 404;
            ctx.response.body = { message: 'Schedule not found or access denied.' };
            return;
        }

        const updatedSchedule = await db.get('SELECT * FROM schedules WHERE id = ?', [id]);
        ctx.response.body = updatedSchedule;

    } catch (err) {
        ctx.response.status = 500;
        ctx.response.body = { message: 'Failed to update time.', error: err.message };
    }
});

router.get('/ceramic-objects', authMiddleware, async ctx => {
    const db = await dbPromise;
    const loggedInUserId = ctx.state.user.id;

    const allObjects = await db.all(`
        SELECT co.* FROM ceramicObjects co
        JOIN schedules s ON co.scheduleId = s.id
        WHERE s.clientId = ?
    `, [loggedInUserId]);

    ctx.response.body = allObjects.map(obj => ({ ...obj, remindersScheduled: !!obj.remindersScheduled }));
    ctx.response.status = 200;
});

router.get('/ceramic-objects/:scheduleId', authMiddleware, async ctx => {
    const db = await dbPromise;
    const loggedInUserId = ctx.state.user.id;
    const { scheduleId } = ctx.params;

    const ceramicObject = await db.get(`
        SELECT co.* FROM ceramicObjects co
        JOIN schedules s ON co.scheduleId = s.id
        WHERE co.scheduleId = ? AND s.clientId = ?
    `, [scheduleId, loggedInUserId]);

    if (ceramicObject) {
        ctx.response.body = { ...ceramicObject, remindersScheduled: !!ceramicObject.remindersScheduled };
    } else {
        ctx.response.body = { message: 'Object not found or access denied' };
        ctx.response.status = 404;
    }
});

router.put('/ceramic-objects/:scheduleId', authMiddleware, async ctx => {
    const db = await dbPromise;
    const loggedInUserId = ctx.state.user.id;
    const { scheduleId } = ctx.params;
    const { remindersScheduled } = ctx.request.body;

    const result = await db.run(`
        UPDATE ceramicObjects SET remindersScheduled = ? 
        WHERE scheduleId = ? AND EXISTS (
            SELECT 1 FROM schedules s 
            WHERE s.id = ceramicObjects.scheduleId AND s.clientId = ?
        )
    `, [remindersScheduled ? 1 : 0, scheduleId, loggedInUserId]);

    if (result.changes > 0) {
        const updatedObject = await db.get('SELECT * FROM ceramicObjects WHERE scheduleId = ?', [scheduleId]);
        ctx.response.body = { ...updatedObject, remindersScheduled: !!updatedObject.remindersScheduled };
    } else {
        ctx.response.body = { message: 'Object not found or access denied' };
        ctx.response.status = 404;
    }
});

router.get('/notifications', authMiddleware, async ctx => {
    const db = await dbPromise;
    const loggedInUserId = ctx.state.user.id;

    const allNotifications = await db.all(`
        SELECT n.* FROM notifications n
        JOIN schedules s ON n.scheduleId = s.id
        WHERE s.clientId = ?
        ORDER BY n.timestamp ASC
    `, [loggedInUserId]);

    if (allNotifications.length > 0) {
        const idsToDelete = allNotifications.map(n => n.id);
        await db.run(`DELETE FROM notifications WHERE id IN (${idsToDelete.map(() => '?').join(',')})`, idsToDelete);
    }

    ctx.response.body = allNotifications;
    ctx.response.status = 200;
});

router.get('/availability', async ctx => {
    const db = await dbPromise;
    const { date } = ctx.query;
    const targetDate = new Date(date);

    const startHour = 10, endHour = 22;
    const slots = Array.from({ length: endHour - startHour }, (_, i) => `${(startHour + i).toString().padStart(2, '0')}:00`);

    const occupiedRows = await db.all(
        'SELECT hour FROM schedules WHERE date(date) = date(?)',
        [targetDate.toISOString()]
    );

    const occupied = occupiedRows.map(s => new Date(s.hour).toTimeString().slice(0, 5));
    ctx.response.body = slots.filter(s => !occupied.includes(s));
});

app.use(router.routes());
app.use(router.allowedMethods());

const stages = ['modeling', 'drying', 'burning', 'painting', 'glazing', 'finished'];

setInterval(async () => {
    try {
        const db = await dbPromise;
        const now = new Date().toISOString();

        const eligibleObjects = await db.all(`
            SELECT co.*, s.clientId FROM ceramicObjects co
                                             JOIN schedules s ON s.id = co.scheduleId
            WHERE s.hour < ? AND co.currentStage != 'finished'
        `, [now]);

        if (eligibleObjects.length > 0) {
            const randomIndex = Math.floor(Math.random() * eligibleObjects.length);
            const objectToUpdate = eligibleObjects[randomIndex];

            const currentStageIndex = stages.indexOf(objectToUpdate.currentStage);

            if (currentStageIndex < stages.length - 1) {
                const newStage = stages[currentStageIndex + 1];

                await db.run('UPDATE ceramicObjects SET currentStage = ? WHERE id = ?', [
                    newStage, objectToUpdate.id
                ]);

                let scheduleStatus = (newStage === 'finished') ? 'Finished' : 'In Progress';
                await db.run('UPDATE schedules SET status = ? WHERE id = ?', [
                    scheduleStatus, objectToUpdate.scheduleId
                ]);

                if (newStage === 'painting' || newStage === 'finished') {
                    let message = '';
                    if (newStage === 'painting') {
                        message = `Your object "${objectToUpdate.name}" is now ready for painting.`;
                    } else if (newStage === 'finished') {
                        message = `Your object "${objectToUpdate.name}" is finished and ready for pickup!`;
                    }
                    await db.run(
                        'INSERT INTO notifications (scheduleId, name, currentStage, message, timestamp) VALUES (?, ?, ?, ?, ?)',
                        [objectToUpdate.scheduleId, objectToUpdate.name, newStage, message, new Date().toISOString()]
                    );
                }

                const updatedSchedule = await db.get('SELECT * FROM schedules WHERE id = ?', [objectToUpdate.scheduleId]);
                const updatedObject = await db.get('SELECT * FROM ceramicObjects WHERE id = ?', [objectToUpdate.id]);

                console.log(`Object ${updatedObject.name} progressed to ${updatedObject.currentStage}. Schedule status: ${updatedSchedule.status}`);

                broadcast({
                    event: 'stage_updated',
                    payload: { object: updatedObject, schedule: updatedSchedule }
                }, objectToUpdate.clientId); // Trimite notificarea doar la clientul corect
            }
        }
    } catch (err) {
        console.error('Error in simulator interval:', err);
    }
}, 15000);

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
    console.log('Database file created at ./ceramicflow.sqlite');
});