inlets=1;
outlets=1;

var origInputs = {};

var lo;
var debugLog = false;

function debug() {
  if (debugLog) {
    post(debug.caller ? debug.caller.name : 'ROOT', Array.prototype.slice.call(arguments).join(" "), "\n");
  }
}

debug("reloaded");

function getTrackStatus(track) {
  var airt = null;
  var currentInput = null;
  var noInput = null;
  var allInputs = null;
  var inputEnabled = false;
  if (track.get("can_be_armed") == "1") {
    var airt = JSON.parse(track.get('available_input_routing_types')).available_input_routing_types;
    currentInput = JSON.parse(track.get('input_routing_type')).input_routing_type;
    allInputs = airt[0];
    noInput = airt[airt.length - 1]; // "No Input" is the last available input routing type
    inputEnabled = currentInput.display_name !== noInput.display_name;
  }

  return { currentInput: currentInput, noInput: noInput, inputEnabled: inputEnabled, allInputs: allInputs };
}

function updateTrackDisplay(track) {
  var trackStatus = getTrackStatus(track);
  if (trackStatus.inputEnabled) {
    outlet(0, ['/toggleInput', 1]);
  } else {
    outlet(0, ['/toggleInput', 0]);
  }
}

function currentTrackCallback(a) {
  var args = arrayfromargs(a);
  if (args.shift() !== 'selected_track') {
    //post("RETURNING1\n");
    return;
  }
  var trackId = args.join(" ");
  if (trackId === 'id 0') {
    //post("RETURNING2\n");
    return;
  }
  //post("ARGS3: " + trackId + "\n");
  var track = new LiveAPI(trackId);
  updateTrackDisplay(track);
}

function init() {
  //post("INIT\n");
  lo = new LiveAPI(currentTrackCallback, 'live_set view');
  lo.property = 'selected_track';
}

function toggle() {
  var liveObject = new LiveAPI('live_set view selected_track');
  var trackStatus = getTrackStatus(liveObject);
  if (trackStatus.inputEnabled) {
    origInputs[liveObject.id] = trackStatus.currentInput;
    // set to No Input
    ret = trackStatus.noInput;
  } else {
    // set to Original, TODO default to All Inputs
    ret = origInputs[liveObject.id] || trackStatus.allInputs;
  }

  if (trackStatus.currentInput) {
    liveObject.set('input_routing_type', ret);
  }
  updateTrackDisplay(liveObject);
}
