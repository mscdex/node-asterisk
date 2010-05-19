var sys = require('sys'), ast = require('./asterisk');

am = new ast.AsteriskManager({user: 'foo', password: 'bar'});

am.addListener('serverconnect', function() {
	sys.puts("CLIENT: Connected!");
	am.login(function () {
		sys.puts("CLIENT: Logged in!");
	});
});

am.addListener('serverdisconnect', function(had_error) {
	sys.puts("CLIENT: Disconnected! had_error == " + (had_error ? "true" : "false"));
});

am.addListener('servererror', function(err) {
	sys.puts("CLIENT: Error: " + err);
});

am.addListener('dialing', function(from, to) {
	sys.puts("CLIENT: Dialing from " + from.number + " (" + from.name + ") to " + to.number + " (" + to.name + ")");
});

am.addListener('callconnected', function(from, to) {
	sys.puts("CLIENT: Connected call between " + from.number + " (" + from.name + ") and " + to.number + " (" + to.name + ")");
});

am.addListener('calldisconnected', function(from, to) {
	sys.puts("CLIENT: Disconnected call between " + from.number + " (" + from.name + ") and " + to.number + " (" + to.name + ")");
});

am.addListener('hold', function(participant) {
	var other = am.getParticipant(participant['with']);
	sys.puts("CLIENT: " + participant.number + " (" + participant.name + ") has put " + other.number + " (" + other.name + ") on hold");
});

am.addListener('unhold', function(participant) {
	var other = am.getParticipant(participant['with']);
	sys.puts("CLIENT: " + participant.number + " (" + participant.name + ") has taken " + other.number + " (" + other.name + ") off hold");
});

am.addListener('hangup', function(participant, code, text) {
	var other = am.getParticipant(participant['with']);
	sys.puts("CLIENT: " + participant.number + " (" + participant.name + ") has hung up. Reason: " + code + " (" + text + ")");
});

am.addListener('callreport', function(report) {
	sys.puts("CLIENT: Call report: " + sys.inspect(report));
});

am.connect();