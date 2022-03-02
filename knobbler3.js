autowatch = 1;
outlets = 7;

var OUTLET_MIDI = 0;
var OUTLET_PARAM_NAME = 1;
var OUTLET_DEVICE_NAME = 2;
var OUTLET_TRACK_NAME = 3;
var OUTLET_MAPPED = 4;
var OUTLET_MAP_ID = 5;
var OUTLET_MAP_PATH = 6;

var paramObj = null;
var paramNameObj = null;
var deviceObj = null;
var trackObj = null;

var param = {};
var outMin;
var outMax;

var nullString = "- - -";

var allowMapping = true;
var allowParamValueUpdates = true;
var allowUpdateFromMidi = true;
var initMappingDone = false;

var deviceCheckerTask = null;
var allowParamValueUpdatesTask = null;

var debugLog = true;

post("zreloaded\n");

function setInitMapping(objId) {
  post("SET_INIT_MAPPING", objId, "\n");
  initMappingId = parseInt(objId);
}

function doInit() {
  post("INIT_MAPPING=", initMappingId, "DONE=", initMappingDone, "\n");
  init();
  if (!initMappingDone) {
    initMappingDone = true;
    if (initMappingId > 0) {
      //post("INIT_MAPPING_ID", initMappingId, "\n");
      setPath(["id", initMappingId]);
    }
  }
}

function init() {
  debug("INIT\n");
  if (paramObj) {
    // clean up callbacks when unmapping
    paramObj.id = 0;
  }
  paramObj = null;
  param = {};
  sendNames();
  outlet(OUTLET_MIDI, 0);
  outlet(OUTLET_MAPPED, false);
  if (initMappingDone) {
    outlet(OUTLET_MAP_ID, 0);
    outlet(OUTLET_MAP_PATH, '');
  }
  if (deviceCheckerTask !== null) {
    deviceCheckerTask.cancel();
    deviceCheckerTask = null;
  }
}

function debug() {
  if (debugLog) {
    post(Array.prototype.slice.call(arguments).join(" "));
  }
}

function setMin(val) {
  debug('MIN', val, "\n");
  outMin = parseFloat(val) / 100;
  if (param.val !== undefined) {
    updateMidiVal();
  }
}

function setMax(val) {
  debug('MAX', val, "\n");
  outMax = parseFloat(val) / 100;
  if (param.val !== undefined) {
    updateMidiVal();
  }
}

function paramValueCallback(args) {
  // This function is called whenever the parameter value changes,
  // either via mapped MIDI control or by changing the device directly.
  // We need to distinguish between the two and not do anything if the
  // value was changed due to MIDI input. Otherwise, since we would create a feedback
  // loop since this the purpose of this function is to update the displayed
  // value on the MIDI controller to show automation or direct manipulation.
  // We accomplish this by keeping a timestamp of the last time MIDI data was
  // received, and only taking action here if more than 500ms has passed.

  debug('VALUE_CALLBACK', args, "ALLOW_UPDATES=", allowParamValueUpdates, "\n");
  if (allowParamValueUpdates) { // ensure 500ms has passed since receiving MIDI values
    var args = arrayfromargs(args);
    if (args[0] === 'value') {
      //post("PARAM_VAL", typeof(args[1]), args[1], "\n");
      param.val = args[1];
      updateMidiVal();
    }
  }
}

function paramNameCallback(args) {
  debug('PARAM_NAME_CALLBACK', args, "\n");
  var args = arrayfromargs(args);
  if (args[0] === 'name') {
    param.name = args[1];
    sendNames();
  }
}

function deviceNameCallback(args) {
  debug('DEVICE_NAME_CALLBACK', args, "\n");
  var args = arrayfromargs(args);
  if (args[0] === 'name') {
    param.deviceName = args[1];
    sendNames();
  }
}

function trackNameCallback(args) {
  debug('TRACK_NAME_CALLBACK', args, "\n");
  var args = arrayfromargs(args);
  if (args[0] === 'name') {
    param.trackName = args[1];
    sendNames();
  }
}

function checkDevicePresent() {
  if (!deviceObj.unquotedpath) {
    debug('DEVICE DELETED');
    init();
  }
}

