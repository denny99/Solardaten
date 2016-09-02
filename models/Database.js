var moment          = require("moment");
var ErrorController = require('../controllers/ErrorController');
var errorController = new ErrorController();

/**
 * Object for creating and storing database objects
 * @param {Object} db instance of database
 */
function Database(db) {
	this.db       = db;
	this.instance = undefined;
}

/**
 * @callback documentCB
 * @param {DatabaseError} err
 * @param {Object} document
 */

/**
 * @callback documentListCB
 * @param {DatabaseError} err
 * @param {[Object]} documents
 */

/**
 * @callback bulkCB
 * @param {[Object] | DatabaseError} [errors]
 * @param {[Object]} [successfulDocuments]
 */

/**
 * @callback reportCB
 * @param {LocalvoucherError} err
 * @param {[Object]} documents
 */

/**
 * @callback removeCB
 * @param {DatabaseError} err
 * @param {number} code
 */

/**
 * @typedef {Object} Tv4Result
 * @property {LocalvoucherError} error error message from tv4
 * @property {boolean} valid valid or not valid
 */

/**
 * @typedef {Object} Tv4Error
 * @property {number} code internal statusCode
 * @property {string} message message describing the error
 * @property {string} dataPath property path in object
 * @property {string} schemaPath property path in schema
 */

/**
 * @typedef {Object} DatabaseError
 * @property {number} statusCode http StatusCode
 * @property {string} error message describing the error
 */

/**
 * get document by id and calls fn
 * @param {string} id id of requested document
 * @param {documentCB} fn callback function
 */
Database.prototype.getDocumentById = function (id, fn) {
	this.db.get(id, function (err, body) {
		if (!err) {
			//if found return it without err message
			fn(undefined, body);
		}
		else {
			//on any error create error message and return
			//console.log(err);
			fn({
				statusCode: err.statusCode,
				error     : err.reason
			}, undefined);
		}
	});
};

/**
 * get mulitple documents by id and calls fn
 * @param {[string]} ids id of requested document
 * @param {documentListCB} fn callback function
 */
Database.prototype.getDocumentsByIds = function (ids, fn) {
	this.db.fetch({keys: ids}, function (err, body) {
		if (!err) {
			var documents = [];
			body.rows.forEach(function (doc) {
				if (!doc.error) {
					documents.push(doc.doc);
				}
			});
			//if found return it without err message
			fn(undefined, documents);
		}
		else {
			console.log(err);
			//on any error create error message and return
			//console.log(err);
			fn({
				statusCode: err.statusCode,
				error     : err.reason
			}, []);
		}
	});

};

/**
 * stores given document in db
 * @param {Object} document whole document
 * @param {documentCB} fn callback
 */
Database.prototype.save = function (document, fn) {
	//try to insert document
	//make sure insert crashes when document already exists
	delete document._rev;
	this.db.insert(document, function (err, body) {
		if (!err) {
			document._id  = body.id;
			document._rev = body.rev;

			//send it back
			fn(undefined, document);
		}
		else {
			//on error create object and return
			//console.log(err);
			fn({
				statusCode: err.statusCode,
				error     : err.reason
			}, undefined);
		}
	});
};

/**
 * updates given document in db
 * @param {Object} document  whole document, with or without _rev
 * @param {documentCB} fn callback
 */
Database.prototype.update = function (document, fn) {
	//try insert
	var self = this;

	//try to get full document from db
	self.getDocumentById(document._id, function (err, oldDocument) {
		//on no error update it on 404 create new one
		if (!err || err.statusCode === 404) {
			//refresh rev on update
			if (!err) {
				document._rev = oldDocument._rev;
			}

			//try insert
			self.db.insert(document, function (err, body) {
				if (!err) {
					document._rev = body.rev;
					fn(undefined, document);
				}
				else {
					fn({
						statusCode: err.statusCode,
						error     : err.reason
					}, undefined);
				}
			})
		}
		else {
			fn(err, undefined);
		}
	}, true);
};

/**
 * stores given documents in db using bulk insert
 * @param {[Object]} documents array (!NOT object) with documents to insert
 * @param {boolean} update
 * @param {bulkCB} fn callback
 */
