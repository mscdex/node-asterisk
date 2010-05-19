var inherits = require('sys').inherits;
var EventEmitter = require('events').EventEmitter;
var net = require('net');

var CRLF = "\r\n";
var END = "\r\n\r\n";

exports.AsteriskManager = function (newconfig) {
	EventEmitter.call(this);
	var default_config = {
		user: null,
		password: null,
		host: 'localhost',
		port: 5038,
		events: 'on',
		connect_timeout: 0 // the time to wait for a connection to the Asterisk server (in milliseconds)
	};
	var config;
	var tmoConn = null;
	var conn = null;
	var self = this;
	var loggedIn_ = false;
	var loginId = null;
	var buffer = "";

	var actions = {};
	var partcipants = {};

	this.setConfig = function(newconfig) {
		config = {};
		for (var option in default_config)
			config[option] = (typeof newconfig[option] != "undefined" ? newconfig[option] : default_config[option]);
	};

	this.send = function(req, cb) {
		var id = (new Date()).getTime();
		actions[id] = {request: req, callback: cb};
		var msg = "";
		for (var key in req)
			msg += key + ": " + req[key] + CRLF;
		msg += "actionid: " + id + CRLF + CRLF;
		if (req.action == 'login')
			loginId = id;
		self.conn.write(msg);
	};
	
	this.getParticipant = function(id) {
		return self.participants[id];
	}

	this.OnConnect = function() {
		self.participants = {};
		if (config.connect_timeout > 0)
			clearTimeout(self.tmoConn);
		self.emit('serverconnect');
	};
	
	this.OnError = function(err) {
		self.conn.end();
		self.emit('servererror', err);
	};
	
	this.OnClose = function(had_error) {
		self.emit('serverdisconnect', had_error);
		self.conn.destroy();
		loggedIn_ = false;
	};
	
	this.OnEnd = function() {
		self.conn.end();
		this.OnClose(false);
	};

	this.OnData = function(tcpbuffer) {
		data = tcpbuffer.toString();
		if (data.substr(0, 21) == "Asterisk Call Manager")
			data = data.substr(data.indexOf(CRLF)+2); // skip the server greeting when first connecting
		buffer += data;
		var iDelim, info, headers, kv, type;
		while ((iDelim = buffer.indexOf(END)) > -1) {
			info = buffer.substring(0, iDelim+2).split(CRLF);
			buffer = buffer.substr(iDelim + 4);
			headers = {}; type = ""; kv = [];
			for (var i=0,len=info.length; i<len; i++) {
				if (info[i].indexOf(": ") == -1)
					continue;
				kv = info[i].split(": ", 2);
				kv[0] = kv[0].toLowerCase().replace("-", "");
				if (i==0)
					type = kv[0];
				headers[kv[0]] = kv[1];
			}
			switch (type) {
				case "response":
					self.OnResponse(headers);
				break;
				case "event":
					self.OnEvent(headers);
				break;
			}
		}
	};

	this.OnResponse = function(headers) {
		var id = headers.actionid, req = actions[id];
		if (id == loginId && headers.response == "Success")
			loggedIn_ = true;
		if (typeof req.callback == 'function')
			req.callback(headers);
		delete actions[id];
	};
	
	this.OnEvent = function(headers) {
		switch (headers.event) {
			case "Newchannel": // new participant
				self.participants[headers.uniqueid] = {name: headers.calleridname, number: headers.calleridnum};
			break;
			case "Newcallerid": // potentially more useful information on an existing participant
				if (typeof self.participants[headers.uniqueid]['number'] == 'undefined')
					self.participants[headers.uniqueid]['number'] = headers.callerid;
				if (headers.calleridname[0] != "<")
					self.participants[headers.uniqueid]['name'] = headers.calleridname;
			break;
			case "Dial": // source participant is dialing a destination participant
				self.participants[headers.srcuniqueid]['with'] = headers.destuniqueid;
				self.participants[headers.destuniqueid]['with'] = headers.srcuniqueid;
				self.emit('dialing', self.participants[headers.srcuniqueid], self.participants[headers.destuniqueid]);
			break;
			case "Link": // the participants have been connected and voice is now available
				self.emit('callconnected', self.participants[headers.uniqueid1], self.participants[headers.uniqueid2]);
			break;
			case "Unlink": // call has ended and the participants are disconnected from each other
				self.emit('calldisconnected', self.participants[headers.uniqueid1], self.participants[headers.uniqueid2]);
			break;
			case "Hold": // someone put someone else on hold
				self.emit('hold', self.participants[headers.uniqueid]);
			break;
			case "Unhold": // someone took someone else off of hold
				self.emit('unhold', self.participants[headers.uniqueid]);
			break;
			case "Hangup": // fires for each participant and contains the cause for the participant's hangup
				self.emit('hangup', self.participants[headers.uniqueid], headers.cause, headers.causetxt);
			break;
			case "Cdr": // call data record. contains a ton of useful info about the call (whether it was successful or not) that recently ended
				var idCaller = headers.uniqueid, idCallee = self.participants[idCaller]['with'], status = headers.disposition.toLowerCase();
				// use 'callreport' instead of 'callrecord' so as not to potentially confuse 'record' as in recording the voice(s) call, ala monitoring
				self.emit('callreport', {
					caller: self.participants[idCaller],
					callee: self.participants[idCallee],
					startTime: headers.starttime,
					answerTime: headers.answertime,
					endTime: headers.endtime,
					totalDuration: headers.duration, // in seconds
					talkDuration: headers.billableseconds, // in seconds
					finalStatus: status
				});
				delete self.participants[idCaller];
				delete self.participants[idCallee];
			break;
			case "Newstate":
			case "Registry":
			case "Newexten":
				// ignore theseas they aren't generally useful for ordinary tasks
			break;
			default:
				//sys.debug("ASTERISK: Got unknown event '" + headers.event + "' with data: " + sys.inspect(headers));
		}
	};

	this.connect = function() {
		if (!self.conn || self.conn.readyState == 'closed') {
			self.conn = net.createConnection(config.port, config.host);
			self.conn.addListener('connect', self.OnConnect);
			//self.conn.addListener('error', self.OnError); // disable for now to get a better idea of source of bugs/errors
			self.conn.addListener('close', self.OnClose);
			self.conn.addListener('end', self.OnEnd);
			self.conn.addListener('data', self.OnData);
			if (config.connect_timeout > 0) {
				self.tmoConn = setTimeout(function() {
					self.emit('timeout');
					self.conn.end();
				}, config.connect_timeout);
			}
		}
	};
	
	this.login = function(cb) {
		if (!loggedIn_ && self.conn.readyState == 'open') {
			self.send({
				action: 'login',
				username: config.user,
				secret: config.password,
				events: config.events
			}, cb);
		}
	};
	
	this.disconnect = function() {
		if (self.conn.readyState == 'open')
			self.conn.end();
	};
	
	this.__defineGetter__('loggedIn', function () { return loggedIn_; });
	
	this.setConfig(newconfig);
};

inherits(exports.AsteriskManager, EventEmitter);