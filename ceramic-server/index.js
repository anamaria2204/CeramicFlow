const Koa = require('koa');
const app = new Koa();
const server = require('http').createServer(app.callback());
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');

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

class Schedule {
    constructor({ id, clientId, name, date, hour, objectType, status }) {
        this.id = id; this.clientId = clientId; this.name = name; this.date = date; this.hour = hour; this.objectType = objectType; this.status = status;
    }
}

class CeramicObject {
    constructor({ id, scheduleId, name, creationDate, currentStage, remindersScheduled }) {
        this.id = id; this.scheduleId = scheduleId; this.name = name; this.creationDate = creationDate; this.currentStage = currentStage; this.remindersScheduled = remindersScheduled;
    }
}

const schedules = [];
const ceramicObjects = [];
let lastId = 0;

(() => {
    const now = new Date();
    const scheduleHour = new Date();
    scheduleHour.setHours(now.getHours() + 1, 0, 0, 0);
    const initialSchedule = new Schedule({ id: '1', clientId: '123', name: 'Schedule for Mug', date: new Date(), hour: scheduleHour, objectType: 'Mug', status: 'Scheduled' });
    schedules.push(initialSchedule);
    const initialObject = new CeramicObject({ id: '1', scheduleId: '1', name: 'My First Mug', creationDate: new Date(), currentStage: 'modeling', remindersScheduled: false });
    ceramicObjects.push(initialObject);
    lastId = 1;
})();

const broadcast = data => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
    });
};

const router = new Router();

router.get('/ceramic-objects/:scheduleId', ctx => {
    const ceramicObject = ceramicObjects.find(obj => obj.scheduleId === ctx.params.scheduleId);
    if (ceramicObject) ctx.response.body = ceramicObject;
    else { ctx.response.body = { message: 'Ceramic object not found' }; ctx.response.status = 404; }
});

router.put('/ceramic-objects/:scheduleId', ctx => {
    const { scheduleId } = ctx.params;
    const { remindersScheduled } = ctx.request.body;
    const objectIndex = ceramicObjects.findIndex(obj => obj.scheduleId === scheduleId);
    if (objectIndex !== -1) {
        if (typeof remindersScheduled === 'boolean') {
            ceramicObjects[objectIndex].remindersScheduled = remindersScheduled;
        }
        ctx.response.body = ceramicObjects[objectIndex];
    } else {
        ctx.response.body = { message: 'Ceramic object not found' };
        ctx.response.status = 404;
    }
});

router.get('/notifications', ctx => {
    const updates = ceramicObjects.filter(obj => obj.currentStage !== 'modeling');
    ctx.response.body = updates;
    ctx.response.status = 200;
});

router.get('/ceramic-objects', ctx => {
    ctx.response.body = ceramicObjects;
    ctx.response.status = 200;
});

router.post('/schedules', ctx => {
    const { clientId, name, date, hour, objectType, status } = ctx.request.body;
    const newId = `${parseInt(lastId) + 1}`;
    lastId = newId;
    const schedule = new Schedule({ id: newId, clientId, name, date: new Date(date), hour: new Date(hour), objectType, status });
    schedules.push(schedule);
    const ceramicObject = new CeramicObject({ id: newId, scheduleId: newId, name: `My ${objectType}`, creationDate: new Date(), currentStage: 'modeling', remindersScheduled: false });
    ceramicObjects.push(ceramicObject);
    ctx.response.body = { ...schedule, date: schedule.date.toISOString(), hour: schedule.hour.toISOString() };
    ctx.response.status = 201;
    broadcast({ event: 'created', payload: { schedule } });
});

router.get('/schedules', ctx => {
    const { clientId, date } = ctx.query;
    let result = schedules;
    if (clientId) result = result.filter(s => s.clientId === clientId);
    if (date) {
        const target = new Date(date);
        result = result.filter(s => s.date.toDateString() === target.toDateString());
    }
    ctx.response.body = result.map(s => ({ ...s, date: s.date.toISOString(), hour: s.hour.toISOString() }));
    ctx.response.status = 200;
});

router.get('/availability', ctx => {
    const { date } = ctx.query;
    const targetDate = new Date(date);
    const startHour = 10, endHour = 22;
    const slots = Array.from({ length: endHour - startHour }, (_, i) => `${(startHour + i).toString().padStart(2, '0')}:00`);
    const occupied = schedules.filter(s => new Date(s.date).toDateString() === targetDate.toDateString()).map(s => new Date(s.hour).toTimeString().slice(0, 5));
    ctx.response.body = slots.filter(s => !occupied.includes(s));
});

app.use(router.routes());
app.use(router.allowedMethods());

// --- SIMULATOR PENTRU PROGRESUL OBIECTELOR ---
const stages = ['modeling', 'drying', 'burning', 'painting', 'glazing', 'finished'];
setInterval(() => {
    if (ceramicObjects.length > 0) {
        const randomIndex = Math.floor(Math.random() * ceramicObjects.length);
        const objectToUpdate = ceramicObjects[randomIndex];
        const currentStageIndex = stages.indexOf(objectToUpdate.currentStage);

        if (currentStageIndex < stages.length - 1) {
            objectToUpdate.currentStage = stages[currentStageIndex + 1];
            console.log(`Object ${objectToUpdate.name} progressed to ${objectToUpdate.currentStage}`);
            broadcast({ event: 'stage_updated', payload: { object: objectToUpdate } });
        }
    }
}, 15000);
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