Database.prototype.bulkSave = function (documents, update, fn) {
	//make sure insert crashes when document already exists
	if (!update) {
		documents.forEach(function (document) {
			delete document._rev;
		});
	}

	/*
	 format documents as JSON object for the bulk insert as defined in documentation:
	 {
	 "docs": [
	 {"_id": "0", "integer": 0, "string": "0"},
	 {"_id": "1", "integer": 1, "string": "1"},
	 {"_id": "2", "integer": 2, "string": "2"}
	 ]
	 }
	 */

	var docsJSON = {
		"docs": documents
	};
	//try to insert documents
	this.db.bulk(docsJSON, {}, function (err, body) {
		if (!err) {
			//on success set id and rev
			var successfulDocuments = [];
			var errorDocuments      = [];
			documents.forEach(function (document, i) {
				if (body && body[i] && body[i].error) {
					/*
					 try to get error code. Bulk insert returns "error":"conflict", "error":"forbidden" or "error":"unauthorized", like this:
					 [
					 {"id":"0","error":"conflict","reason":"Document update conflict."},
					 {"id":"1","rev":"2-1579510027"},
					 {"id":"2","rev":"2-3978456339"}
					 ]
					 */

					document.errorCode   = body[i].error; //save error code in document
					document.errorReason = body[i].reason; //save error reason in document

					errorDocuments.push(document);

				}
				else if (body && body[i]) { //everything OK
					document._id  = body[i].id;
					document._rev = body[i].rev;
					successfulDocuments.push(document);
				}
				else {
					console.log("! body && body[i]");
				}
			});

			//errors - send back error object and documents array
			fn(errorDocuments.length === 0 ? undefined : errorDocuments, successfulDocuments);
		}
		else {
			//on error create object and return
			//console.log(err);
			fn({
				statusCode: err.statusCode,
				error     : err.reason
			}, []);
		}
	});
};

/**
 * remove given document from db
 * @param {Object} document document to remove
 * @param {removeCB} fn callback
 */
Database.prototype.remove = function (document, fn) {
	var self = this;
	//try to destroy it
	self.db.destroy(document._id, document._rev, function (err) {
		if (fn) {
			if (!err) {
				fn(undefined, 200);
			}
			else {
				fn({
					statusCode: err.statusCode,
					error     : err.reason
				}, err.statusCode);
			}
		}
	});
};

/**
 * get List of documents starting with offset
 * @param {number} offset number of first voucher
 * @param {number} [limit] max amount
 * @param {boolean} [descending] descending order
 * @param {[string]} keys filter keys
 * @param {string}design name of design document
 * @param {string} view view name
 * @param {documentListCB} fn callback function
 */
Database.prototype.getDocumentsByType = function (offset, limit, descending, keys, design, view, fn) {
	var list, query;

	//prepare query data
	query = {
		descending: descending,
		skip      : offset
	};

	//keys was given?
	if (keys) {
		query.keys = keys
	}
	if (limit) {
		query.limit = limit
	}

	this.db.view(design, view, query, function (err, body) {
		if (!err) {
			list = [];
			body.rows.forEach(function (pair) {
				list.push(pair.value);
			});

			fn(undefined, list);
		}
		else {
			fn({
				statusCode: err.statusCode,
				error     : err.reason
			}, []);
		}
	});
};

/**
 * get List of document filtered with query
 * @param {number} offset number of first voucher
 * @param {number} [limit] max amount
 * @param {boolean} [descending] descending order true or false
 * @param {[string] | string | {}} startkey startkey for filter
 * @param {[string] | string | {}} endkey endkey for filter
 * @param {string} design name of design document
 * @param {string} view view name
 * @param {documentListCB} fn callback function
 */
