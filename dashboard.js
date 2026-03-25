/**
 * Aggie Connect — Dashboard v3.6
 * Public ride board at ridesplit.app
 * Port: 3004
 *
 * This file wires together middleware and routes.
 * Business logic lives in lib/, middleware/, and routes/.
 */

require('dotenv').config();

var express = require('express');
var cookieParser = require('cookie-parser');

// ── App setup ────────────────────────────────────────────────────────────

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/public', express.static(__dirname + '/public'));

// ── Routes ───────────────────────────────────────────────────────────────

app.use(require('./routes/public'));
app.use(require('./routes/clusters'));
app.use(require('./routes/auth'));
app.use(require('./routes/phone'));
app.use(require('./routes/submit'));
app.use(require('./routes/digest'));
app.use(require('./routes/static'));

// ── Start ────────────────────────────────────────────────────────────────

var PORT = process.env.DASHBOARD_PORT || 3004;
app.listen(PORT, '0.0.0.0', function() {
    console.log('[Dashboard] v3.9 running at http://localhost:' + PORT);
});
