var express              = require('express');
var authMiddleware       = require("../middleware/auth.js");
var StatisticsController = require('../controllers/StatisticsController');
var moment               = require("moment");

var router = express.Router();

/* GET home page. */
router.get('/', authMiddleware.isAuthenticated, function (req, res, next) {
	var statisticsController = new StatisticsController();

	statisticsController.run(req.query.type, function (result) {
		res.render('index', {
			title : 'Statistiken',
			tab   : "statistics",
			result: result,
			pill  : req.query.type,
			_     : _,
			moment: moment
		});
	});
});

module.exports = router;
