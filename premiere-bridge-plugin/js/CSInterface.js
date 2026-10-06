/**
 * CSInterface - v9.4.0
 * Adobe Common Extensibility Platform Interface
 */
function CSInterface() {
}

CSInterface.prototype.getHostEnvironment = function () {
    var hostEnv = window.__adobe_cep__ ? window.__adobe_cep__.getHostEnvironment() : "{}";
    return JSON.parse(hostEnv);
};

CSInterface.prototype.closeExtension = function () {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

CSInterface.prototype.getSystemPath = function (pathType) {
    var path = decodeURI(window.__adobe_cep__ ? window.__adobe_cep__.getSystemPath(pathType) : "");
    var OSVersion = this.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0) {
        path = path.replace("file:///", "");
    } else if (OSVersion.indexOf("Mac") >= 0) {
        path = path.replace("file://", "");
    }
    return path;
};

CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__) {
        if (callback === null || callback === undefined) {
            callback = function () {};
        }
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        console.warn("[CSInterface] window.__adobe_cep__ is not available (running outside Adobe host?)");
        if (callback) callback('{"status":"error","error":"Not running inside Adobe CEP environment"}');
    }
};

CSInterface.prototype.getApplicationID = function () {
    var appId = this.getHostEnvironment().appId;
    return appId;
};

CSInterface.prototype.getHostCapabilities = function () {
    var hostCapabilities = window.__adobe_cep__ ? window.__adobe_cep__.getHostCapabilities() : "{}";
    return JSON.parse(hostCapabilities);
};

CSInterface.prototype.getOSInformation = function () {
    var userAgent = navigator.userAgent;
    if (userAgent.indexOf("Mac") >= 0) {
        return "Mac OS";
    } else if (userAgent.indexOf("Windows") >= 0) {
        return "Windows";
    }
    return "Unknown OS";
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    }
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    }
};

CSInterface.prototype.dispatchEvent = function (event) {
    if (typeof event.data == "object") {
        event.data = JSON.stringify(event.data);
    }
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

CSInterface.prototype.requestOpenExtension = function (extensionId, params) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.requestOpenExtension(extensionId, params);
    }
};

CSInterface.SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

window.CSInterface = CSInterface;
