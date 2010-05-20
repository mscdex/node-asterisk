Description
===========

node-asterisk is a [node.js](http://nodejs.org/) module that allows interaction with an Asterisk server.
See the test.js script for example usage.


Requirements
============

* [node.js](http://nodejs.org/) -- tested with v0.1.95
* An [Asterisk](http://www.asterisk.org/) server -- tested with v1.4.21.2


API Documentation
=================

node-asterisk exposes only one class: **AsteriskManager**.


#### Data types

* _Participant_ is an object currently containing the following properties:
    * **name** - A String containing the name provided by Caller ID, if it's not available/provided then it's set to "&lt;unknown&gt;". **Note:** Caller ID _name_ information is only available once a call is connected.
    * **number** - An Integer representing a 10-digit (PSTN) landline number or an asterisk extension.
    * **with** - A String representing a unique number identifying another Participant they are associated with. **Note:** this property is not set until the _dialing_ event occurs.


AsteriskManager Events
----------------------

* **serverconnect**() - Fires when a connection to the asterisk server has been successfuly established.

* **servererror**(String) - Fires when a Javascript error occurs. The given String represents the text of the error.

* **serverdisconnect**(Boolean) - Fires when a connection to the asterisk server has been lost, with the given Boolean indicating whether the disconnection was the result of an error.

* **dialing**(Participant, Participant) - Fires when the first Participant is calling the second Participant.

* **callconnected**(Participant, Participant) - Fires when the first Participant is successfully connected to the second Participant and voice can be exchanged.

* **calldisconnected**(Participant, Participant) - Fires when the two Participants are disconnected from each other for some reason (normal or otherwise).

* **hangup**(Participant, Integer, String) - Fires for each Participant in the _dialing_ event, with the second parameter being the [cause code](http://www.voip-info.org/wiki/view/asterisk+manager+events#HangupEvent) and the third parameter being a human-readable version of the cause code. **Note:** This event will fire soon after the _dialing_ event if either Participant has a busy signal.

* **hold**(Participant) - Fires when the given Participant has put the other Participant they are connected with, on hold.

* **unhold**(Participant) - Fires when the given Participant has taken the other Participant they are connected with, off of hold.

* **callreport**(Object) - Fires at the end of any call attempt (successful or otherwise). The given object contains some useful information about the call, including:
    * **caller** - The Participant object of the originator of the call.
    * **callee** - The Participant object of the receiver of the call.
    * **startTime** - A String containing the date and time (according to the local clock -- i.e. not converted to GMT) that dialing started, in this format: "2010-05-18 22:52:45".
    * **answerTime** - A String containing the date and time (according to the local clock -- i.e. not converted to GMT) the call was answered, in this format: "2010-05-18 22:52:45". If the call was unsuccessful, this is simply a blank string.
    * **endTime** - A String containing the date and time (according to the local clock -- i.e. not converted to GMT) the call attempt ended, in this format: "2010-05-18 22:52:45".
    * **totalDuration** - An Integer representing the total number of seconds from the time of dialing to the end of the call (using _calldisconnected_ as a reference for a connected call or _hangup_ for an unsuccessful call).
    * **talkDuration** - An Integer representing the total number of seconds from the time the call was successfully connected to the time the call was disconnected.
    * **finalStatus** - A String containing a description of the status of the call (i.e. "no answer", "busy", "answered", etc).


AsteriskManager Functions
-------------------------

* **(constructor)**([Object]) - _AsteriskManager_ - Creates and returns a new instance of AsteriskManager using the specified configuration object. At least the 'user' and 'password' config properties must be specified. Valid properties of the passed in object are:
    * **user** - A String representing the username to log into the asterisk server with.
    * **password** - A String representing the password associated with the user to log into the asterisk server with.
    * **host** - A String representing the hostname or IP address of the asterisk server. **Default:** "localhost"
    * **port** - An Integer representing the port of the asterisk server. **Default:** 5038
    * **events** - A String indicating what classes of events you wish to listen for ("on" for all events, "off" for no events, or a comma-delimited String containing the specific names of events to listen for). Usually you do not want to change this, except if you are only going to be issuing commands and don't need to listen for events, in which case set this to "off". A list of valid event classes can be found [here](http://www.voip-info.org/wiki/view/Asterisk+manager+API) under "Authorization for various classes". **Default:** "on"
    * **connect_timeout** - An Integer representing the time to wait for a connection to the Asterisk server (in milliseconds). Zero indicates no timeout. **Default:** 0

* **connect**() - _(void)_ - Attempts to connect to the asterisk server.

* **login**() - _(void)_ - Performs authentication.

* **getParticipant**(String) - _Participant_ - Retrieves the Participant with the specified unique id. For now, these ids only exist in the _with_ property of Participant. **Note:** Participants are non-existant after the appropriate _callreport_ event is fired.