inlets=1;
outlets=1;

var log = require('./utils.js').log;
var origInputs = {};

var lo;

function updateTrackDisplay(track) {
  //if (track.get('is_foldable')[0] === 1) {
  var airt = JSON.parse(track.get('available_input_routing_types')).available_input_routing_types;
  if (!airt) {
    outlet(0, ['/toggleInput', 0]);
    return;
  }
  var currentInput = JSON.parse(track.get('input_routing_type')).input_routing_type;

  var noInput = airt[airt.length - 1]; // "No Input" is the last available input routing type

  if (currentInput.display_name !== noInput.display_name) {
    //post(track.id + " -X- " + "INPUTS ON\n");
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
  var airt = JSON.parse(liveObject.get('available_input_routing_types')).available_input_routing_types;
  if (!airt) {
    outlet(0, ['/toggleInput', 0]);
    return;
  }
  var currentInput = JSON.parse(liveObject.get('input_routing_type')).input_routing_type;

  var ret;
  var noInput = airt[airt.length - 1]; // "No Input" is the last available input routing type

  if (currentInput.display_name !== noInput.display_name) {
    origInputs[liveObject.id] = currentInput;
    // set to No Input
    ret = noInput;
  } else {
    // set to Original, default to All Inputs
    ret = origInputs[liveObject.id] || airt[0];
  }

  liveObject.set('input_routing_type', ret);
  updateTrackDisplay(liveObject);
}
