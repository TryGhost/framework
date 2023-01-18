const express = require('express');
const session = require('express-session');

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const multer = require('multer');
const upload = multer({dest: os.tmpdir()});

const readJSONFile = async function (name) {
    const data = await fs.readFile(path.join(__dirname, `${name}.json`), {encoding: 'utf8'});
    return JSON.parse(data);
};

const app = express();

const isLoggedIn = function (req, res, next) {
    if (req.session.loggedIn) {
        return next();
    }

    res.sendStatus(403);
};

app.use(express.json());

app.use(session({
    secret: 'verysecretstring',
    name: 'testauth',
    resave: false,
    saveUninitialized: false
}));

app.get('/', (req, res) => {
    return res.send('Hello World!');
});

/** An endpoint for checking headers and body gets sent */
app.post('/check/', (req, res) => {
    if (req.get('x-check')) {
        res.set('x-checked', true);
    }

    // express.json() ensures req.body is be an empty object
    return res.json(req.body);
});

/**
 * API Methods
 */

app.post('/api/session/', async (req, res) => {
    const user = await readJSONFile('user');

    if (req.body.username && req.body.password && req.body.username === user.username && req.body.password === user.password) {
        req.session.loggedIn = true;
        req.session.username = req.body.username;

        return res.sendStatus(200);
    }

    return res.sendStatus(401);
});

app.get('/api/foo/', isLoggedIn, async (req, res) => {
    const data = await readJSONFile('data');

    return res.json(data);
});

app.post('/api/ping/', async (req, res) => {
    return res.json(req.body);
});

app.post('/api/upload/', upload.single('image'), async (req, res) => {
    return res.json(req.file);
});

module.exports = app;
