/**
 * Created by Denny Müller on 04.04.2016.
 */

var moment = require("moment");

var database = global.database.getDatabase();

function StatisticsController() {
	var self = this;

	var units = [
		"Karl1", "Karl2", "Karl3"
	];

	var workers = 0;

	var result = {
		total    : [],
		weekly   : [],
		monthly  : [],
		year     : [],
		yesterday: []
	};

	function isFinished(fn) {
		if (workers === 0) {
			fn(result);
		}
	}

	self.getTotalOverView = function (fn) {
		workers++;
		database.getReport(0, undefined, [], [{}], "solarData", "getKilowattHourByUnit", 1, function (err, documents) {
			workers--;

			console.log(documents);

			documents.forEach(function (doc) {
				result.total.push([doc.key[0], _.round(doc.value, 2)]);
			});

			isFinished(fn)
		});
	};

	self.getDailyOverview = function (fn) {
		var today, yesterday, startKey, endKey, weeklyWorkers, dailyResult;

		dailyResult   = {};
		weeklyWorkers = 0;

		today     = moment.utc().subtract(1, 'days').hours(23).minutes(59);
		yesterday = moment.utc().hours(0).minutes(0).subtract(1, 'days');

		for (var i = 1; i < 25; i++) {
			var day                                     = moment.utc().hours(0).minutes(0).subtract(i, 'hours');
			dailyResult[day.format("DD.MM.YYYY HH:mm")] = {date: day.format("HH:mm")};

			units.forEach(function (unit) {
				dailyResult[day.format("DD.MM.YYYY HH:mm")][unit] = 0;
			});
		}

		startKey = [yesterday.year(), yesterday.month(), yesterday.date(), yesterday.hours()];
		endKey   = [today.year(), today.month(), today.date(), today.hours()];

		units.forEach(function (unit) {
			workers++;
			weeklyWorkers++;

			database.getReport(0, undefined, _.concat([unit], startKey), _.concat([unit], endKey), "solarData",
				"getKilowattHourByUnit", 5, function (err, documents) {
					workers--;
					weeklyWorkers--;
					if (!err) {
						documents.forEach(function (doc) {
							var date;

							date = moment.utc().set({
								year : doc.key[1],
								month: doc.key[2],
								date : doc.key[3],
								hours: doc.key[4],
								minutes: 0
							}).format("DD.MM.YYYY HH:mm");

							dailyResult[date][doc.key[0]] += _.round(doc.value, 2);
						});

						if (weeklyWorkers === 0) {
							result.yesterday = _.reverse(_.map(dailyResult, function (o) {
								return _.map(o, function (v) {
									return v;
								});
							}));
						}
					}

					isFinished(fn);
				});
		});
	};

	self.getWeeklyOverview = function (fn) {
		var today, lastWeek, startKey, endKey, weeklyWorkers, weeklyResult;

		weeklyResult  = {};
		weeklyWorkers = 0;

		today    = moment.utc();
		lastWeek = moment.utc().subtract(6, 'days');

		for (var i = 0; i < 7; i++) {
			var day                                = moment.utc().subtract(i, 'days');
			weeklyResult[day.format("DD.MM.YYYY")] = {date: day.format("DD.MM.YYYY")};

			units.forEach(function (unit) {
				weeklyResult[day.format("DD.MM.YYYY")][unit] = 0;
			});
		}

		startKey = [lastWeek.year(), lastWeek.month(), lastWeek.date()];
		endKey   = [today.year(), today.month(), today.date(), {}];

		units.forEach(function (unit) {
			workers++;
			weeklyWorkers++;

			database.getReport(0, undefined, _.concat([unit], startKey), _.concat([unit], endKey), "solarData",
				"getKilowattHourByUnit", 4, function (err, documents) {
					workers--;
					weeklyWorkers--;
					if (!err) {
						documents.forEach(function (doc) {
							var date;

							date = moment.utc().set({
								year : doc.key[1],
								month: doc.key[2],
								date : doc.key[3]
							}).format("DD.MM.YYYY");

							weeklyResult[date][doc.key[0]] += _.round(doc.value, 2);
						});

						if (weeklyWorkers === 0) {
							result.weekly = _.reverse(_.map(weeklyResult, function (o) {
								return _.map(o, function (v) {
									return v;
								});
							}));
						}
					}

					isFinished(fn);
				});
		});
	};

	self.getMonthlyOverview = function (fn) {
		var startKey, endKey, monthlyWorkers, monthlyResult;

		monthlyResult  = {
			0 : {date: "Januar"},
			1 : {date: "Februar"},
			2 : {date: "März"},
			3 : {date: "April"},
			4 : {date: "Mai"},
			5 : {date: "Juni"},
			6 : {date: "Juli"},
			7 : {date: "August"},
			8 : {date: "September"},
			9 : {date: "Oktober"},
			10: {date: "November"},
			11: {date: "Dezember"}
		};
		monthlyWorkers = 0;

		monthlyResult = _.mapValues(monthlyResult, function (o) {
			units.forEach(function (unit) {
				o[unit] = 0;
			});
			return o;
		});

		startKey = [moment.utc().year()];
		endKey   = [moment.utc().year(), {}];

		units.forEach(function (unit) {
			workers++;
			monthlyWorkers++;

			database.getReport(0, undefined, _.concat([unit], startKey), _.concat([unit], endKey), "solarData",
				"getKilowattHourByUnit", 3, function (err, documents) {
					workers--;
					monthlyWorkers--;
					if (!err) {
						documents.forEach(function (doc) {
							monthlyResult[doc.key[2]][doc.key[0]] += _.round(doc.value, 2);
						});

						if (monthlyWorkers === 0) {
							result.monthly = _.map(monthlyResult, function (o) {
								return _.map(o, function (v) {
									return v;
								});
							});
						}
					}

					isFinished(fn);
				});
		});
	};

	self.getYearOverView = function (fn) {
		var startKey, endKey, yearWorkers, yearResult;

		yearResult  = {};
		yearWorkers = 0;

		startKey = [];
		endKey   = [{}];

		units.forEach(function (unit) {
			workers++;
			yearWorkers++;

			database.getReport(0, undefined, _.concat([unit], startKey), _.concat([unit], endKey), "solarData",
				"getKilowattHourByUnit", 3, function (err, documents) {
					workers--;
					yearWorkers--;
					if (!err) {
						documents.forEach(function (doc) {
							if (yearResult.hasOwnProperty(doc.key[1])) {
								yearResult[doc.key[1].toString()][doc.key[0]] += _.round(doc.value, 2);
							}
							else {
								yearResult[doc.key[1]] = {date: doc.key[1].toString()};

								units.forEach(function (unit) {
									yearResult[doc.key[1]][unit] = 0;
								});

								yearResult[doc.key[1]][doc.key[0]] = _.round(doc.value, 2);
							}
						});

						if (yearWorkers === 0) {
							result.year = _.map(yearResult, function (o) {
								return _.map(o, function (v) {
									return v;
								});
							});
						}
					}

					isFinished(fn);
				});
		});
	};

	self.run = function (type, fn) {
		switch (type) {
			case "yesterday":
				return self.getDailyOverview(fn);

			case "weekly":
				return self.getWeeklyOverview(fn);

			case "monthly":
				return self.getMonthlyOverview(fn);

			case "year":
				return self.getYearOverView(fn);

			default:
				return self.getTotalOverView(fn);
		}
	}
}

module.exports = StatisticsController;