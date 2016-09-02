var express    = require('express');
var url        = require('url');
var algorithms = require("../public/javascripts/algorithms.js");
var router     = express.Router();

var BasicStrategy = require('passport-http').BasicStrategy;

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(user, done) {
	done(null, user);
});

/**
 * basic login via login page
 */
passport.use('basic', new BasicStrategy(function (username, password, done) {
	if (username === "mueller@mvh-ag.de" && password === "55469") {
		return done(null, {
			email: "mueller@mvh-ag.de"
		});
	}
	else {
		return done({
			status: 422,
			stack : "Wrong Credentials"
		}, false)
	}
}));

basic = global.passport.authenticate('basic', {
	session: true
});

/* GET login page. */
router.get('/', function (req, res) {
	var error = req.query.hasOwnProperty("error");
	res.render('login', {
		title: 'Login',
		error: error
	});
});

/**
 * perform login with post
 */
router.post('/', basic, function (req, res) {
	res.sendStatus(200).end();
});

module.exports = router;
