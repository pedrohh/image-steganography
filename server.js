// Requires
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

// Configuration
app.use(express.static(__dirname + '/public'));
//app.use(morgan('dev'));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
app.use(methodOverride());

// Routes (get, posts)
require('./app/routes.js')(app);

// Listen
app.listen(port);
console.log("App listening on port " + port);