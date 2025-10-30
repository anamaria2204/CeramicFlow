const Koa = require('koa');
const app = new Koa();
const server = require('http').createServer(app.callback());
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const dbPromise = (async () => {
    const db = await open({
        filename: './ceramicflow.sqlite',
        driver: sqlite3.Database
    });

    console.log('Connected to SQLite database.');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 clientId TEXT,
                                                 name TEXT,
                                                 date TEXT,
                                                 hour TEXT,
                                                 objectType TEXT,
                                                 status TEXT
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

const broadcast = data => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
    });
};

const router = new Router();

router.get('/ceramic-objects/:scheduleId', async ctx => {
    const db = await dbPromise;
    const ceramicObject = await db.get('SELECT * FROM ceramicObjects WHERE scheduleId = ?', [ctx.params.scheduleId]);

    if (ceramicObject) {
        ctx.response.body = { ...ceramicObject, remindersScheduled: !!ceramicObject.remindersScheduled };
    } else {
        ctx.response.body = { message: 'Ceramic object not found' };
        ctx.response.status = 404;
    }
});

router.put('/ceramic-objects/:scheduleId', async ctx => {
    const db = await dbPromise;
    const { scheduleId } = ctx.params;
    const { remindersScheduled } = ctx.request.body;

    const result = await db.run('UPDATE ceramicObjects SET remindersScheduled = ? WHERE scheduleId = ?', [
        remindersScheduled ? 1 : 0,
        scheduleId
    ]);

    if (result.changes > 0) {
        const updatedObject = await db.get('SELECT * FROM ceramicObjects WHERE scheduleId = ?', [scheduleId]);
        ctx.response.body = { ...updatedObject, remindersScheduled: !!updatedObject.remindersScheduled };
    } else {
        ctx.response.body = { message: 'Ceramic object not found' };
        ctx.response.status = 404;
    }
});

router.get('/notifications', async ctx => {
    const db = await dbPromise;
    const allNotifications = await db.all('SELECT * FROM notifications ORDER BY timestamp ASC');
    await db.run('DELETE FROM notifications');

    ctx.response.body = allNotifications;
    ctx.response.status = 200;
});

router.get('/ceramic-objects', async ctx => {
    const db = await dbPromise;
    const allObjects = await db.all('SELECT * FROM ceramicObjects');
    ctx.response.body = allObjects.map(obj => ({ ...obj, remindersScheduled: !!obj.remindersScheduled }));
    ctx.response.status = 200;
});

router.post('/schedules', async ctx => {
    const db = await dbPromise;
    const { clientId, name, date, hour, objectType, status } = ctx.request.body;

    const result = await db.run(
        'INSERT INTO schedules (clientId, name, date, hour, objectType, status) VALUES (?, ?, ?, ?, ?, ?)',
        [clientId, name, new Date(date).toISOString(), new Date(hour).toISOString(), objectType, status]
    );

    const newScheduleId = result.lastID;

    // MODIFICARE: Mementourile sunt setate pe '1' (On) în mod implicit
    await db.run(
        'INSERT INTO ceramicObjects (scheduleId, name, creationDate, currentStage, remindersScheduled) VALUES (?, ?, ?, ?, ?)',
        [newScheduleId, `My ${objectType}`, new Date().toISOString(), 'modeling', 1]
    );

    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [newScheduleId]);

    ctx.response.body = schedule;
    ctx.response.status = 201;
    broadcast({ event: 'created', payload: { schedule } });
});

router.get('/schedules', async ctx => {
    const db = await dbPromise;
    const { clientId, date } = ctx.query;
    const now = new Date().toISOString();

    // --- MODIFICARE ---
    // Actualizează automat statusul programărilor a căror oră a trecut, înainte de a le trimite
    await db.run(
        `UPDATE schedules 
         SET status = 'In Progress' 
         WHERE status = 'Scheduled' AND hour < ?`,
        [now]
    );
    // --- SFÂRȘIT MODIFICARE ---

    // Acum preia lista actualizată
    let query = 'SELECT * FROM schedules';
    const params = [];
    const conditions = [];

    if (clientId) {
        conditions.push('clientId = ?');
        params.push(clientId);
    }
    if (date) {
        conditions.push('date(date) = date(?)');
        params.push(new Date(date).toISOString());
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY hour ASC'; // Sortăm lista

    const result = await db.all(query, params);
    ctx.response.body = result;
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

// Simulatorul de ETAPE (nu de status)
setInterval(async () => {
    try {
        const db = await dbPromise;
        const now = new Date().toISOString();

        const eligibleObjects = await db.all(`
            SELECT co.* FROM ceramicObjects co
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
                    newStage,
                    objectToUpdate.id
                ]);

                let scheduleStatus = (newStage === 'finished') ? 'Finished' : 'In Progress';
                await db.run('UPDATE schedules SET status = ? WHERE id = ?', [
                    scheduleStatus,
                    objectToUpdate.scheduleId
                ]);

                // --- MODIFICARE NOTIFICĂRI ---
                // Trimitem notificări doar pentru etapele cheie
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
                });
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