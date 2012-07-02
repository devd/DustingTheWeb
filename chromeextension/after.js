/* global chrome: true */

(function() {
	if (window.onbeforeunload !== null) {
		chrome.extension.sendRequest({ url: document.documentURI, type: "onbeforeunload", sessionID: "", message: "Site has redefined window.onbeforeunload with " + window.onbeforeunload.toString() }, function(response) {} );
	}
}());