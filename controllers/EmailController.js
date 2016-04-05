var Imap       = require('imap');
var inspect    = require('util').inspect;
var MailParser = require("mailparser").MailParser;
var parse      = require('csv-parse/lib/sync');
var moment     = require("moment");

var database = global.database.getDatabase();

function EmailController() {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

	var workers = 0;

	var imap = new Imap({
		user    : config.strato.email,
		password: config.strato.password,
		host    : config.strato.host,
		port    : 993,
		tls     : true
	});

	imap.on('mail', function () {
		checkEmails();
	});

	imap.once('ready', function () {
		checkEmails();
	});

	imap.once('error', function (err) {
		console.log(err);
		imap.connect();
	});

	imap.once('end', function () {
		console.log('Connection ended');
		imap.connect();
	});

	imap.connect();

	function checkEmails() {
		if (workers !== 0) {
			console.log("still working");
			setTimeout(function () {
				//try again in 5 sec.
				checkEmails();
			}, 5000);
			return;
		}

		workers++;

		imap.openBox("INBOX", false, function (err, box) {
			if (err) {
				console.log(err);
			}

			imap.search(['UNSEEN'], function (err, results) {
				if (err) {
					console.log(err);
				}

				if (results.length === 0) {
					workers--;
					return console.log("nothing to do");
				}

				var fetch = imap.fetch(results, {
					bodies  : [''],
					struct  : true,
					markSeen: true
				});

				fetch.on('message', function (msg) {
					workers++;
					var parser = new MailParser();

					parser.on('end', function (mailObj) {
						if (mailObj.attachments) {
							mailObj.attachments.forEach(function (attachment) {
								if (attachment.fileName.match(/int_kostal/)) {
									parseSolarDataCSV(attachment.content);
								}
							});
						}
						if (mailObj.subject.match(/Alarm:/)) {
							addErrorLog(mailObj.text);
						}
						workers--;
					});

					msg.on("body", function (stream) {
						stream.on("data", function (chunk) {
							parser.write(chunk.toString("utf8"));
						});
					});

					msg.on('data', function (chunk) {
						parser.write(chunk.toString());
					});

					msg.on('end', function () {
						parser.end();
					});
				});

				fetch.once('error', function () {

				});

				fetch.once('end', function () {
					console.log('Done fetching all messages!');
					workers--;
				});
			});
		});
	}

	function addErrorLog(message) {
		var time, timeData, timeStat, reason;

		reason   = message.replace(/Empfaenger.*|Zeitpunkt.*|Anlage.*|Serial.*|Adr.*|SerNo.*|\n*|\r*/g, "");
		timeStat = message.match(/Zeitpunkt.*/)[0];
		timeData = timeStat.split("=")[1].replace(" / ", " ");

		time = moment.utc(timeData, "DD-MM-YY HH:mm:ss");

		database.save({
			"type"    : "error",
			"reason"  : reason,
			"message" : message,
			"datetime": time.isValid() ? time.toISOString() : moment.utc().toISOString()
		}, function () {
			console.log("saved error");
		});
	}

	function parseSolarDataCSV(csv) {
		var input, records, units, date;

		input = csv.toString();

		date = input.match(/Datum=.*/)[0].split('=')[1];

		//remove addtional information
		input = input.replace(/\[.*|Anlage=.*|Datum=.*|Info;.*/g, "");

		//replace german names
		input = input.replace(/;s;Adresse;Name;Seriennummer;/g, "datetime;s;address;name;serial;");

		records = parse(input, {
			columns         : true,
			delimiter       : ';',
			skip_empty_lines: true
		});

		units   = _.head(records);
		records = _.tail(records);

		records = _.map(records, function (record) {
			var transformedObj  = _.transform(record, function (result, value, key) {
				if (key === "datetime") {
					value = moment.utc(date + " " + value, "YYMMDD HH:mm:ss").toISOString();
				}

				result[key] = {
					value: value === '' ? 0 : !isNaN(value) ? parseFloat(value) : value,
					unit : units[key]
				}
			}, {});
			transformedObj.type = "solarData";
			return transformedObj;
		});

		database.bulkSave(records, false, function (errors, successfulDocuments) {
			if (errors) {
				console.log(errors);
			}
			else {
				console.log("import successful");
			}
		});
	}
}

module.exports = EmailController;