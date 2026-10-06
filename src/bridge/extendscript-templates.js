import { TICKS_PER_SECOND } from './extendscript-helpers.js';

/**
 * Builds ExtendScript code string for any given action and parameters.
 * Used both by AppleScript bridge fallback and directly executable in CEP hostscript.
 */
export function buildExtendScript(action, params = {}) {
  const paramsJson = JSON.stringify(params);

  return `
var action = ${JSON.stringify(action)};
var params = ${paramsJson};

function executeActionInternal(act, p) {
    if (!app.project) {
        throw new Error("No active Adobe Premiere Pro project is open.");
    }

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

    // ----------------- A. PROJECT & MEDIA -----------------
    if (act === "get_project_info") {
        var seq = app.project.activeSequence;
        return {
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
        };
    }

    if (act === "save_project") {
        app.project.save();
        return { success: true, message: "Project saved successfully" };
    }

    if (act === "save_as_project") {
        if (!p.filePath) throw new Error("Missing filePath parameter");
        var saved = app.project.saveAs(p.filePath);
        return { success: saved, path: p.filePath };
    }

    if (act === "list_bins") {
        function traverseBin(item) {
            var node = {
                name: item.name,
                type: item.type, // 1 = CLIP, 2 = BIN, 3 = ROOT, 4 = FILE, etc.
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
        return traverseBin(app.project.rootItem);
    }

    if (act === "create_bin") {
        if (!p.name) throw new Error("Missing bin name parameter");
        var parentBin = app.project.rootItem;
        if (p.parentPath) {
            parentBin = findItemByPath(app.project.rootItem, p.parentPath);
            if (!parentBin) throw new Error("Parent bin not found: " + p.parentPath);
        }
        var newBin = parentBin.createBin(p.name);
        return {
            success: true,
            name: newBin.name,
            nodeId: newBin.nodeId
        };
    }

    if (act === "delete_bin" || act === "delete_project_item") {
        if (!p.name && !p.nodeId) throw new Error("Must specify name or nodeId");
        function findAndDelete(parent) {
            for (var i = 0; i < parent.children.numItems; i++) {
                var it = parent.children[i];
                if ((p.nodeId && it.nodeId === p.nodeId) || (p.name && it.name === p.name)) {
                    var deletedName = it.name;
                    it.deleteItem();
                    return { success: true, deleted: deletedName };
                }
                if (it.children && it.children.numItems > 0) {
                    var res = findAndDelete(it);
                    if (res) return res;
                }
            }
            return null;
        }
        var res = findAndDelete(app.project.rootItem);
        if (!res) throw new Error("Item not found to delete: " + (p.name || p.nodeId));
        return res;
    }

    if (act === "import_media") {
        if (!p.filePaths || !p.filePaths.length) throw new Error("Missing filePaths array");
        var targetBin = app.project.rootItem;
        if (p.targetBinPath) {
            targetBin = findItemByPath(app.project.rootItem, p.targetBinPath) || app.project.rootItem;
        }
        var suppressUI = true;
        var importAsNumberedStills = false;
        var imported = app.project.importFiles(p.filePaths, suppressUI, targetBin, importAsNumberedStills);
        return {
            success: imported,
            filesImported: p.filePaths,
            targetBin: targetBin.name
        };
    }

    if (act === "relink_media") {
        if (!p.clipName && !p.nodeId) throw new Error("Missing clipName or nodeId");
        if (!p.newMediaPath) throw new Error("Missing newMediaPath");
        function findClip(parent) {
            for (var i = 0; i < parent.children.numItems; i++) {
                var it = parent.children[i];
                if ((p.nodeId && it.nodeId === p.nodeId) || (p.clipName && it.name === p.clipName)) {
                    return it;
                }
                if (it.children && it.children.numItems > 0) {
                    var found = findClip(it);
                    if (found) return found;
                }
            }
            return null;
        }
        var item = findClip(app.project.rootItem);
        if (!item) throw new Error("Clip not found in project items");
        var relinked = item.changeMediaPath(p.newMediaPath, true);
        return { success: relinked, clipName: item.name, newPath: p.newMediaPath };
    }

    if (act === "get_clip_metadata") {
        if (!p.clipName && !p.nodeId) throw new Error("Missing clipName or nodeId");
        function findClip(parent) {
            for (var i = 0; i < parent.children.numItems; i++) {
                var it = parent.children[i];
                if ((p.nodeId && it.nodeId === p.nodeId) || (p.clipName && it.name === p.clipName)) {
                    return it;
                }
                if (it.children && it.children.numItems > 0) {
                    var found = findClip(it);
                    if (found) return found;
                }
            }
            return null;
        }
        var item = findClip(app.project.rootItem);
        if (!item) throw new Error("Clip not found");
        return {
            name: item.name,
            nodeId: item.nodeId,
            type: item.type,
            mediaPath: item.getMediaPath ? item.getMediaPath() : "",
            colorLabel: item.getColorLabel ? item.getColorLabel() : 0,
            xmpMetadata: item.getXMPMetadata ? item.getXMPMetadata() : ""
        };
    }

    if (act === "set_clip_metadata") {
        if (!p.clipName && !p.nodeId) throw new Error("Missing clipName or nodeId");
        function findClip(parent) {
            for (var i = 0; i < parent.children.numItems; i++) {
                var it = parent.children[i];
                if ((p.nodeId && it.nodeId === p.nodeId) || (p.clipName && it.name === p.clipName)) {
                    return it;
                }
                if (it.children && it.children.numItems > 0) {
                    var found = findClip(it);
                    if (found) return found;
                }
            }
            return null;
        }
        var item = findClip(app.project.rootItem);
        if (!item) throw new Error("Clip not found");
        if (p.colorLabel !== undefined && item.setColorLabel) {
            item.setColorLabel(p.colorLabel);
        }
        if (p.name && item.name) {
            item.name = p.name;
        }
        if (p.xmpMetadata && item.setXMPMetadata) {
            item.setXMPMetadata(p.xmpMetadata);
        }
        return { success: true, name: item.name, colorLabel: item.getColorLabel ? item.getColorLabel() : 0 };
    }

    // ----------------- B. SEQUENCE & TIMELINE -----------------
    if (act === "list_sequences") {
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
        return seqList;
    }

    if (act === "get_sequence_details") {
        var s = app.project.activeSequence;
        if (p.sequenceName) {
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                if (app.project.sequences[i].name === p.sequenceName) {
                    s = app.project.sequences[i];
                    break;
                }
            }
        }
        if (!s) throw new Error("Sequence not found or no active sequence");
        var settings = s.getSettings ? s.getSettings() : {};
        return {
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
            height: settings.videoFrameHeight || 0,
            frameRate: settings.videoFrameRate ? settings.videoFrameRate.fps : 0,
            pixelAspectRatio: settings.videoPixelAspectRatio || 1
        };
    }

    if (act === "create_sequence") {
        if (!p.name) throw new Error("Missing sequence name");
        var seqId = p.sequenceID || ("seq_" + Date.now());
        var created = app.project.createNewSequence(p.name, seqId);
        return {
            success: true,
            name: p.name,
            sequenceID: seqId
        };
    }

    if (act === "duplicate_sequence") {
        var s = app.project.activeSequence;
        if (p.sequenceName) {
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                if (app.project.sequences[i].name === p.sequenceName) {
                    s = app.project.sequences[i];
                    break;
                }
            }
        }
        if (!s) throw new Error("Active sequence not found to duplicate");
        var cloned = s.clone();
        if (p.newName && cloned) {
            cloned.name = p.newName;
        }
        return {
            success: true,
            originalName: s.name,
            newName: cloned ? cloned.name : (s.name + " Copy"),
            clonedId: cloned ? cloned.id : null
        };
    }

    if (act === "set_playhead_position") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (p.seconds === undefined) throw new Error("Missing seconds parameter");
        var ticks = toTicks(p.seconds);
        s.setPlayerPosition(ticks);
        return { success: true, positionSeconds: p.seconds, positionTicks: ticks };
    }

    if (act === "get_playhead_position") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var posTicks = s.getPlayerPosition();
        return {
            positionSeconds: toSec(posTicks),
            positionTicks: posTicks.toString()
        };
    }

    if (act === "set_in_out_points") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (p.inSeconds !== undefined) s.setInPoint(toTicks(p.inSeconds));
        if (p.outSeconds !== undefined) s.setOutPoint(toTicks(p.outSeconds));
        return {
            success: true,
            inPointSeconds: toSec(s.getInPoint()),
            outPointSeconds: toSec(s.getOutPoint())
        };
    }

    if (act === "clear_in_out_points") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (s.clearInPoint) s.clearInPoint();
        if (s.clearOutPoint) s.clearOutPoint();
        return { success: true, message: "In and Out points cleared" };
    }

    // ----------------- C. TIMELINE CLIPS & EDITING -----------------
    if (act === "list_timeline_clips") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");

        var clips = [];
        // Video Tracks
        for (var v = 0; v < s.videoTracks.numTracks; v++) {
            var vt = s.videoTracks[v];
            for (var c = 0; c < vt.clips.numItems; c++) {
                var clip = vt.clips[c];
                var pi = clip.projectItem;
                clips.push({
                    trackType: "video",
                    trackIndex: v,
                    trackName: vt.name || ("V" + (v + 1)),
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
        // Audio Tracks
        for (var a = 0; a < s.audioTracks.numTracks; a++) {
            var at = s.audioTracks[a];
            for (var ac = 0; ac < at.clips.numItems; ac++) {
                var aClip = at.clips[ac];
                var aPi = aClip.projectItem;
                clips.push({
                    trackType: "audio",
                    trackIndex: a,
                    trackName: at.name || ("A" + (a + 1)),
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
        return clips;
    }

    if (act === "insert_clip" || act === "overwrite_clip") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (!p.clipName && !p.nodeId) throw new Error("Missing clipName or nodeId");

        function findClip(parent) {
            for (var i = 0; i < parent.children.numItems; i++) {
                var it = parent.children[i];
                if ((p.nodeId && it.nodeId === p.nodeId) || (p.clipName && it.name === p.clipName)) {
                    return it;
                }
                if (it.children && it.children.numItems > 0) {
                    var found = findClip(it);
                    if (found) return found;
                }
            }
            return null;
        }

        var item = findClip(app.project.rootItem);
        if (!item) throw new Error("Project item not found: " + (p.clipName || p.nodeId));

        var timeTicks = toTicks(p.timeSeconds !== undefined ? p.timeSeconds : toSec(s.getPlayerPosition()));
        var trackIndex = p.trackIndex !== undefined ? p.trackIndex : 0;
        var isAudio = p.trackType === "audio";

        var track = isAudio ? s.audioTracks[trackIndex] : s.videoTracks[trackIndex];
        if (!track) throw new Error("Track not found at index " + trackIndex);

        var success = false;
        if (act === "insert_clip") {
            success = track.insertClip(item, timeTicks);
        } else {
            success = track.overwriteClip(item, timeTicks);
        }

        return {
            success: success,
            action: act,
            clipName: item.name,
            trackType: isAudio ? "audio" : "video",
            trackIndex: trackIndex,
            timeSeconds: toSec(timeTicks)
        };
    }

    if (act === "razor_clip") {
        if (p.timeSeconds === undefined) throw new Error("Missing timeSeconds parameter");
        if (app.enableQE) {
            app.enableQE();
        }
        if (typeof qe === 'undefined') {
            throw new Error("QE DOM is required for razor_clip. Call app.enableQE() failed.");
        }
        var qeSeq = qe.project.getActiveSequence();
        if (!qeSeq) throw new Error("No active QE sequence");

        var trackIndex = p.trackIndex !== undefined ? p.trackIndex : 0;
        var isAudio = p.trackType === "audio";
        var track = isAudio ? qeSeq.getAudioTrackAt(trackIndex) : qeSeq.getVideoTrackAt(trackIndex);
        if (!track) throw new Error("QE Track not found at index " + trackIndex);

        var timeString = p.timeCode || "";
        if (!timeString) {
            // Convert seconds to approximate timecode or pass seconds
            timeString = p.timeSeconds.toString();
        }
        track.razor(timeString);

        return {
            success: true,
            trackType: isAudio ? "audio" : "video",
            trackIndex: trackIndex,
            timeSeconds: p.timeSeconds
        };
    }

    if (act === "trim_clip") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (p.trackIndex === undefined || p.clipIndex === undefined) {
            throw new Error("Missing trackIndex or clipIndex");
        }
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex] : s.videoTracks[p.trackIndex];
        if (!track) throw new Error("Track not found");
        var clip = track.clips[p.clipIndex];
        if (!clip) throw new Error("Clip not found on track");

        if (p.inSeconds !== undefined) clip.inPoint = toTicks(p.inSeconds);
        if (p.outSeconds !== undefined) clip.outPoint = toTicks(p.outSeconds);
        if (p.startSeconds !== undefined) clip.start = toTicks(p.startSeconds);
        if (p.endSeconds !== undefined) clip.end = toTicks(p.endSeconds);

        return {
            success: true,
            clipName: clip.name,
            startSeconds: toSec(clip.start),
            endSeconds: toSec(clip.end),
            inPointSeconds: toSec(clip.inPoint),
            outPointSeconds: toSec(clip.outPoint)
        };
    }

    if (act === "delete_clip") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex] : s.videoTracks[p.trackIndex];
        if (!track) throw new Error("Track not found");
        var clip = track.clips[p.clipIndex];
        if (!clip) throw new Error("Clip not found");
        var ripple = p.rippleDelete === true;
        var alignToFeed = true;
        var name = clip.name;
        clip.remove(ripple, alignToFeed);
        return { success: true, deletedClip: name, ripple: ripple };
    }

    if (act === "enable_disable_clip") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex] : s.videoTracks[p.trackIndex];
        if (!track) throw new Error("Track not found");
        var clip = track.clips[p.clipIndex];
        if (!clip) throw new Error("Clip not found");
        if (p.enabled !== undefined) {
            clip.disabled = !p.enabled;
        } else {
            clip.disabled = !clip.disabled;
        }
        return { success: true, clipName: clip.name, enabled: !clip.disabled };
    }

    if (act === "track_management") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex] : s.videoTracks[p.trackIndex];
        if (!track) throw new Error("Track not found");

        if (p.locked !== undefined && track.setLocked) track.setLocked(p.locked ? 1 : 0);
        if (isAudio) {
            if (p.muted !== undefined && track.setMute) track.setMute(p.muted ? 1 : 0);
            if (p.solo !== undefined && track.setSolo) track.setSolo(p.solo ? 1 : 0);
        }

        return {
            success: true,
            trackIndex: p.trackIndex,
            trackType: p.trackType,
            locked: track.isLocked ? track.isLocked() : false,
            muted: isAudio && track.isMuted ? track.isMuted() : false
        };
    }

    // ----------------- D. MOTION, TRANSFORM & KEYFRAMING -----------------
    if (act === "set_clip_transform") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var track = s.videoTracks[p.trackIndex !== undefined ? p.trackIndex : 0];
        if (!track) throw new Error("Video track not found");
        var clip = track.clips[p.clipIndex !== undefined ? p.clipIndex : 0];
        if (!clip) throw new Error("Clip not found on video track");

        var motionComponent = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.displayName === "Motion" || comp.matchName === "AE.ADBE Motion") {
                motionComponent = comp;
                break;
            }
        }
        if (!motionComponent) throw new Error("Motion component not found on clip");

        var updated = {};
        for (var pi = 0; pi < motionComponent.properties.numItems; pi++) {
            var prop = motionComponent.properties[pi];
            if (prop.displayName === "Position" && p.position) {
                prop.setValue(p.position, true); // [x, y]
                updated.position = p.position;
            }
            if (prop.displayName === "Scale" && p.scale !== undefined) {
                prop.setValue(p.scale, true);
                updated.scale = p.scale;
            }
            if (prop.displayName === "Scale Width" && p.scaleWidth !== undefined) {
                prop.setValue(p.scaleWidth, true);
                updated.scaleWidth = p.scaleWidth;
            }
            if (prop.displayName === "Rotation" && p.rotation !== undefined) {
                prop.setValue(p.rotation, true);
                updated.rotation = p.rotation;
            }
            if (prop.displayName === "Anchor Point" && p.anchorPoint) {
                prop.setValue(p.anchorPoint, true);
                updated.anchorPoint = p.anchorPoint;
            }
        }
        return { success: true, clipName: clip.name, updated: updated };
    }

    if (act === "set_clip_opacity") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var track = s.videoTracks[p.trackIndex !== undefined ? p.trackIndex : 0];
        var clip = track.clips[p.clipIndex !== undefined ? p.clipIndex : 0];
        if (!clip) throw new Error("Clip not found");

        var opacityComp = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.displayName === "Opacity" || comp.matchName === "AE.ADBE Opacity") {
                opacityComp = comp;
                break;
            }
        }
        if (!opacityComp) throw new Error("Opacity component not found on clip");

        for (var pi = 0; pi < opacityComp.properties.numItems; pi++) {
            var prop = opacityComp.properties[pi];
            if (prop.displayName === "Opacity" && p.opacity !== undefined) {
                prop.setValue(p.opacity, true);
            }
        }
        return { success: true, clipName: clip.name, opacity: p.opacity };
    }

    if (act === "add_keyframe") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex || 0] : s.videoTracks[p.trackIndex || 0];
        var clip = track.clips[p.clipIndex || 0];
        if (!clip) throw new Error("Clip not found");

        var targetComp = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.displayName === p.componentName || comp.matchName === p.componentName) {
                targetComp = comp;
                break;
            }
        }
        if (!targetComp) throw new Error("Component not found: " + p.componentName);

        var targetProp = null;
        for (var pi = 0; pi < targetComp.properties.numItems; pi++) {
            var prop = targetComp.properties[pi];
            if (prop.displayName === p.propertyName) {
                targetProp = prop;
                break;
            }
        }
        if (!targetProp) throw new Error("Property not found: " + p.propertyName);

        if (!targetProp.isTimeVarying()) {
            targetProp.setTimeVarying(true);
        }

        var keyTicks = toTicks(p.timeSeconds !== undefined ? p.timeSeconds : toSec(s.getPlayerPosition()));
        targetProp.addKey(keyTicks);
        if (p.value !== undefined) {
            targetProp.setValueAtKey(keyTicks, p.value, true);
        }

        return {
            success: true,
            component: p.componentName,
            property: p.propertyName,
            timeSeconds: toSec(keyTicks),
            value: p.value
        };
    }

    // ----------------- E. EFFECTS & COLOR GRADING -----------------
    if (act === "list_clip_effects") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex || 0] : s.videoTracks[p.trackIndex || 0];
        var clip = track.clips[p.clipIndex || 0];
        if (!clip) throw new Error("Clip not found");

        var compList = [];
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            var props = [];
            for (var pi = 0; pi < comp.properties.numItems; pi++) {
                var prop = comp.properties[pi];
                props.push({
                    displayName: prop.displayName,
                    value: prop.getValue ? prop.getValue() : null
                });
            }
            compList.push({
                displayName: comp.displayName,
                matchName: comp.matchName,
                properties: props
            });
        }
        return compList;
    }

    if (act === "adjust_effect_parameter") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var isAudio = p.trackType === "audio";
        var track = isAudio ? s.audioTracks[p.trackIndex || 0] : s.videoTracks[p.trackIndex || 0];
        var clip = track.clips[p.clipIndex || 0];
        if (!clip) throw new Error("Clip not found");

        var foundComp = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.displayName === p.effectName || comp.matchName === p.effectName) {
                foundComp = comp;
                break;
            }
        }
        if (!foundComp) throw new Error("Effect not found on clip: " + p.effectName);

        var foundProp = null;
        for (var pi = 0; pi < foundComp.properties.numItems; pi++) {
            var prop = foundComp.properties[pi];
            if (prop.displayName === p.parameterName) {
                foundProp = prop;
                break;
            }
        }
        if (!foundProp) throw new Error("Parameter not found: " + p.parameterName);

        foundProp.setValue(p.value, true);
        return {
            success: true,
            effectName: p.effectName,
            parameterName: p.parameterName,
            newValue: p.value
        };
    }

    if (act === "apply_lumetri_grade") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var track = s.videoTracks[p.trackIndex || 0];
        var clip = track.clips[p.clipIndex || 0];
        if (!clip) throw new Error("Clip not found");

        var lumetriComp = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.displayName.indexOf("Lumetri") !== -1 || comp.matchName.indexOf("Lumetri") !== -1) {
                lumetriComp = comp;
                break;
            }
        }

        if (!lumetriComp) {
            // Try to add Lumetri effect via QE if available
            if (app.enableQE) app.enableQE();
            if (typeof qe !== 'undefined') {
                var qeSeq = qe.project.getActiveSequence();
                var qeClip = qeSeq.getVideoTrackAt(p.trackIndex || 0).getItemAt(p.clipIndex || 0);
                if (qeClip && qeClip.addVideoEffect) {
                    var lumEffect = qe.project.getVideoEffectByName("Lumetri Color");
                    if (lumEffect) qeClip.addVideoEffect(lumEffect);
                }
            }
            // Re-find component
            for (var c2 = 0; c2 < clip.components.numItems; c2++) {
                if (clip.components[c2].displayName.indexOf("Lumetri") !== -1) {
                    lumetriComp = clip.components[c2];
                    break;
                }
            }
        }

        if (!lumetriComp) throw new Error("Lumetri Color effect could not be found or applied");

        var modified = {};
        for (var pi = 0; pi < lumetriComp.properties.numItems; pi++) {
            var prop = lumetriComp.properties[pi];
            var propName = prop.displayName.toLowerCase();

            if (p.exposure !== undefined && propName.indexOf("exposure") !== -1) {
                prop.setValue(p.exposure, true);
                modified.exposure = p.exposure;
            }
            if (p.contrast !== undefined && propName.indexOf("contrast") !== -1) {
                prop.setValue(p.contrast, true);
                modified.contrast = p.contrast;
            }
            if (p.highlights !== undefined && propName.indexOf("highlights") !== -1) {
                prop.setValue(p.highlights, true);
                modified.highlights = p.highlights;
            }
            if (p.shadows !== undefined && propName.indexOf("shadows") !== -1) {
                prop.setValue(p.shadows, true);
                modified.shadows = p.shadows;
            }
            if (p.whites !== undefined && propName.indexOf("whites") !== -1) {
                prop.setValue(p.whites, true);
                modified.whites = p.whites;
            }
            if (p.blacks !== undefined && propName.indexOf("blacks") !== -1) {
                prop.setValue(p.blacks, true);
                modified.blacks = p.blacks;
            }
            if (p.saturation !== undefined && propName.indexOf("saturation") !== -1) {
                prop.setValue(p.saturation, true);
                modified.saturation = p.saturation;
            }
            if (p.temperature !== undefined && propName.indexOf("temperature") !== -1) {
                prop.setValue(p.temperature, true);
                modified.temperature = p.temperature;
            }
            if (p.tint !== undefined && propName.indexOf("tint") !== -1) {
                prop.setValue(p.tint, true);
                modified.tint = p.tint;
            }
        }

        return { success: true, clipName: clip.name, appliedSettings: modified };
    }

    // ----------------- F. AUDIO & SOUND -----------------
    if (act === "set_clip_volume") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var track = s.audioTracks[p.trackIndex || 0];
        var clip = track.clips[p.clipIndex || 0];
        if (!clip) throw new Error("Audio clip not found");

        var volComp = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.displayName === "Volume" || comp.matchName === "AE.ADBE Audio Volume") {
                volComp = comp;
                break;
            }
        }
        if (!volComp) throw new Error("Volume component not found on audio clip");

        for (var pi = 0; pi < volComp.properties.numItems; pi++) {
            var prop = volComp.properties[pi];
            if (prop.displayName === "Level" || prop.displayName === "Volume") {
                prop.setValue(p.volumeLevel, true);
            }
        }
        return { success: true, clipName: clip.name, volumeLevel: p.volumeLevel };
    }

    // ----------------- G. MOGRT & GRAPHICS -----------------
    if (act === "import_mogrt") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (!p.mogrtPath) throw new Error("Missing mogrtPath");

        var timeTicks = toTicks(p.timeSeconds !== undefined ? p.timeSeconds : toSec(s.getPlayerPosition()));
        var vTrack = p.videoTrackIndex !== undefined ? p.videoTrackIndex : 0;
        var aTrack = p.audioTrackIndex !== undefined ? p.audioTrackIndex : 0;

        var trackItem = s.importMGT(p.mogrtPath, timeTicks, vTrack, aTrack);
        return {
            success: trackItem ? true : false,
            mogrtPath: p.mogrtPath,
            videoTrackIndex: vTrack,
            timeSeconds: toSec(timeTicks)
        };
    }

    if (act === "update_mogrt_text") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var track = s.videoTracks[p.trackIndex || 0];
        var clip = track.clips[p.clipIndex || 0];
        if (!clip) throw new Error("Clip not found on track");

        var graphicComp = null;
        for (var c = 0; c < clip.components.numItems; c++) {
            var comp = clip.components[c];
            if (comp.matchName === "AE.ADBE Graphic Component" || comp.displayName.indexOf("Graphic") !== -1) {
                graphicComp = comp;
                break;
            }
        }
        if (!graphicComp) throw new Error("Graphic component not found on MOGRT clip");

        var updated = false;
        for (var pi = 0; pi < graphicComp.properties.numItems; pi++) {
            var prop = graphicComp.properties[pi];
            if (p.propertyName && prop.displayName === p.propertyName) {
                prop.setValue(p.textValue, true);
                updated = true;
                break;
            } else if (!p.propertyName && (prop.displayName.indexOf("Text") !== -1 || prop.displayName.indexOf("Title") !== -1)) {
                prop.setValue(p.textValue, true);
                updated = true;
                break;
            }
        }
        return { success: updated, clipName: clip.name, newText: p.textValue };
    }

    // ----------------- H. MARKERS -----------------
    if (act === "list_markers") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var markersList = [];
        var cur = s.markers.getFirstMarker();
        while (cur) {
            markersList.push({
                name: cur.name,
                comments: cur.comments,
                startSeconds: toSec(cur.start),
                endSeconds: toSec(cur.end),
                type: cur.type,
                colorIndex: cur.getColorByIndex ? cur.getColorByIndex() : 0
            });
            cur = s.markers.getNextMarker(cur);
        }
        return markersList;
    }

    if (act === "add_marker") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var timeTicks = toTicks(p.timeSeconds !== undefined ? p.timeSeconds : toSec(s.getPlayerPosition()));
        var marker = s.markers.createMarker(timeTicks);
        if (p.name) marker.name = p.name;
        if (p.comments) marker.comments = p.comments;
        if (p.durationSeconds) marker.end = toTicks(toSec(timeTicks) + p.durationSeconds);
        if (p.colorIndex !== undefined && marker.setColorByIndex) marker.setColorByIndex(p.colorIndex);
        if (marker.setTypeAsComment) marker.setTypeAsComment();

        return {
            success: true,
            name: marker.name,
            comments: marker.comments,
            timeSeconds: toSec(timeTicks)
        };
    }

    if (act === "delete_marker") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        var cur = s.markers.getFirstMarker();
        var deleted = false;
        while (cur) {
            var startSec = toSec(cur.start);
            if ((p.name && cur.name === p.name) || (p.timeSeconds !== undefined && Math.abs(startSec - p.timeSeconds) < 0.1)) {
                s.markers.deleteMarker(cur);
                deleted = true;
                break;
            }
            cur = s.markers.getNextMarker(cur);
        }
        return { success: deleted };
    }

    // ----------------- J. EXPORT -----------------
    if (act === "export_sequence_direct") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (!p.outputPath) throw new Error("Missing outputPath");
        var presetPath = p.presetPath || "";
        var workAreaType = p.workAreaType || 0; // 0 = Entire Sequence, 1 = In to Out
        var result = s.exportAsMediaDirect(p.outputPath, presetPath, workAreaType);
        return { success: result, outputPath: p.outputPath };
    }

    if (act === "queue_to_media_encoder") {
        var s = app.project.activeSequence;
        if (!s) throw new Error("No active sequence");
        if (!p.outputPath) throw new Error("Missing outputPath");
        var presetPath = p.presetPath || "";
        var queued = app.encoder.encodeSequence(s, p.outputPath, presetPath, 0, 1);
        return { success: queued, outputPath: p.outputPath };
    }

    throw new Error("Unknown action: " + act);
}

var res = executeActionInternal(action, params);
return JSON.stringify({ status: "success", result: res });
`;
}
