var express = require('express');
var router  = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
	req.logout();
	req.session.destroy(function () {

	});

	res.render('logout', {title: 'Logout'});
});

module.exports = router;
