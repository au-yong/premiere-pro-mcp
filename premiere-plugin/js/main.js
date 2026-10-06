/**
 * Premiere Pro MCP Bridge - Client Controller
 * Connects CEP panel to MCP WebSocket server and dispatches commands to ExtendScript
 */

(function () {
    'use strict';

    var csInterface = new CSInterface();
    var ws = null;
    var reconnectTimer = null;
    var autoReconnect = true;

    // DOM Elements
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    var wsUrlInput = document.getElementById('wsUrl');
    var btnConnect = document.getElementById('btnConnect');
    var btnDisconnect = document.getElementById('btnDisconnect');
    var btnPing = document.getElementById('btnPing');
    var btnCheckProject = document.getElementById('btnCheckProject');
    var btnCheckSequence = document.getElementById('btnCheckSequence');
    var btnListClips = document.getElementById('btnListClips');
    var btnClearLog = document.getElementById('btnClearLog');
    var logBox = document.getElementById('logBox');

    function log(message, type) {
        type = type || 'info';
        var now = new Date();
        var timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
        
        var entry = document.createElement('div');
        entry.className = 'log-entry ' + type;
        entry.innerHTML = '<span class="log-time">[' + timeStr + ']</span> ' + message;
        
        logBox.appendChild(entry);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function setStatus(status, text) {
        statusDot.className = 'status-dot';
        if (status === 'connected') {
            statusDot.classList.add('connected');
            statusText.innerText = text || 'Connected';
            btnConnect.disabled = true;
            btnDisconnect.disabled = false;
        } else if (status === 'connecting') {
            statusDot.classList.add('connecting');
            statusText.innerText = text || 'Connecting...';
            btnConnect.disabled = true;
            btnDisconnect.disabled = false;
        } else {
            statusText.innerText = text || 'Disconnected';
            btnConnect.disabled = false;
            btnDisconnect.disabled = true;
        }
    }

    function connect() {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        var url = wsUrlInput.value.trim() || 'ws://127.0.0.1:9098';
        setStatus('connecting', 'Connecting...');
        log('Connecting to MCP Bridge at ' + url, 'info');

        try {
            ws = new WebSocket(url);

            ws.onopen = function () {
                setStatus('connected', 'Connected');
                log('Successfully connected to MCP Server', 'success');

                // Send handshake info
                var hostEnv = {};
                try {
                    hostEnv = csInterface.getHostEnvironment();
                } catch (e) {}

                var handshake = {
                    type: 'handshake',
                    info: {
                        appId: hostEnv.appId || 'PPRO',
                        appVersion: hostEnv.appVersion || 'Unknown',
                        appName: hostEnv.appName || 'Adobe Premiere Pro',
                        platform: navigator.platform,
                        timestamp: Date.now()
                    }
                };
                ws.send(JSON.stringify(handshake));
            };

            ws.onmessage = function (event) {
                try {
                    var data = JSON.parse(event.data);
                    handleIncomingMCPMessage(data);
                } catch (err) {
                    log('Error parsing incoming message: ' + err.message, 'error');
                }
            };

            ws.onclose = function () {
                setStatus('disconnected', 'Disconnected');
                log('Disconnected from MCP Server', 'warn');
                ws = null;

                if (autoReconnect) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(connect, 3000);
                }
            };

            ws.onerror = function (err) {
                setStatus('disconnected', 'Connection Error');
                log('WebSocket error occurred', 'error');
            };

        } catch (err) {
            setStatus('disconnected', 'Failed to connect');
            log('Failed to connect: ' + err.message, 'error');
        }
    }

    function disconnect() {
        autoReconnect = false;
        clearTimeout(reconnectTimer);
        if (ws) {
            ws.close();
            ws = null;
        }
        setStatus('disconnected', 'Disconnected');
        log('Connection closed by user', 'info');
    }

    /**
     * Executes MCP action or raw script inside Premiere Pro
     */
    function handleIncomingMCPMessage(msg) {
        var id = msg.id;
        var type = msg.type;
        var action = msg.action;
        var params = msg.params || {};
        var jsx = msg.jsx;

        var scriptCall = '';
        if (type === 'action') {
            log('Received action: ' + action, 'info');
            var serializedParams = JSON.stringify(params).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            scriptCall = 'dispatchMCPAction("' + action + '", "' + serializedParams + '");';
        } else if (type === 'raw') {
            log('Received raw JSX script execution', 'info');
            scriptCall = jsx;
        } else {
            return;
        }

        var startTime = Date.now();
        csInterface.evalScript(scriptCall, function (resultStr) {
            var duration = Date.now() - startTime;
            var response = { id: id };

            try {
                var parsed = JSON.parse(resultStr);
                if (parsed.status === 'error') {
                    response.status = 'error';
                    response.error = parsed.error;
                    log('Error in ' + (action || 'script') + ' (' + duration + 'ms): ' + parsed.error, 'error');
                } else {
                    response.status = 'success';
                    response.result = parsed.result !== undefined ? parsed.result : parsed;
                    log('Completed ' + (action || 'script') + ' (' + duration + 'ms)', 'success');
                }
            } catch (parseErr) {
                // If result wasn't JSON formatted
                if (resultStr && resultStr.indexOf('EvalScript error') >= 0) {
                    response.status = 'error';
                    response.error = resultStr;
                    log('Eval error: ' + resultStr, 'error');
                } else {
                    response.status = 'success';
                    response.result = resultStr;
                    log('Completed ' + (action || 'script') + ' (' + duration + 'ms)', 'success');
                }
            }

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(response));
            }
        });
    }

    // Quick Inspection Event Handlers
    btnCheckProject.addEventListener('click', function () {
        csInterface.evalScript('dispatchMCPAction("get_project_info", "{}");', function (res) {
            log('Project Info: ' + res, 'info');
        });
    });

    btnCheckSequence.addEventListener('click', function () {
        csInterface.evalScript('dispatchMCPAction("get_sequence_details", "{}");', function (res) {
            log('Sequence Info: ' + res, 'info');
        });
    });

    btnListClips.addEventListener('click', function () {
        csInterface.evalScript('dispatchMCPAction("list_timeline_clips", "{}");', function (res) {
            log('Timeline Clips: ' + res, 'info');
        });
    });

    btnPing.addEventListener('click', function () {
        if (ws && ws.readyState === WebSocket.OPEN) {
            log('Pinging server...', 'info');
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } else {
            log('Cannot ping: Not connected', 'warn');
        }
    });

    btnConnect.addEventListener('click', function () {
        autoReconnect = true;
        connect();
    });

    btnDisconnect.addEventListener('click', function () {
        disconnect();
    });

    btnClearLog.addEventListener('click', function () {
        logBox.innerHTML = '';
    });

    // Auto connect on launch
    setTimeout(connect, 1000);

})();
