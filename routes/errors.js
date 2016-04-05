var express        = require('express');
var authMiddleware = require("../middleware/auth.js");
var moment         = require("moment");
var router         = express.Router();

var database = global.database.getDatabase();

/* GET home page. */
router.get('/', authMiddleware.isAuthenticated, function (req, res, next) {
	database.getDocumentsByType(0, 20, true, undefined, "error", "getErrorsByDate", function (err, documents) {
		if (!err) {
			res.render('errors', {
				title : 'Fehlermeldungen',
				errors: documents || [],
				tab   : "errors",
				moment: moment
			});
		}
		else {
			next(err);
		}
	});
});

router.get('/:id', authMiddleware.isAuthenticated, function (req, res, next) {
	database.getDocumentById(req.params.id, function (err, document) {
		if (!err) {
			res.render('error', {
				title : 'Fehlermeldung vom ' + moment.utc(document.datetime).format("DD.MM.YYYY HH:mm"),
				error : document,
				tab   : "errors",
				moment: moment
			});
		}
		else {
			next(err);
		}
	});
});

module.exports = router;
