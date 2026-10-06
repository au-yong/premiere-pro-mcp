/**
 * ExtendScript Helper Utilities and JSON polyfill for Premiere Pro JSX environment
 */

export const TICKS_PER_SECOND = 254016000000;

/**
 * Converts seconds (number) to Premiere Pro ticks (string/large number representation)
 * @param {number} seconds
 * @returns {string}
 */
export function secondsToTicks(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) {
    return '0';
  }
  // Use BigInt or string math to avoid float precision issues
  const ticks = Math.round(seconds * TICKS_PER_SECOND);
  return ticks.toString();
}

/**
 * Converts Premiere Pro ticks to seconds (number)
 * @param {number|string} ticks
 * @returns {number}
 */
export function ticksToSeconds(ticks) {
  if (!ticks) return 0;
  const numTicks = typeof ticks === 'string' ? parseFloat(ticks) : ticks;
  return numTicks / TICKS_PER_SECOND;
}

/**
 * Complete ES3 JSON2 polyfill string to prepend to ExtendScript snippets
 * ensuring JSON.stringify and JSON.parse are always defined.
 */
export const EXTENDSCRIPT_JSON_POLYFILL = `
if (typeof JSON !== 'object') {
    JSON = {};
}
(function () {
    'use strict';
    function f(n) { return n < 10 ? '0' + n : n; }
    if (typeof Date.prototype.toJSON !== 'function') {
        Date.prototype.toJSON = function () {
            return isFinite(this.valueOf())
                ? this.getUTCFullYear() + '-' +
                    f(this.getUTCMonth() + 1) + '-' +
                    f(this.getUTCDate()) + 'T' +
                    f(this.getUTCHours()) + ':' +
                    f(this.getUTCMinutes()) + ':' +
                    f(this.getUTCSeconds()) + 'Z'
                : null;
        };
        String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function () {
            return this.valueOf();
        };
    }
    var cx = /[\\u0000\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g,
        escapable = /[\\\\\\"\\x00-\\x1f\\x7f-\\x9f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g,
        gap, indent,
        meta = { '\\b': '\\\\b', '\\t': '\\\\t', '\\n': '\\\\n', '\\f': '\\\\f', '\\r': '\\\\r', '"': '\\\\"', '\\\\': '\\\\\\\\' };
    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c : '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }
    function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];
        if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }
        switch (typeof value) {
        case 'string': return quote(value);
        case 'number': return isFinite(value) ? String(value) : 'null';
        case 'boolean':
        case 'null': return String(value);
        case 'object':
            if (!value) return 'null';
            gap += indent;
            partial = [];
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }
                v = partial.length === 0 ? '[]' : gap ? '[\\n' + gap + partial.join(',\\n' + gap) + '\\n' + mind + ']' : '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = str(k, value);
                    if (v) partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
            }
            v = partial.length === 0 ? '{}' : gap ? '{\\n' + gap + partial.join(',\\n' + gap) + '\\n' + mind + '}' : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }
    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {
            var i;
            gap = ''; indent = '';
            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) { indent += ' '; }
            } else if (typeof space === 'string') { indent = space; }
            return str('', {'': value});
        };
    }
    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text) {
            var j;
            function walk(holder, key) {
                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) { value[k] = v; } else { delete value[k]; }
                        }
                    }
                }
                return value;
            }
            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }
            if (/^[\\],:{}\\s]*$/.test(text.replace(/\\\\(?:["\\\\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                .replace(/"[^"\\\\\\n\\r]*"|true|false|null|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?/g, ']')
                .replace(/(?:^|:|,)(?:\\s*\\[)+/g, ''))) {
                j = eval('(' + text + ')');
                return typeof reviver === 'function' ? walk({'': j}, '') : j;
            }
            throw new SyntaxError('JSON.parse error');
        };
    }
}());
`;

/**
 * Wraps JSX script execution in safe try/catch returning standard JSON response
 * @param {string} innerJsxCode 
 * @returns {string}
 */
export function wrapExtendScript(innerJsxCode) {
  return `(function() {
    ${EXTENDSCRIPT_JSON_POLYFILL}
    try {
        ${innerJsxCode}
    } catch(err) {
        return JSON.stringify({
            status: "error",
            error: err.toString(),
            line: err.line || 0,
            file: err.fileName || ""
        });
    }
})();`;
}
