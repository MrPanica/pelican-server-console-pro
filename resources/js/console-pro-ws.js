/**
 * Pelican Server Console Pro - Resilient WebSocket Proxy & Back-Forward Cache (bfcache) Recovery
 * Prevents "Could not connect to websocket" errors when tabs are minimized, backgrounded, or restored from bfcache.
 * Automatically recovers connection, requests fresh JWT tokens, and flushes queues without page reload.
 */
(function () {
    var OrigWS = window.WebSocket;
    if (!OrigWS || OrigWS._pelicanProHooked) return;

    function PelicanWebSocket(url, protocols) {
        if (!(this instanceof PelicanWebSocket)) {
            return new PelicanWebSocket(url, protocols);
        }

        var urlStr = url ? String(url) : '';
        var isWings = urlStr.includes('/ws') || urlStr.includes('/api/servers/');

        // If not a Wings server console WebSocket, use native WebSocket directly
        if (!isWings) {
            return (protocols !== undefined) ? new OrigWS(url, protocols) : new OrigWS(url);
        }

        var self = this;
        self.url = urlStr;
        self.protocols = protocols;
        self._binaryType = 'blob';
        self._listeners = {};
        self._onopen = null;
        self._onmessage = null;
        self._onerror = null;
        self._onclose = null;
        self._realWs = null;
        self._manuallyClosed = false;
        self._reconnectTimer = null;
        self._reconnectAttempts = 0;
        self._sendQueue = [];
        self._isAuthenticated = false;
        self._needsReconnectOnWake = false;

        window._pelicanConsoleSocket = self;
        window._pelicanActiveSockets = window._pelicanActiveSockets || new Set();
        window._pelicanActiveSockets.add(self);

        self._connect();
        return self;
    }

    // Static constants
    PelicanWebSocket._pelicanProHooked = true;
    PelicanWebSocket.CONNECTING = OrigWS.CONNECTING; // 0
    PelicanWebSocket.OPEN = OrigWS.OPEN;             // 1
    PelicanWebSocket.CLOSING = OrigWS.CLOSING;       // 2
    PelicanWebSocket.CLOSED = OrigWS.CLOSED;         // 3

    // Instance constants
    PelicanWebSocket.prototype.CONNECTING = 0;
    PelicanWebSocket.prototype.OPEN = 1;
    PelicanWebSocket.prototype.CLOSING = 2;
    PelicanWebSocket.prototype.CLOSED = 3;

    Object.defineProperty(PelicanWebSocket.prototype, 'readyState', {
        get: function () {
            if (this._manuallyClosed) return OrigWS.CLOSED;
            if (!this._realWs) return OrigWS.CONNECTING;
            return this._realWs.readyState;
        },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'bufferedAmount', {
        get: function () {
            return this._realWs ? this._realWs.bufferedAmount : 0;
        },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'protocol', {
        get: function () {
            return this._realWs ? this._realWs.protocol : '';
        },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'extensions', {
        get: function () {
            return this._realWs ? this._realWs.extensions : '';
        },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'binaryType', {
        get: function () { return this._binaryType; },
        set: function (val) {
            this._binaryType = val;
            if (this._realWs) this._realWs.binaryType = val;
        },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'onopen', {
        get: function () { return this._onopen; },
        set: function (fn) { this._onopen = fn; },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'onmessage', {
        get: function () { return this._onmessage; },
        set: function (fn) { this._onmessage = fn; },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'onerror', {
        get: function () { return this._onerror; },
        set: function (fn) { this._onerror = fn; },
        enumerable: true
    });

    Object.defineProperty(PelicanWebSocket.prototype, 'onclose', {
        get: function () { return this._onclose; },
        set: function (fn) { this._onclose = fn; },
        enumerable: true
    });

    PelicanWebSocket.prototype.addEventListener = function (type, listener, options) {
        if (!this._listeners[type]) this._listeners[type] = new Set();
        this._listeners[type].add(listener);
    };

    PelicanWebSocket.prototype.removeEventListener = function (type, listener, options) {
        if (this._listeners[type]) {
            this._listeners[type].delete(listener);
        }
    };

    PelicanWebSocket.prototype.dispatchEvent = function (evt) {
        var type = evt.type;
        if (type === 'open' && typeof this._onopen === 'function') {
            try { this._onopen.call(this, evt); } catch (e) { console.error('[PelicanConsolePro] Error in onopen handler:', e); }
        } else if (type === 'message' && typeof this._onmessage === 'function') {
            try { this._onmessage.call(this, evt); } catch (e) { console.error('[PelicanConsolePro] Error in onmessage handler:', e); }
        } else if (type === 'error' && typeof this._onerror === 'function') {
            try { this._onerror.call(this, evt); } catch (e) { console.error('[PelicanConsolePro] Error in onerror handler:', e); }
        } else if (type === 'close' && typeof this._onclose === 'function') {
            try { this._onclose.call(this, evt); } catch (e) { console.error('[PelicanConsolePro] Error in onclose handler:', e); }
        }

        if (this._listeners[type]) {
            var listeners = Array.from(this._listeners[type]);
            for (var i = 0; i < listeners.length; i++) {
                try { listeners[i].call(this, evt); } catch (e) { console.error('[PelicanConsolePro] Error in listener for ' + type + ':', e); }
            }
        }
        return true;
    };

    PelicanWebSocket.prototype._dismissErrorBanners = function () {
        try {
            if (window.Livewire) {
                window.Livewire.dispatch('removeAlertBanner', { id: 'websocket_error' });
            }
        } catch (e) {}

        try {
            var banners = document.querySelectorAll('.fi-alert-banner, [wire\\:key*="websocket_error"], .fi-al-ctn');
            banners.forEach(function (el) {
                var txt = el.textContent || '';
                if (txt.includes('websocket') || txt.includes('Websocket') || txt.includes('troubleshooting')) {
                    el.remove();
                }
            });
        } catch (e) {}
    };

    PelicanWebSocket.prototype._connect = function () {
        if (this._manuallyClosed) return;
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        var self = this;
        if (self._realWs && (self._realWs.readyState === OrigWS.OPEN || self._realWs.readyState === OrigWS.CONNECTING)) {
            return;
        }

        try {
            if (self._realWs) {
                try {
                    self._realWs.onopen = null;
                    self._realWs.onmessage = null;
                    self._realWs.onerror = null;
                    self._realWs.onclose = null;
                    self._realWs.close();
                } catch (e) {}
            }

            var ws = (self.protocols !== undefined)
                ? new OrigWS(self.url, self.protocols)
                : new OrigWS(self.url);

            self._realWs = ws;
            ws.binaryType = self._binaryType;
            self._needsReconnectOnWake = false;

            ws.onopen = function (e) {
                self._reconnectAttempts = 0;
                self._isAuthenticated = false;
                self._needsReconnectOnWake = false;

                // Dismiss any existing websocket_error alert banner
                self._dismissErrorBanners();

                // Dispatch open event to Pelican (triggers socket.onopen -> token-request)
                self.dispatchEvent(new Event('open'));
            };

            ws.onmessage = function (e) {
                try {
                    var msg = JSON.parse(e.data);
                    if (msg && msg.event === 'auth success') {
                        self._isAuthenticated = true;
                        self._dismissErrorBanners();

                        // Flush any queued outgoing messages (commands, state changes)
                        while (self._sendQueue.length > 0) {
                            var item = self._sendQueue.shift();
                            try { ws.send(item); } catch (err) {
                                console.warn('[PelicanConsolePro] Failed to flush queued item:', err);
                            }
                        }
                    } else if (msg && msg.event === 'stats' && msg.args && msg.args[0]) {
                        var raw = msg.args[0];
                        var statsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        window.dispatchEvent(new CustomEvent('pelican:server-stats', { detail: statsObj }));
                    }
                } catch (err) {}

                self.dispatchEvent(new MessageEvent('message', { data: e.data, origin: e.origin }));
            };

            ws.onerror = function (e) {
                // When tab is hidden in background or entering Back-Forward Cache (bfcache),
                // suppress the fatal error event from propagating to Pelican's Livewire!
                var isHidden = (typeof document !== 'undefined' && document.visibilityState === 'hidden');
                if (isHidden || self._reconnectAttempts < 3) {
                    console.log('[PelicanConsolePro] Transient WebSocket error (suppressed, reconnect scheduled):', e);
                    return;
                }
                self.dispatchEvent(new Event('error'));
            };

            ws.onclose = function (e) {
                if (self._manuallyClosed) {
                    self.dispatchEvent(new CloseEvent('close', e));
                    return;
                }

                self._isAuthenticated = false;
                self._scheduleReconnect(false);
            };
        } catch (err) {
            console.warn('[PelicanConsolePro] Error initializing WebSocket:', err);
            self._scheduleReconnect(false);
        }
    };

    PelicanWebSocket.prototype._scheduleReconnect = function (immediate) {
        if (this._manuallyClosed) return;
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);

        // If tab is hidden in background, mark for reconnect and wait until user returns
        var isHidden = (typeof document !== 'undefined' && document.visibilityState === 'hidden');
        if (isHidden && !immediate) {
            this._needsReconnectOnWake = true;
            console.log('[PelicanConsolePro] Tab in background; postponing WebSocket reconnect until tab is focused.');
            return;
        }

        var self = this;
        self._reconnectAttempts++;
        var delay = immediate ? 50 : Math.min(1000 * Math.pow(1.5, Math.min(self._reconnectAttempts, 5)), 8000);

        self._reconnectTimer = setTimeout(function () {
            self._reconnectTimer = null;
            self._connect();
        }, delay);
    };

    PelicanWebSocket.prototype._reconnectNow = function () {
        if (this._manuallyClosed) return;
        if (!this._realWs || this._realWs.readyState === OrigWS.CLOSED || this._realWs.readyState === OrigWS.CLOSING || this._needsReconnectOnWake) {
            this._scheduleReconnect(true);
        }
    };

    PelicanWebSocket.prototype.send = function (data) {
        try {
            var parsed = typeof data === 'string' ? JSON.parse(data) : null;
            if (parsed && parsed.event === 'send logs') {
                if (window._pelicanStartInitialBacklog) {
                    window._pelicanStartInitialBacklog();
                }
            }
        } catch (e) {}

        if (this._realWs && this._realWs.readyState === OrigWS.OPEN) {
            return this._realWs.send(data);
        } else {
            this._sendQueue.push(data);
            this._reconnectNow();
        }
    };

    PelicanWebSocket.prototype.close = function (code, reason) {
        this._manuallyClosed = true;
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        if (window._pelicanActiveSockets) window._pelicanActiveSockets.delete(this);
        if (this._realWs) {
            try { this._realWs.close(code, reason); } catch (e) {}
        }
    };

    // --- Tab Wake-Up & bfcache Event Handlers ---
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            console.log('[PelicanConsolePro] Restored from Back-Forward Cache (persisted=true). Resuming WebSocket...');
        }
        if (window._pelicanConsoleSocket && typeof window._pelicanConsoleSocket._reconnectNow === 'function') {
            window._pelicanConsoleSocket._reconnectNow();
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            if (window._pelicanConsoleSocket && typeof window._pelicanConsoleSocket._reconnectNow === 'function') {
                window._pelicanConsoleSocket._reconnectNow();
            }
        }
    });

    window.addEventListener('focus', function () {
        if (window._pelicanConsoleSocket && typeof window._pelicanConsoleSocket._reconnectNow === 'function') {
            window._pelicanConsoleSocket._reconnectNow();
        }
    });

    window.addEventListener('online', function () {
        console.log('[PelicanConsolePro] Network connection restored (online).');
        if (window._pelicanConsoleSocket && typeof window._pelicanConsoleSocket._reconnectNow === 'function') {
            window._pelicanConsoleSocket._reconnectNow();
        }
    });

    window.WebSocket = PelicanWebSocket;
})();