function setPath(paramPath) {
  debug('SET_PATH', paramPath, "\n");
  paramObj = new LiveAPI(paramValueCallback, paramPath);
  paramObj.property = "value";
  paramNameObj = new LiveAPI(paramNameCallback, paramPath);
  paramNameObj.property = "name";

  param = {
    id: parseInt(paramObj.id),
    path: paramObj.unquotedpath,
    val: parseFloat(paramObj.get("value")),
    min: parseFloat(paramObj.get("min")) || 0,
    max: parseFloat(paramObj.get("max")) || 1,
    name: paramObj.get("name"),
  };

  deviceObj = new LiveAPI(deviceNameCallback, paramObj.get("canonical_parent"));

  var devicePath = deviceObj.unquotedpath;

  // poll to see if the mapped device is still present
  deviceCheckerTask = new Task(checkDevicePresent)
  deviceCheckerTask.repeat();

  // Only get the device name if it has the name property
  if (deviceObj.info.match(/property name str/)) {
    deviceObj.property = "name";
    param.deviceName = deviceObj.get("name");
  } else if (param.path.match(/mixer_device/)) {
    param.deviceName = 'Mixer';
  }

  // Try to get the track name
  var matches = (
    devicePath.match(/^live_set tracks \d+/)
    ||
    devicePath.match(/^live_set return_tracks \d+/)
    ||
    devicePath.match(/^live_set master_track/)
  );
  if (matches) {
    debug("TRACK_PATH", matches[0], "\n");
    trackObj = new LiveAPI(trackNameCallback, matches[0]);
    trackObj.property = "name";
    param.trackName = trackObj.get("name");
  }

  //post("PARAM DATA", JSON.stringify(param), "\n");
  outlet(OUTLET_MAPPED, true);
  outlet(OUTLET_MAP_ID, param.id);
  outlet(OUTLET_MAP_PATH, param.path);

  // Defer outputting the new MIDI val because the controller
  // will not process it since it was just sending other vals
  // that triggered the mapping.
  (new Task( function() { updateMidiVal(); } )).schedule(333);

  sendNames();
}

function sendNames() {
  debug("SEND_NAMES", param.name, param.deviceName, param.trackName, "\n");
  outlet(OUTLET_PARAM_NAME,  (param.name       ? param.name.toString().replace(/^"|"$/g, '')       : nullString));
  outlet(OUTLET_DEVICE_NAME, (param.deviceName ? param.deviceName.toString().replace(/^"|"$/g, '') : nullString));
  outlet(OUTLET_TRACK_NAME,  (param.trackName  ? param.trackName.toString().replace(/^"|"$/g, '')  : nullString));
}

function updateMidiVal() {
  debug("UPDATE_MIDI_VAL\n");
  // protect against divide-by-zero errors
  if (outMax === outMin) {
    if (outMax === 1) {
      outMin = 0.99;
    } else if (outMax === 0) {
      outMax = 0.01;
    }
  }

  // the value, expressed as a proportion between the param min and max
  var valProp = (param.val - param.min) / (param.max - param.min);

  // scale the param proportion value to the output min/max proportion
  var scaledValProp = ((valProp - outMin) / (outMax - outMin));

  scaledValProp = Math.min(scaledValProp, 1);
  scaledValProp = Math.max(scaledValProp, 0);

  //post("PROP", valProp, scaledValProp, 127 * scaledValProp, outMin, outMax, "\n");
  var midiVal = parseInt(127 * scaledValProp);
  //post("MIDIVAL", midiVal, "\n");

  outlet(OUTLET_MIDI, midiVal);
}

function clearPath() {
  debug("CLEARPATH", "\n");
  init();
}

function midiVal(midiVal) {
  debug("MIDIVAL", paramObj, "\n");
  if (paramObj) {
    if (allowUpdateFromMidi) {
      //post('INVAL', midiVal, 'OUTMIN', outMin, 'OUTMAX', outMax, '\n');
      var propMidiVal = midiVal / 127;
      var scaledMidiVal = ((outMax - outMin) * propMidiVal) + outMin;
      param.val = ((param.max - param.min) * scaledMidiVal) + param.min;

      // prevent updates from params directly being sent to MIDI for 500ms
      if (allowParamValueUpdates) {
        allowParamValueUpdates = false;
        if (allowParamValueUpdatesTask !== null) {
          allowParamValueUpdatesTask.cancel();
        }
        allowParamValueUpdatesTask = new Task( function() { allowParamValueUpdates = true; } );
        allowParamValueUpdatesTask.schedule(500);
      }

      //post('PARAMVAL', param.val, "\n");
      paramObj.set("value", param.val);
    }
  } else {
    debug("GONNA_MAP", "ALLOWED=", allowMapping, "\n");
    // If we get a MIDI CC but are unassigned, trigger a mapping.
    // This removes a step from typical mapping.
    if (allowMapping) {
      // debounce mapping, since moving the CC will trigger many message
      allowMapping = false;
      (new Task( function() { allowMapping = true; } )).schedule(1000);

      // wait 500ms before paying attention to MIDI values again after mapping
      if (allowUpdateFromMidi) {
        allowUpdateFromMidi = false;
        (new Task( function() { allowUpdateFromMidi = true; } )).schedule(500);
      }

      //post("PRE-SELOBJ\n");
      var selObj = new LiveAPI("live_set view selected_parameter");
      // Only map things that have a 'value' property

      if (!selObj.unquotedpath) {
        post("No Live param is selected.\n");
      } else {
        //post("SELOBJ", selObj.unquotedpath, "\n");
        //post("SELOBJINFO", selObj.info, "\n");

        if (selObj.info.match(/property value/)) {
          setPath(selObj.unquotedpath);
        }
      }
    }
  }
}