Database.prototype.getDocumentsByQuery = function (offset, limit, descending, startkey, endkey, design, view, fn) {
	var list;

	//switch keys in case of [descending]
	if (descending) {
		var backup;
		backup   = JSON.parse(JSON.stringify(startkey));
		startkey = endkey;
		endkey   = backup;
	}

	var query = {
		startkey  : startkey,
		endkey    : endkey,
		descending: descending,
		skip      : offset
	};
	if (limit) {
		query.limit = limit
	}
	this.db.view(design, view, query, function (err, body) {
		if (!err) {
			list = [];
			body.rows.forEach(function (pair) {
				list.push(pair.value);
			});

			fn(undefined, list);
		}
		else {
			fn({
				statusCode: err.statusCode,
				error     : err.reason
			}, undefined);
		}
	});
};

/**
 * get report filtered with query
 * @param {number} offset number of first voucher
 * @param {number} [limit] max amount
 * @param {[string] | string | {}} startkey startkey for filter
 * @param {[string] | string | {}} endkey endkey for filter
 * @param {string} design name of design doc
 * @param {string} view view name
 * @param {number} groupLevel group level for reduce
 * @param {reportCB} fn callback function
 */
Database.prototype.getReport = function (offset, limit, startkey, endkey, design, view, groupLevel, fn) {
	var query = {
		startkey   : startkey,
		endkey     : endkey,
		skip       : offset,
		reduce     : true,
		descending : false,
		group_level: groupLevel
	};
	if (limit) {
		query.limit = limit
	}
	this.db.view(design, view, query, function (err, body) {
		if (!err) {
			fn(undefined, body.rows);
		}
		else {
			fn(errorController.createErrorMessage({
				statusCode: err.statusCode,
				error     : err.reason
			}, "Documents"), []);
		}
	});
};

/**
 * get report filtered with query and list function
 * @param {number} offset number of first voucher
 * @param {number} [limit] max amount
 * @param {[string] | string | {}} startkey startkey for filter
 * @param {[string] | string | {}} endkey endkey for filter
 * @param {string} design name of design doc
 * @param {string} view view name
 * @param {string} list list name
 * @param {number} groupLevel group level for reduce
 * @param {reportCB} fn callback function
 */
Database.prototype.getReportWithList = function (offset, limit, startkey, endkey, design, view, list, groupLevel, fn) {
	var query = {
		startkey   : startkey,
		endkey     : endkey,
		skip       : offset,
		reduce     : true,
		descending : false,
		group_level: groupLevel
	};
	if (limit) {
		query.limit = limit
	}
	this.db.viewWithList(design, view, list, query, function (err, body) {
		if (!err) {
			fn(undefined, body.rows);
		}
		else {
			fn(errorController.createErrorMessage({
				statusCode: err.statusCode,
				error     : err.reason
			}, "Documents"), []);
		}
	});
};

/**
 * get report filtered with query
 * @param {number} offset number of first voucher
 * @param {number} [limit] max amount
 * @param {[string] | string | {}} keys keys for filter
 * @param {string} design name of design doc
 * @param {string} view view name
 * @param {number} groupLevel group level for reduce
 * @param {reportCB} fn callback function
 */
Database.prototype.getReportByKeys = function (offset, limit, keys, design, view, groupLevel, fn) {
	var query = {
		keys       : keys,
		skip       : offset,
		reduce     : true,
		descending : false,
		group_level: groupLevel,
		group      : true
	};
	if (limit) {
		query.limit = limit
	}

	this.db.view(design, view, query, function (err, body) {
		if (!err) {
			fn(undefined, body.rows);
		}
		else {

			fn(errorController.createErrorMessage({
				statusCode: err.statusCode,
				error     : err.reason
			}, "Documents"), []);
		}
	});
};

/**
 * get configured nano object
 * @returns {Object}
 */
Database.getNanoInstance = function () {
	return require('nano')(
		'https://' + (process.env.db_auth_key + ':' +process.env.db_auth_secret).toString('base64') +
		'@' + process.env.db_host);
};

/**
 * Static getDatabase Method (singleton)
 * @return {Database}
 */
Database.getDatabase = function () {
	var self = this;

	var nano, /* Database API */
		db /* database instance */;

	// constructor exist, create object and inherit
	if (typeof this.instance !== "function") {
		nano          = self.getNanoInstance();
		db            = nano.use(global.config.db_list["SolarData"]);
		this.instance = new Database(db);
	}

	return this.instance;
};

global.database = Database;