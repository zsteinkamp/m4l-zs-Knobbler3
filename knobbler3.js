autowatch = 1;
outlets = 6;

var OUTLET_MIDI = 0;
var OUTLET_PARAM_NAME = 1;
var OUTLET_DEVICE_NAME = 2;
var OUTLET_TRACK_NAME = 3;
var OUTLET_MAPPED = 4;
var OUTLET_MAP_ID = 5;

var api;
var param = {};
var outMin;
var outMax;

var nullString = "- - -";

var allowMapping = true;
var allowParamValueUpdates = true;
var allowUpdateFromMidi = true;
var initMappingDone = false;

init();

post("\n");

function init() {
  api = null;
  param = {};
  sendNames();
  outlet(OUTLET_MIDI, 0);
  outlet(OUTLET_MAPPED, false);
  if (true || initMappingDone) {
    outlet(OUTLET_MAP_ID, 0);
  }
}

function setMin(val) {
  //post('MIN', val);
  outMin = parseFloat(val) / 100;
  if (param.val !== undefined) {
    updateMidiVal();
  }
}

function setMax(val) {
  //post('MAX', val);
  outMax = parseFloat(val) / 100;
  if (param.val !== undefined) {
    updateMidiVal();
  }
}

function valueCallback(args) {
  // This function is called whenever the parameter value changes,
  // either via mapped MIDI control or by changing the device directly.
  // We need to distinguish between the two and not do anything if the
  // value was changed due to MIDI input. Otherwise, since we would create a feedback
  // loop since this the purpose of this function is to update the displayed
  // value on the MIDI controller to show automation or direct manipulation.
  // We accomplish this by keeping a timestamp of the last time MIDI data was
  // received, and only taking action here if more than 500ms has passed.

  //post('CALLBACK', args, "\n");
  if (allowParamValueUpdates) { // ensure 500ms has passed since receiving MIDI values
    var args = arrayfromargs(args);
    if (args[0] === 'value') {
      param.val = args[1];
      updateMidiVal();
    }
  }
}

function setPath(paramPath) {
  //post('PATH', paramPath, "\n");
  api = new LiveAPI(valueCallback, paramPath);
  api.property = "value";

  param = {
    id: parseInt(api.id),
    path: api.unquotedpath,
    val: parseFloat(api.get("value")),
    min: parseFloat(api.get("min")) || 0,
    max: parseFloat(api.get("max")) || 1,
    name: api.get("name"),
  };

  var parentObj = new LiveAPI(api.get("canonical_parent"));

  if (parentObj) {
    var parentPath = parentObj.unquotedpath;

    // Only get the device name if it has the name property
    if (parentObj.info.match(/property name str/)) {
      param.parentName = parentObj.get("name");
    } else if (param.path.match(/mixer_device/)) {
      param.parentName = 'Mixer';
    }

    // Try to get the track name
    var matches = (
                   parentPath.match(/^live_set tracks \d+/)
                   || parentPath.match(/^live_set return_tracks \d+/)
                   || parentPath.match(/^live_set master_track/)
    );
    if (matches) {
      param.trackName = (new LiveAPI(matches[0])).get("name");
    }
  }

  //post("PARAM DATA", JSON.stringify(param), "\n");
  outlet(OUTLET_MAPPED, true);
  outlet(OUTLET_MAP_ID, param.id);


  // Defer outputting the new MIDI val because the controller
  // will not process it since it was just sending other vals
  // that triggered the mapping.
  (new Task( function() { updateMidiVal(); } )).schedule(333);

  sendNames();
}

function setInitMapping(objId) {
  initMappingId = objId;
}

function doInit() {
  //post("INIT_MAPPING=", initMappingId, "DONE=", initMappingDone, "\n");
  if (!initMappingDone) {
    initMappingDone = true;
    if (initMappingId > 0) {
      //post("INIT_MAPPING_ID", initMappingId, "\n");
      setPath(["id", initMappingId]);
    }
  }
}

function sendNames() {
  outlet(OUTLET_PARAM_NAME, param.name || nullString);
  outlet(OUTLET_DEVICE_NAME, param.parentName || nullString);
  outlet(OUTLET_TRACK_NAME, param.trackName || nullString);
}

function updateMidiVal() {
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
  //post("INIT", "\n");
  init();
}

function midiVal(midiVal) {
  if (api) {
    if (allowUpdateFromMidi) {
      //post('INVAL', midiVal, 'OUTMIN', outMin, 'OUTMAX', outMax, '\n');
      var propMidiVal = midiVal / 127;
      var scaledMidiVal = ((outMax - outMin) * propMidiVal) + outMin;
      param.val = ((param.max - param.min) * scaledMidiVal) + param.min;
      //post('PARAMVAL', param.val, "\n");
      api.set("value", param.val);

      // prevent updates from params directly being sent to MIDI for 500ms
      if (allowParamValueUpdates) {
        allowParamValueUpdates = false;
        (new Task( function() { allowParamValueUpdates = true; } )).schedule(500);
      }
    }
  } else {
    if (allowMapping) {
      // debounce mapping, since moving the CC will trigger many message
      allowMapping = false;
      (new Task( function() { allowMapping = true; } )).schedule(1000);

      // wait 500ms before paying attention to MIDI values again after mapping
      if (allowUpdateFromMidi) {
        allowUpdateFromMidi = false;
        (new Task( function() { allowUpdateFromMidi = true; } )).schedule(500);
      }

      // If we get a MIDI CC but are unassigned, trigger a mapping.
      // This removes a step from typical mapping.
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
