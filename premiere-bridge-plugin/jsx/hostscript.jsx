/**
 * Premiere Pro MCP Bridge - Host ExtendScript Engine
 * Runs inside Adobe Premiere Pro DOM
 */

// Embed JSON2 polyfill
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

var TICKS = 254016000000;

function toTicks(sec) {
    if (typeof sec !== 'number') sec = parseFloat(sec) || 0;
    return (sec * TICKS).toString();
}

function toSec(ticks) {
    if (!ticks) return 0;
    var t = typeof ticks === 'string' ? parseFloat(ticks) : ticks;
    return t / TICKS;
}

function findItemByPath(rootItem, targetPath) {
    if (!targetPath) return rootItem;
    var parts = targetPath.split('/');
    var current = rootItem;
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (!part) continue;
        var found = false;
        for (var j = 0; j < current.children.numItems; j++) {
            var child = current.children[j];
            if (child.name === part) {
                current = child;
                found = true;
                break;
            }
        }
        if (!found) return null;
    }
    return current;
}

function findClipInProject(parent, nameOrId) {
    for (var i = 0; i < parent.children.numItems; i++) {
        var it = parent.children[i];
        if (it.nodeId === nameOrId || it.name === nameOrId) {
            return it;
        }
        if (it.children && it.children.numItems > 0) {
            var found = findClipInProject(it, nameOrId);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Universal Action Dispatcher for CEP panel
 */
function dispatchMCPAction(action, paramsJson) {
    try {
        var p = {};
        if (paramsJson && typeof paramsJson === 'string') {
            p = JSON.parse(paramsJson);
        } else if (paramsJson && typeof paramsJson === 'object') {
            p = paramsJson;
        }

        if (!app.project) {
            throw new Error("No active Adobe Premiere Pro project is open.");
        }

        // 1. PROJECT & MEDIA
        if (action === "get_project_info") {
            var seq = app.project.activeSequence;
            return JSON.stringify({
                status: "success",
                result: {
                    name: app.project.name,
                    path: app.project.path,
                    isDirty: app.project.isDirty ? true : false,
                    sequencesCount: app.project.sequences.numSequences,
                    activeSequence: seq ? {
                        id: seq.id,
                        name: seq.name,
                        sequenceID: seq.sequenceID,
                        timebase: seq.timebase,
                        durationSeconds: toSec(seq.end),
                        videoTracksCount: seq.videoTracks.numTracks,
                        audioTracksCount: seq.audioTracks.numTracks
                    } : null
                }
            });
        }

        if (action === "save_project") {
            app.project.save();
            return JSON.stringify({ status: "success", result: { success: true } });
        }

        if (action === "save_as_project") {
            if (!p.filePath) throw new Error("Missing filePath");
            var ok = app.project.saveAs(p.filePath);
            return JSON.stringify({ status: "success", result: { success: ok, path: p.filePath } });
        }

        if (action === "list_bins") {
            function traverseBin(item) {
                var node = {
                    name: item.name,
                    type: item.type,
                    nodeId: item.nodeId
                };
                if (item.type === 2 || item.type === 3 || (item.children && item.children.numItems > 0)) {
                    node.isBin = true;
                    node.children = [];
                    for (var i = 0; i < item.children.numItems; i++) {
                        node.children.push(traverseBin(item.children[i]));
                    }
                } else {
                    node.isBin = false;
                    node.mediaPath = item.getMediaPath ? item.getMediaPath() : "";
                }
                return node;
            }
            return JSON.stringify({ status: "success", result: traverseBin(app.project.rootItem) });
        }

        if (action === "create_bin") {
            if (!p.name) throw new Error("Missing bin name");
            var parentBin = p.parentPath ? findItemByPath(app.project.rootItem, p.parentPath) : app.project.rootItem;
            if (!parentBin) throw new Error("Parent bin not found");
            var newBin = parentBin.createBin(p.name);
            return JSON.stringify({ status: "success", result: { name: newBin.name, nodeId: newBin.nodeId } });
        }

        if (action === "import_media") {
            if (!p.filePaths || !p.filePaths.length) throw new Error("Missing filePaths array");
            var targetBin = p.targetBinPath ? findItemByPath(app.project.rootItem, p.targetBinPath) : app.project.rootItem;
            var imported = app.project.importFiles(p.filePaths, true, targetBin || app.project.rootItem, false);
            return JSON.stringify({ status: "success", result: { success: imported, files: p.filePaths } });
        }

        if (action === "relink_media") {
            var item = findClipInProject(app.project.rootItem, p.clipName || p.nodeId);
            if (!item) throw new Error("Clip not found to relink");
            var relinked = item.changeMediaPath(p.newMediaPath, true);
            return JSON.stringify({ status: "success", result: { success: relinked, newPath: p.newMediaPath } });
        }

        if (action === "get_clip_metadata") {
            var item = findClipInProject(app.project.rootItem, p.clipName || p.nodeId);
            if (!item) throw new Error("Clip not found");
            return JSON.stringify({
                status: "success",
                result: {
                    name: item.name,
                    nodeId: item.nodeId,
                    mediaPath: item.getMediaPath ? item.getMediaPath() : "",
                    colorLabel: item.getColorLabel ? item.getColorLabel() : 0,
                    xmpMetadata: item.getXMPMetadata ? item.getXMPMetadata() : ""
                }
            });
        }

        if (action === "set_clip_metadata") {
            var item = findClipInProject(app.project.rootItem, p.clipName || p.nodeId);
            if (!item) throw new Error("Clip not found");
            if (p.colorLabel !== undefined && item.setColorLabel) item.setColorLabel(p.colorLabel);
            if (p.name) item.name = p.name;
            if (p.xmpMetadata && item.setXMPMetadata) item.setXMPMetadata(p.xmpMetadata);
            return JSON.stringify({ status: "success", result: { success: true, name: item.name } });
        }

        // 2. SEQUENCES & TIMELINES
        if (action === "list_sequences") {
            var seqList = [];
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                var s = app.project.sequences[i];
                seqList.push({
                    index: i,
                    id: s.id,
                    name: s.name,
                    sequenceID: s.sequenceID,
                    timebase: s.timebase,
                    durationSeconds: toSec(s.end),
                    videoTracksCount: s.videoTracks.numTracks,
                    audioTracksCount: s.audioTracks.numTracks,
                    isActive: (app.project.activeSequence && app.project.activeSequence.id === s.id)
                });
            }
            return JSON.stringify({ status: "success", result: seqList });
        }

        if (action === "get_sequence_details") {
            var s = app.project.activeSequence;
            if (p.sequenceName) {
                for (var i = 0; i < app.project.sequences.numSequences; i++) {
                    if (app.project.sequences[i].name === p.sequenceName) {
                        s = app.project.sequences[i];
                        break;
                    }
                }
            }
            if (!s) throw new Error("No active sequence found");
            var settings = s.getSettings ? s.getSettings() : {};
            return JSON.stringify({
                status: "success",
                result: {
                    id: s.id,
                    name: s.name,
                    sequenceID: s.sequenceID,
                    timebase: s.timebase,
                    durationSeconds: toSec(s.end),
                    inPointSeconds: toSec(s.getInPoint()),
                    outPointSeconds: toSec(s.getOutPoint()),
                    playerPositionSeconds: toSec(s.getPlayerPosition()),
                    videoTracksCount: s.videoTracks.numTracks,
                    audioTracksCount: s.audioTracks.numTracks,
                    width: settings.videoFrameWidth || 0,
                    height: settings.videoFrameHeight || 0
                }
            });
        }

        if (action === "create_sequence") {
            if (!p.name) throw new Error("Missing sequence name");
            var sid = p.sequenceID || ("seq_" + Date.now());
            var created = app.project.createNewSequence(p.name, sid);
            return JSON.stringify({ status: "success", result: { success: true, name: p.name, sequenceID: sid } });
        }

        if (action === "duplicate_sequence") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            var cloned = s.clone();
            if (p.newName && cloned) cloned.name = p.newName;
            return JSON.stringify({ status: "success", result: { success: true, newName: cloned ? cloned.name : s.name + " Copy" } });
        }

        if (action === "set_playhead_position") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            var ticks = toTicks(p.seconds);
            s.setPlayerPosition(ticks);
            return JSON.stringify({ status: "success", result: { positionSeconds: p.seconds } });
        }

        if (action === "get_playhead_position") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            var ticks = s.getPlayerPosition();
            return JSON.stringify({ status: "success", result: { positionSeconds: toSec(ticks), positionTicks: ticks.toString() } });
        }

        if (action === "set_in_out_points") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            if (p.inSeconds !== undefined) s.setInPoint(toTicks(p.inSeconds));
            if (p.outSeconds !== undefined) s.setOutPoint(toTicks(p.outSeconds));
            return JSON.stringify({ status: "success", result: { inSeconds: toSec(s.getInPoint()), outSeconds: toSec(s.getOutPoint()) } });
        }

        if (action === "clear_in_out_points") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            s.clearInPoint();
            s.clearOutPoint();
            return JSON.stringify({ status: "success", result: { cleared: true } });
        }

        // 3. TIMELINE CLIPS
        if (action === "list_timeline_clips") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            var clips = [];
            for (var v = 0; v < s.videoTracks.numTracks; v++) {
                var vt = s.videoTracks[v];
                for (var c = 0; c < vt.clips.numItems; c++) {
                    var clip = vt.clips[c];
                    var pi = clip.projectItem;
                    clips.push({
                        trackType: "video",
                        trackIndex: v,
                        clipIndex: c,
                        name: clip.name,
                        nodeId: clip.nodeId,
                        startSeconds: toSec(clip.start),
                        endSeconds: toSec(clip.end),
                        durationSeconds: toSec(clip.duration),
                        inPointSeconds: toSec(clip.inPoint),
                        outPointSeconds: toSec(clip.outPoint),
                        disabled: clip.disabled ? true : false,
                        mediaPath: (pi && pi.getMediaPath) ? pi.getMediaPath() : ""
                    });
                }
            }
            for (var a = 0; a < s.audioTracks.numTracks; a++) {
                var at = s.audioTracks[a];
                for (var ac = 0; ac < at.clips.numItems; ac++) {
                    var aClip = at.clips[ac];
                    var aPi = aClip.projectItem;
                    clips.push({
                        trackType: "audio",
                        trackIndex: a,
                        clipIndex: ac,
                        name: aClip.name,
                        nodeId: aClip.nodeId,
                        startSeconds: toSec(aClip.start),
                        endSeconds: toSec(aClip.end),
                        durationSeconds: toSec(aClip.duration),
                        inPointSeconds: toSec(aClip.inPoint),
                        outPointSeconds: toSec(aClip.outPoint),
                        disabled: aClip.disabled ? true : false,
                        mediaPath: (aPi && aPi.getMediaPath) ? aPi.getMediaPath() : ""
                    });
                }
            }
            return JSON.stringify({ status: "success", result: clips });
        }

        if (action === "insert_clip" || action === "overwrite_clip") {
            var s = app.project.activeSequence;
            if (!s) throw new Error("No active sequence");
            var item = findClipInProject(app.project.rootItem, p.clipName || p.nodeId);
            if (!item) throw new Error("Project item not found: " + (p.clipName || p.nodeId));

            var timeTicks = toTicks(p.timeSeconds !== undefined ? p.timeSeconds : toSec(s.getPlayerPosition()));
            var trackIndex = p.trackIndex !== undefined ? p.trackIndex : 0;
            var isAudio = p.trackType === "audio";
            var track = isAudio ? s.audioTracks[trackIndex] : s.videoTracks[trackIndex];
            if (!track) throw new Error("Track not found at index " + trackIndex);

            var ok = (action === "insert_clip") ? track.insertClip(item, timeTicks) : track.overwriteClip(item, timeTicks);
            return JSON.stringify({ status: "success", result: { success: ok, clipName: item.name, timeSeconds: toSec(timeTicks) } });
        }

        if (action === "razor_clip") {
            if (app.enableQE) app.enableQE();
            if (typeof qe === 'undefined') throw new Error("QE DOM unavailable");
            var qeSeq = qe.project.getActiveSequence();
            var isAudio = p.trackType === "audio";
            var track = isAudio ? qeSeq.getAudioTrackAt(p.trackIndex || 0) : qeSeq.getVideoTrackAt(p.trackIndex || 0);
            if (!track) throw new Error("QE Track not found");
            track.razor(p.timeSeconds ? p.timeSeconds.toString() : "0");
            return JSON.stringify({ status: "success", result: { success: true, timeSeconds: p.timeSeconds } });
        }

        if (action === "trim_clip") {
            var s = app.project.activeSequence;
            var track = (p.trackType === "audio") ? s.audioTracks[p.trackIndex] : s.videoTracks[p.trackIndex];
            var clip = track.clips[p.clipIndex];
            if (!clip) throw new Error("Clip not found");
            if (p.inSeconds !== undefined) clip.inPoint = toTicks(p.inSeconds);
            if (p.outSeconds !== undefined) clip.outPoint = toTicks(p.outSeconds);
            if (p.startSeconds !== undefined) clip.start = toTicks(p.startSeconds);
            if (p.endSeconds !== undefined) clip.end = toTicks(p.endSeconds);
            return JSON.stringify({ status: "success", result: { success: true, clipName: clip.name } });
        }

        if (action === "delete_clip") {
            var s = app.project.activeSequence;
            var track = (p.trackType === "audio") ? s.audioTracks[p.trackIndex] : s.videoTracks[p.trackIndex];
            var clip = track.clips[p.clipIndex];
            if (!clip) throw new Error("Clip not found");
            var name = clip.name;
            clip.remove(p.rippleDelete === true, true);
            return JSON.stringify({ status: "success", result: { deleted: name } });
        }

        // 4. MOTION, EFFECTS, AUDIO
        if (action === "set_clip_transform") {
            var s = app.project.activeSequence;
            var clip = s.videoTracks[p.trackIndex || 0].clips[p.clipIndex || 0];
            if (!clip) throw new Error("Clip not found");
            var motion = null;
            for (var c = 0; c < clip.components.numItems; c++) {
                if (clip.components[c].displayName === "Motion") { motion = clip.components[c]; break; }
            }
            if (!motion) throw new Error("Motion component not found");
            for (var pi = 0; pi < motion.properties.numItems; pi++) {
                var prop = motion.properties[pi];
                if (prop.displayName === "Position" && p.position) prop.setValue(p.position, true);
                if (prop.displayName === "Scale" && p.scale !== undefined) prop.setValue(p.scale, true);
                if (prop.displayName === "Rotation" && p.rotation !== undefined) prop.setValue(p.rotation, true);
            }
            return JSON.stringify({ status: "success", result: { success: true, clipName: clip.name } });
        }

        if (action === "list_clip_effects") {
            var s = app.project.activeSequence;
            var track = (p.trackType === "audio") ? s.audioTracks[p.trackIndex || 0] : s.videoTracks[p.trackIndex || 0];
            var clip = track.clips[p.clipIndex || 0];
            if (!clip) throw new Error("Clip not found");
            var list = [];
            for (var c = 0; c < clip.components.numItems; c++) {
                var comp = clip.components[c];
                var props = [];
                for (var pi = 0; pi < comp.properties.numItems; pi++) {
                    props.push({ displayName: comp.properties[pi].displayName, value: comp.properties[pi].getValue ? comp.properties[pi].getValue() : null });
                }
                list.push({ displayName: comp.displayName, properties: props });
            }
            return JSON.stringify({ status: "success", result: list });
        }

        // 5. MARKERS
        if (action === "list_markers") {
            var s = app.project.activeSequence;
            var markersList = [];
            var cur = s.markers.getFirstMarker();
            while (cur) {
                markersList.push({
                    name: cur.name,
                    comments: cur.comments,
                    startSeconds: toSec(cur.start),
                    endSeconds: toSec(cur.end),
                    type: cur.type
                });
                cur = s.markers.getNextMarker(cur);
            }
            return JSON.stringify({ status: "success", result: markersList });
        }

        if (action === "add_marker") {
            var s = app.project.activeSequence;
            var timeTicks = toTicks(p.timeSeconds !== undefined ? p.timeSeconds : toSec(s.getPlayerPosition()));
            var m = s.markers.createMarker(timeTicks);
            if (p.name) m.name = p.name;
            if (p.comments) m.comments = p.comments;
            if (p.durationSeconds) m.end = toTicks(toSec(timeTicks) + p.durationSeconds);
            if (m.setTypeAsComment) m.setTypeAsComment();
            return JSON.stringify({ status: "success", result: { name: m.name, timeSeconds: toSec(timeTicks) } });
        }

        if (action === "delete_marker") {
            var s = app.project.activeSequence;
            var cur = s.markers.getFirstMarker();
            var deleted = false;
            while (cur) {
                if ((p.name && cur.name === p.name) || (p.timeSeconds !== undefined && Math.abs(toSec(cur.start) - p.timeSeconds) < 0.1)) {
                    s.markers.deleteMarker(cur);
                    deleted = true;
                    break;
                }
                cur = s.markers.getNextMarker(cur);
            }
            return JSON.stringify({ status: "success", result: { deleted: deleted } });
        }

        // Fallback for custom or direct execution
        throw new Error("Action not handled by hostscript: " + action);

    } catch (err) {
        return JSON.stringify({
            status: "error",
            error: err.toString(),
            line: err.line || 0
        });
    }
}
