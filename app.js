var express      = require('express');
var session      = require('express-session');
var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

var app = express();

global._ = require('lodash');

global.config = require('./config.json')[app.get('env')];

//passport
global.passport = require('passport');

require('./models/Database');

var routes = require('./routes/index');
var login  = require('./routes/login');
var logout = require('./routes/logout');
var errors = require('./routes/errors');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

if (app.get('env') === "production") {
	app.set('forceSSLOptions', {
		enable301Redirects: true,
		trustXFPHeader    : false,
		httpsPort         : 443,
		sslRequiredMessage: 'SSL Required.'
	});
}

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
	secret           : 'keyboard cat',
	resave           : true,
	saveUninitialized: true
}));

app.use(global.passport.initialize());
app.use(global.passport.session());

app.use('/', routes);
app.use('/errors', errors);
app.use('/login', login);
app.use('/logout', logout);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err    = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error  : err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error  : {}
	});
});

//ready email module
var EmailController = require('./controllers/EmailController');

new EmailController();


module.exports = app;
