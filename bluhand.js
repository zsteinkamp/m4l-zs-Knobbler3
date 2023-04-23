////////////////////////////////////////////////
// M4L Config
////////////////////////////////////////////////

autowatch = 1;
outlets = 1;

var OUTLET_OSC = 0;
var MAX_PARAMS = 33; // "Device On" is always the first

setoutletassist(OUTLET_OSC, "OSC Messages");

////////////////////////////////////////////////
// VARIABLES
////////////////////////////////////////////////

var debugLog = false;

var data = {
  trackName: null,
  deviceName: null,
  params: [],
  observers: {
    trackName: null,
    deviceName: null,
    params: null,
  },
  objIdToParamIdx: {},
};
var lomParamsArr = [];
var nullString = "- - -";

debug("reloaded");

////////////////////////////////////////////////
// EXTERNAL METHODS
////////////////////////////////////////////////

function bang() {
  setupListener();
}

////////////////////////////////////////////////
// INTERNAL METHODS
////////////////////////////////////////////////

function setupListener() {
  debug("SETUP LISTENERS");

  data.observers.trackName = new LiveAPI(trackNameCallback, "live_set view selected_track");
  data.observers.trackName.mode = 1;
  data.observers.trackName.property = "name";

  data.observers.deviceName = new LiveAPI(deviceNameCallback, "live_set appointed_device");
  data.observers.deviceName.mode = 1;
  data.observers.deviceName.property = "name";

  data.observers.params = new LiveAPI(parametersCallback, "live_set appointed_device");
  data.observers.params.mode = 1;
  data.observers.params.property = "parameters";
}

function colorToString(colorVal) {
  var retString = parseInt(colorVal).toString(16).toUpperCase();
  var strlen = retString.length;
  for (var i = 0; i < 6 - strlen; i++) {
    retString = "0" + retString;
  }
  return retString + 'FF';
}

function trackColorCallback(args) {
  debug("TRACKCOLOR", args);
  var args = arrayfromargs(args);
  if (args[0] === "color") {
    param.trackColor = colorToString(args[1]);
    sendColor();
  }
}

function trackNameCallback(args) {
  debug('TRACK ID', parseInt(this.id));
  debug(args);
  if (parseInt(this.id) === 0) {
    data.trackName = "none";
  } else {
    data.trackName = this.get("name");
  }
  data.trackColor = colorToString(this.get("color"));
  debug('TRACKCOLOR', data.trackColor);
  updateDeviceName();
}
function deviceNameCallback(args) {
  debug('DEVICE ID', parseInt(this.id));
  if (parseInt(this.id) === 0) {
    data.deviceName = "none";
  }
  else {
    data.deviceName = this.get("name");
  }
  updateDeviceName();
}

function updateDeviceName() {
  var message = ["/bcurrDeviceName", data.trackName + " > " + data.deviceName];
  if (!(data.trackName && data.deviceName)) {
    message = ["/bcurrDeviceName", "No device selected"];
  }
  debug(message);
  outlet(OUTLET_OSC, message);
}

function paramKey(paramObj) {
  var key = paramObj.id.toString();
  debug(key);
  return key;
}

function parametersCallback(args) {
  debug(JSON.stringify(args));
  paramIdArr = this.get("parameters");

  data.params = [];
  data.objIdToParamIdx = {};

  var message;
  var paramIdArrElem;
  var currParam;
  var paramIdx;

  if (parseInt(this.id) !== 0) {
    while (paramIdArr.length > 0 && data.params.length < MAX_PARAMS) {
      paramIdArrElem = paramIdArr.shift();
      if (paramIdArrElem === 'id') {
        continue;
      }

      paramIdx = data.params.length;

      currParam = {
        paramObj: new LiveAPI(valueCallback, "id " + paramIdArrElem)
      };
      data.objIdToParamIdx[paramKey(currParam.paramObj)] = paramIdx;
      currParam.name = currParam.paramObj.get("name").toString();
      currParam.val = parseFloat(currParam.paramObj.get("value")),
      currParam.min = parseFloat(currParam.paramObj.get("min")) || 0,
      currParam.max = parseFloat(currParam.paramObj.get("max")) || 1,

      message = ["/bparam" + paramIdx, currParam.name];
      outlet(OUTLET_OSC, message);

      data.params.push(currParam);
      data.params[paramIdx].paramObj.property = "value";

      sendVal(paramIdx);
    }
  }

  // zero-out the rest of the param sliders
  for (paramIdx = data.params.length; paramIdx < MAX_PARAMS; paramIdx++) {
    outlet(OUTLET_OSC, ["/bparam" + paramIdx, nullString]);
    outlet(OUTLET_OSC, ["/bval" + paramIdx, 0]);
    outlet(OUTLET_OSC, ["/bval" + paramIdx + "color", "FF000099"]);
  }
}

function sendVal(paramIdx) {
  if (typeof(paramIdx) !== "number" || paramIdx < 0 || paramIdx >= MAX_PARAMS) { return; }

  var param = data.params[paramIdx];

  // the value, expressed as a proportion between the param min and max
  var outVal = (param.val - param.min) / (param.max - param.min);

  var message = ["/bval" + paramIdx, outVal]
  debug(message);
  outlet(OUTLET_OSC, message);
  outlet(OUTLET_OSC, ["/bval" + paramIdx + "color", data.trackColor]);
}

function valueCallback(args) {
  var argsArr = arrayfromargs(args);
  if (argsArr[0] !== "value") {
    return;
  }

  debug("TOPARGS", argsArr);
  var paramIdx = data.objIdToParamIdx[paramKey(this)];
  if (paramIdx === undefined) {
    debug("no data.objIdToParamIdx for", paramIdx, JSON.stringify(data.objIdToParamIdx));
    return;
  }
  if (!data.params[paramIdx]) {
    debug("no data.params for", paramIdx, JSON.stringify(data.params));
    return;
  }

  // ensure the value is indeed changed (vs a feedback loop)
  if (argsArr[1] === data.params[paramIdx].val) {
    debug(paramIdx, paramIdx.val, "NO CHANGE");
    return;
  }
  data.params[paramIdx].val = argsArr[1];
  sendVal(paramIdx);
}

function oscReceive(args) {
  var matches = args.match(/^\/bval(\d+) ([0-9.-]+)$/);
  debug(JSON.stringify(matches));

  if (!matches || matches.length !== 3) {
    return;
  }

  var paramIdx = parseInt(matches[1]);
  var param = data.params[paramIdx];
  if (param) {
    var value = param.min + (parseFloat(matches[2]) * (param.max - param.min));
    param.paramObj.set("value", value);
  }
}

////////////////////////////////////////////////
// UTILITIES
////////////////////////////////////////////////

function debug() {
  if (debugLog) {
    post(debug.caller ? debug.caller.name : 'ROOT', Array.prototype.slice.call(arguments).join(" "), "\n");
  }
}

function dequote(str) {
  return str.replace(/^"|"$/g, '');
}