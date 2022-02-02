const express = require('express');
const session = require('express-session');

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

app.post('/api/session/', async (req, res) => {
    if (req.body.username && req.body.password && req.body.username === 'hello' && req.body.password === 'world') {
        req.session.loggedIn = true;
        req.session.username = req.body.username;
        return res.sendStatus(200);
    }

    return res.sendStatus(401);
});

app.get('/api/foo/', isLoggedIn, async (req, res) => {
    const json = {
        foo: [{
            bar: 'baz'
        }]
    };
    return res.json(json);
});

module.exports = app;
