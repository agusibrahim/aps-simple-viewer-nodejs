const express = require('express');
const cors = require('cors')
const { PORT } = require('./config.js');

let app = express();
app.use(cors())
app.use(express.json({ limit: '50mb' }));
app.use(express.static('wwwroot'));
app.use(require('./routes/auth.js'));
app.use(require('./routes/models.js'));
app.use(require('./routes/files.js'));
app.listen(PORT, function () { console.log(`Server listening on port ${PORT}...`); });
