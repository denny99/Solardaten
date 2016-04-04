/**
 * Created by Denny Müller on 25.02.2016.
 */

function ErrorController() {
	var self = this;

	/**
	 * @typedef {Object} LocalvoucherError
	 * @property {number} code HTTP Status Code
	 * @property {string} message what happened? (not found, invalid query)
	 * @property {string} reason specific reason why request has failed (more detailed, e.g. tv4 error, couch error)
	 * @property {string} type error type (db, localvoucher, validator)
	 */

	/**
	 * generate api error message
	 * @param {number} code
	 * @param {string} field
	 * @param {string} [reason]
	 * @param {string} [type]
	 * @returns {LocalvoucherError}
	 */
	function createErrorMessage(code, field, reason, type) {
		var message, err;

		switch (code) {
			case 400:
			case 422:
				message = "invalid " + field;
				break;
			case 404:
				message = field + " not found";
				break;
			case 401:
			case 403:
				message = "permissions required";
				break;
			case 409:
				message = "duplicated " + field;
				break;
			case 420:
				message = field;
				break;

			case 501:
				message = "not yet implemented";
				break;

			default:
				message = "internal server error";
				code    = 500;
				break;
		}

		//maybe we use reason as debug error message?
		//or remove the couchDb error messages
		err = {
			"code"   : code,
			"message": message,
			"reason" : reason === undefined ? message : reason,
			"type"   : type === undefined ? "localvoucher" : type
		};
		return err;
	}

	/**
	 * analyze and process tv4 error messages
	 * @param {Tv4Error} err
	 * @returns {LocalvoucherError}
	 */
	function analyzeTv4Error(err) {
		var reason = "property";
		if (err.dataPath.length !== 0) {
			reason += err.dataPath;
		}
		return createErrorMessage(400, reason, err.message, "validator")
	}

	/**
	 * analyze and process db storage errors
	 * @param {DatabaseError} err
	 * @param {string} field
	 * @returns {LocalvoucherError}
	 */
	function analyzeDatabaseErrorMessage(err, field) {
		var usedField;
		switch (err.statusCode) {
			case 404:
			case 409:
				usedField = field;
				break;

			case 422:
				usedField = "Query";
				break;

			default:
				usedField = "";
				break;
		}

		return createErrorMessage(err.statusCode, usedField, err.error, "database");
	}

	/**
	 * send not authorized message
	 * @param {Object} res
	 */
	self.sendForbidden = function (res) {
		self.sendStatusMessage(403, res);
	};

	/**
	 * create an api error message
	 * @param {number} status
	 * @param {Object} [res]
	 * @returns {LocalvoucherError}
	 */
	self.sendStatusMessage = function (status, res) {
		self.createErrorMessage(status, "", res);
	};

	/**
	 * create an api error message
	 * @param {Tv4Error | DatabaseError | number} err
	 * @param {string} [field]
	 * @param {Object} [res]
	 * @returns {LocalvoucherError}
	 */
	self.createErrorMessage = function (err, field, res) {
		var error;

		if (typeof err === "number") {
			//create error for swagger docs
			error = createErrorMessage(err, field);
		}
		//we've got an tv4 error?
		else if (err.hasOwnProperty("code") && err.hasOwnProperty("message") && err.hasOwnProperty("dataPath") &&
			err.hasOwnProperty("schemaPath")) {
			error = analyzeTv4Error(err);
		}
		//db error?
		else if (err.hasOwnProperty("statusCode") && err.hasOwnProperty("error")) {
			error = analyzeDatabaseErrorMessage(err, field);
		}
		//Error is already an ApiError?
		else if (err.hasOwnProperty("code") && err.hasOwnProperty("message") && err.hasOwnProperty("reason")) {
			error = err;
		}

		if (res) {
			self.send(error, res);
		}
		else {
			return error;
		}
	};

	/**
	 * send error
	 * @param {LocalvoucherError} err
	 * @param {Object} res
	 */
	self.send = function (err, res) {
		console.log(err);
		res.status(err.code).send(err).end();
	}
}

module.exports = ErrorController;