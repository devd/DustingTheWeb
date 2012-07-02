/*global chrome */
/*global MessageEvent */
/*jslint devel: true, browser: true, nomen: true */

(function () {
	"use strict";
	var port, script, element;
	(function () {
		if (document.documentURI) {
			console.log("Loaded page (" + document.documentURI + ")");
		}
	}());

	function main() {
		var overrideAlert, logEvent;
		// Flags to enable and disable functionality in our extension
		overrideAlert = false;
		logEvent = document.createEvent('Event');
		logEvent.initEvent('logEvent', true, true);
		function sendLogEvent(type, message) {
			var hiddenDiv;
			hiddenDiv = document.getElementById('logEventDiv');
			hiddenDiv.style.display = "none";
			hiddenDiv.setAttribute("class", type);
			hiddenDiv.innerText = message;
			hiddenDiv.dispatchEvent(logEvent);
		}
		if (overrideAlert) {
			// Override alert()
			window.alert = function alert(msg) {
				sendLogEvent("Alert", "Website called Alert() : " + msg);
			};
		}
		// Swizzle to log document.createEvent()
		(function () {
			var origCreateEvent = document.createEvent;
			document.createEvent = function (type) {
				if ((type === "MouseEvent") || (type === "MouseEvents")) {
					sendLogEvent("MouseEvent", "Website called document.createEvent() with event " + type);
				}
				return origCreateEvent.apply(this, arguments);
			};
		}());
		// Logs if site has changed onbeforeunload
		(function () {
			if (window.onbeforeunload !== null) {
				sendLogEvent("onbeforeunload", "Site has redefined window.onbeforeunload with " + window.onbeforeunload.toString());
			}
		}());
		// Swizzle to log for geolocation access
		(function () {
			var origGetCurrentPos, origWatchPos;
			origGetCurrentPos = navigator.geolocation.getCurrentPosition;
			navigator.geolocation.__defineGetter__("getCurrentPosition", function () {
				return function () {
					sendLogEvent("Geolocation", "Website called getCurrentPosition()");
					origGetCurrentPos.apply(this, arguments);
				};
			});
			origWatchPos = navigator.geolocation.watchPosition;
			navigator.geolocation.__defineGetter__("watchPosition", function () {
				return function () {
					sendLogEvent("Geolocation", "Website called watchPosition()");
					origWatchPos.apply(this, arguments);
				};
			});
		}());
		// Swizzle to log window.blur() and window.focus()
		(function () {
			var origOpen = window.open;
			window.open = function () {
				var w, origBlur, origFocus;
				w = origOpen.apply(this, arguments);
				origBlur = w.blur;
				w.blur = function () {
					sendLogEvent("window.blur", "Website called window.blur()");
					return origBlur.apply(this, arguments);
				};
				origFocus = w.focus;
				w.focus = function () {
					sendLogEvent("window.focus", "Website called window.focus()");
					return origFocus.apply(this, arguments);
				};
				return w;
			};
		}());
		// Log when an iframe has opacity < 0.25 and is cross-origin
		(function () {
			var checkFrames, MIN_XORIGIN_IFRAME_OPACITY = 0.25;
			checkFrames = function () {
				var URLregex, i, frame, _frames, src, frameHostname, frameOpacity, parser;
				parser = document.createElement("a");
				_frames = document.getElementsByTagName("iframe");
				for (i = 0; i < _frames.length; i += 1) {
					frame = _frames[i];
					parser.href = frame.src;
					frameHostname = parser.hostname;
					frameOpacity = +(window.getComputedStyle(frame).opacity);
					if (frameOpacity < MIN_XORIGIN_IFRAME_OPACITY && frameHostname !== window.location.hostname) {
						sendLogEvent("Clickjacking", "Website contains transparent, cross-origin iframes.");
						/* Supress future logging of this feature. */
						return;
					}
				}
				window.setTimeout(checkFrames, 200);
			};
			// The DOM could be constantly changing on a page, so this needs to be checked at regular intervals.
			window.setTimeout(checkFrames, 200);
		}());
		// Log when window.history has its back() and forward() methods called
		(function () {
			var origBack, origForward;
			origBack = window.history.back;
			window.history.back = function () {
				sendLogEvent("History", "Website has called window.back()");
				return origBack.apply(this, arguments);
			};
			origForward = window.history.forward;
			window.history.forward = function () {
				sendLogEvent("History", "Website has called window.forward()");
				return origForward.apply(this, arguments);
			};
		}());
		// Log when "message" event is created/sent to this window with origin = "*"
		(function () {
			var origPostMsg = window.postMessage;
			window.postMessage = function (message, targetOrigin) {
				if (targetOrigin === "*") {
					sendLogEvent("PostMessageSent", "Message sent with wildcard target origin.");
				}
				return origPostMsg(message, targetOrigin);
			};
		}());
		// Log when event.data is accessed for postMessage before event.origin is checked.
		(function () {
			var messageListeners, swizzledListeners, origAddEventListener, origRemoveEventListener;
			messageListeners = [];
			swizzledListeners = [];
			origAddEventListener = window.addEventListener;
			origRemoveEventListener = window.removeEventListener;
			// Replace window.addEventListener
			window.addEventListener = function () {
				var type, originalListener, newListener;
				type = arguments[0];
				originalListener = arguments[1];
				if (type === "message") {
					newListener = function (event) {
						var newEvent, checked;
						sendLogEvent("PostMessage", "This site is using the postMessage API");
						newEvent = new MessageEvent("message");
						newEvent.initMessageEvent("message",
												  event.bubbles,
												  event.cancelable,
												  event.data,
												  event.origin,
												  event.lastEventId,
												  event.source,
												  event.ports);
						checked = false;
						newEvent.__defineGetter__("data", function () {
							if (!checked) {
								sendLogEvent("PostMessageReceived", "The origin of this message was not checked before accessing message data.");
							}
							return event.data;
						});
						newEvent.__defineGetter__("origin", function () {
							checked = true;
							return event.origin;
						});
						return originalListener(newEvent);
					};
					arguments[1] = newListener;
					messageListeners.push(originalListener);
					swizzledListeners.push(newListener);
				}
				return origAddEventListener.apply(this, arguments);
			};
			// Replace window.removeEventListener
			window.removeEventListener = function () {
				var type, toRemove, index, originalListener, swizzledListener;
				if (arguments.length > 1) {
					type = arguments[0];
					toRemove = arguments[1];
					if (type === "message") {
						index = messageListeners.indexOf(toRemove);
						if (index >= 0) {
							originalListener = messageListeners.splice(index, 1)[0];
							swizzledListener = swizzledListeners.splice(index, 1)[0];
							arguments[1] = swizzledListener;
						}
					}
					origRemoveEventListener.apply(this, arguments);
				}
			};
			// Now window.onmessage, which must clear the listeners lists firsts, leaving only ONE listener.
			window.__defineSetter__("onmessage", function (listener) {
				var i;
				messageListeners = [];
				for (i in swizzledListeners) {
					origRemoveEventListener.apply(this, ["message", swizzledListeners[i]]);
				}
				swizzledListeners = [];
				window.addEventListener("message", listener);
			});
		}());

		// Swizzle to log clipboard access
		(function () {
			window.clipboardData = {};
			window.clipboardData.getData = function (e) {
				sendLogEvent("Clipboard", "Website called clipboardData.getData()");
			};
			window.clipboardData.setData = function (e1, e2) {
				sendLogEvent("Clipboard", "Website called clipboardData.setData()");
			};
		}());

		// Swizzle to log when XMLHttpRequests are used
		(function () {
			var originalGetAllResponseHeaders, originalGetResponseHeader, originalSetRequestHeader, originalSend, originalSendAsBinary, originalOverrideMimeType, originalAbort, originalOpen;
			originalGetAllResponseHeaders = window.XMLHttpRequest.prototype.getAllResponseHeaders;
			window.XMLHttpRequest.prototype.getAllResponseHeaders =	 function () {
				sendLogEvent("XMLHttpRequest", "Website called getAllResponseHeaders()");
				return originalGetAllResponseHeaders.apply(this, arguments);
			};
			originalGetResponseHeader = window.XMLHttpRequest.prototype.getResponseHeader;
			window.XMLHttpRequest.prototype.getResponseHeader = function (header) {
				sendLogEvent("XMLHttpRequest", "Website called getResponseHeader()");
				return originalGetAllResponseHeaders.apply(this, arguments);
			};
			originalSetRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;
			window.XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
				sendLogEvent("XMLHttpRequest", "Website called setRequestHeader()");
				return originalSetRequestHeader.apply(this, arguments);
			};
			originalSend = window.XMLHttpRequest.prototype.send;
			window.XMLHttpRequest.prototype.send = function () {
				sendLogEvent("XMLHttpRequest", "Website called send()");
				return originalSend.apply(this, arguments);
			};
			originalSendAsBinary = window.XMLHttpRequest.prototype.sendAsBinary;
			window.XMLHttpRequest.prototype.sendAsBinary = function (data) {
				sendLogEvent("XMLHttpRequest", "Website called sendAsBinary");
				return originalSendAsBinary.apply(this, arguments);
			};
			originalOverrideMimeType = window.XMLHttpRequest.prototype.overrideMimeType;
			window.XMLHttpRequest.prototype.overrideMimeType = function (mimetype) {
				sendLogEvent("XMLHttpRequest", "Website called overrideMimeType");
				return originalOverrideMimeType.apply(this, arguments);
			};
			originalAbort = window.XMLHttpRequest.prototype.abort;
			window.XMLHttpRequest.prototype.abort = function () {
				sendLogEvent("XMLHttpRequest", "Website called abort()");
				return originalAbort.apply(this, arguments);
			};
			originalOpen = window.XMLHttpRequest.prototype.open;
			window.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
				sendLogEvent("XMLHttpRequest", "Website called open()");
				if (async === false) {
					sendLogEvent("XMLHttpRequest", "Website called a SYNCHRONOUS request");
				} else if (async === true) {
					sendLogEvent("XMLHttpRequest", "Website called an ASYNCHRONOUS request");
				}
				if (method === "GET") {
					sendLogEvent("XMLHttpRequest", "Website used 'GET'");
				} else if (method === "POST") {
					sendLogEvent("XMLHttpRequest", "Website used 'POST'");
				}
				return originalOpen.apply(this, arguments);
			};
		}());
	}
	// Load our main() function into the DOM to be executed on page load
	if (!document.xmlVersion) {
		script = document.createElement('script');
		script.appendChild(document.createTextNode('(' + main + ')();'));
		document.documentElement.appendChild(script);
		element = document.createElement("div");
		element.id = "logEventDiv";
		element.style.display = "none";
		document.documentElement.appendChild(element);
	}
	// communication with background.html
	port = chrome.extension.connect();
	document.getElementById('logEventDiv').addEventListener('logEvent', function () {
		var _logType, _logMessage;
		_logType = document.getElementById('logEventDiv').getAttribute("class", 0);
		_logMessage = document.getElementById('logEventDiv').innerText;
		port.postMessage({URL: document.documentURI, type: _logType, message: _logMessage});
	});
	port.postMessage({URL: document.documentURI, type: "Visit", message: ""});
}());
