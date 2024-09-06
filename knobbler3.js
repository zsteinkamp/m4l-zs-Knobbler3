autowatch = 1
outlets = 6

var debugLog = false

var OUTLET_OSC = 0
var OUTLET_PARAM_NAME = 1
var OUTLET_DEVICE_NAME = 2
var OUTLET_TRACK_NAME = 3
var OUTLET_MAPPED = 4
var OUTLET_COLOR = 5

setoutletassist(OUTLET_OSC, 'OSC Messages')
setoutletassist(OUTLET_PARAM_NAME, 'Param Name (string)')
setoutletassist(OUTLET_DEVICE_NAME, 'Device Name (string)')
setoutletassist(OUTLET_TRACK_NAME, 'Track Name (string)')
setoutletassist(OUTLET_MAPPED, 'Is Mapped (boolean)')
setoutletassist(OUTLET_COLOR, 'Track Color (string)')

var paramObj = null
var paramNameObj = null
var deviceObj = null
var trackObj = null
var trackColorObj = null

var instanceId = 'NULL'

var param = {}
var outMin
var outMax

var nullString = '- - -'

var allowMapping = true
var allowParamValueUpdates = true
var allowUpdateFromOsc = true

var deviceCheckerTask = null
var allowParamValueUpdatesTask = null

var initMappingPath = null
var pathListener = null

function printOut(msg) {
  post(
    '[',
    instanceId,
    ']',
    printOut.caller ? printOut.caller.name : 'ROOT',
    Array.prototype.slice.call(arguments).join(' '),
    '\n'
  )
}

function debug() {
  if (debugLog) {
    post(
      '[',
      instanceId,
      ']',
      debug.caller ? debug.caller.name : 'ROOT',
      Array.prototype.slice.call(arguments).join(' '),
      '\n'
    )
  }
}

debug('reloaded')

function isValidPath(path) {
  return typeof path === 'string' && path.match(/^live_set /)
}

function dequote(str) {
  //debug(str, typeof str)
  return str.toString().replace(/^"|"$/g, '')
}

function setInstanceId(id) {
  //debug(id)
  instanceId = parseInt(id)
}

function pathChangedCallback(data) {
  //debug('parameter value changed: ' + data.name)
  //debug('new value: ' + data.value)
  setPath(data.value)
}

function instanceIdIsValid() {
  return instanceId && instanceId !== 'NULL'
}

function setupPathListenerIfNecessary() {
  if (!instanceIdIsValid()) {
    //debug('early return - invalid instanceid')
    return
  }
  if (!pathListener) {
    pathListener = new ParameterListener(
      'path' + instanceId,
      pathChangedCallback
    )
  }
}

function setPathParam(path) {
  setupPathListenerIfNecessary()
  pathListener.setvalue_silent(path)
}

function doInit() {
  //debug()

  setupPathListenerIfNecessary()
  var currPathVal = pathListener && pathListener.getvalue()
  //debug('currPathVal=', currPathVal)

  if (currPathVal && isValidPath(currPathVal)) {
    setPath(currPathVal)
  } else {
    init()
  }
}

function clearPath() {
  //debug()
  init()
}

function init() {
  //debug('INIT')
  if (paramObj) {
    // clean up callbacks when unmapping
    paramObj.id = 0
    if (instanceIdIsValid()) {
      outlet(OUTLET_OSC, ['/valStr' + instanceId, nullString])
    }
  }
  paramObj = null
  param = {
    val: 0,
    min: 0,
    max: 100,
  }
  sendNames()
  sendVal()
  outlet(OUTLET_MAPPED, false)

  setPathParam('')

  if (deviceCheckerTask !== null) {
    deviceCheckerTask.cancel()
    deviceCheckerTask = null
  }
}

function setMin(val) {
  //debug(val)
  outMin = parseFloat(val) / 100
  sendVal()
}

function setMax(val) {
  //debug(val)
  outMax = parseFloat(val) / 100
  sendVal()
}

function clearCustomName() {
  //debug()
  param.customName = null
  sendParamName()
}

function setCustomName(args) {
  //debug(args)
  param.customName = args
  sendParamName()
}

function paramValueCallback(args) {
  // This function is called whenever the parameter value changes,
  // either via OSC control or by changing the device directly.
  // We need to distinguish between the two and not do anything if the
  // value was changed due to OSC input. Otherwise, since we would create a feedback
  // loop since this the purpose of this function is to update the displayed
  // value on the OSC controller to show automation or direct manipulation.
  // We accomplish this by keeping a timestamp of the last time OSC data was
  // received, and only taking action here if more than 500ms has passed.

  //debug(args, 'ALLOW_UPDATES=', allowParamValueUpdates)
  if (allowParamValueUpdates) {
    // ensure 500ms has passed since receiving a value
    var args = arrayfromargs(args)
    if (args[0] === 'value') {
      //post("PARAM_VAL", typeof(args[1]), args[1], "\n");
      param.val = args[1]
      sendVal()
    } else {
      //debug('SUMPIN ELSE', args[0], args[1])
    }
  }
}

function paramNameCallback(args) {
  //debug(args)
  var args = arrayfromargs(args)
  if (args[0] === 'name') {
    param.name = args[1]
    sendParamName()
  }
}

function deviceNameCallback(args) {
  //debug(args)
  var args = arrayfromargs(args)
  if (args[0] === 'name') {
    param.deviceName = args[1]
    sendDeviceName()
  }
}

function trackNameCallback(args) {
  //debug(args)
  var args = arrayfromargs(args)
  if (args[0] === 'name') {
    param.trackName = args[1]
    sendTrackName()
  }
}

function colorToString(colorVal) {
  var retString = parseInt(colorVal).toString(16).toUpperCase()
  var strlen = retString.length
  for (var i = 0; i < 6 - strlen; i++) {
    retString = '0' + retString
  }
  return retString + 'FF'
}

function trackColorCallback(args) {
  //debug('TRACKCOLOR', args)
  var args = arrayfromargs(args)
  if (args[0] === 'color') {
    param.trackColor = colorToString(args[1])
    sendColor()
  }
}

function checkDevicePresent() {
  //debug('PO=', paramObj.unquotedpath, 'PP=', param.path, 'PL=', pathListener.getvalue());
  if (deviceObj && !deviceObj.unquotedpath) {
    //debug('DEVICE DELETED')
    init()
    return
  }

  // check if path has changed (e.g. inserting a track above this one)
  if (paramObj && paramObj.unquotedpath !== param.path) {
    //debug(
    //  'path is different  NEW=',
    //  paramObj.unquotedpath,
    //  '  OLD=',
    //  param.path
    //)
    pathListener.setvalue_silent(paramObj.unquotedpath)
    param.path = paramObj.unquotedpath
  }
}

function setPath(paramPath) {
  //debug(paramPath)
  if (!isValidPath(paramPath)) {
    //debug('skipping', paramPath)
    return
  }
  paramObj = new LiveAPI(paramValueCallback, paramPath)
  paramObj.property = 'value'
  paramNameObj = new LiveAPI(paramNameCallback, paramPath)
  paramNameObj.property = 'name'

  param.id = parseInt(paramObj.id)
  param.path = paramObj.unquotedpath
  param.val = parseFloat(paramObj.get('value'))
  param.min = parseFloat(paramObj.get('min')) || 0
  param.max = parseFloat(paramObj.get('max')) || 1
  param.name = paramObj.get('name')

  //debug('SET PARAM', JSON.stringify(param))

  deviceObj = new LiveAPI(deviceNameCallback, paramObj.get('canonical_parent'))

  param.devicePath = deviceObj.unquotedpath

  //debug(
  //  'PARAMPATH=',
  //  paramObj.unquotedpath,
  //  'DEVICEPATH=',
  //  deviceObj.unquotedpath
  //)

  // poll to see if the mapped device is still present
  if (deviceCheckerTask && deviceCheckerTask.cancel) {
    deviceCheckerTask.cancel()
    deviceCheckerTask = null
  }
  deviceCheckerTask = new Task(checkDevicePresent)
  deviceCheckerTask.repeat()

  // Only get the device name if it has the name property
  if (deviceObj.info.match(/property name str/)) {
    deviceObj.property = 'name'
    param.deviceName = deviceObj.get('name')
  } else if (param.path.match(/mixer_device/)) {
    param.deviceName = 'Mixer'
  }

  // Try to get the track name
  var matches =
    param.devicePath.match(/^live_set tracks \d+/) ||
    param.devicePath.match(/^live_set return_tracks \d+/) ||
    param.devicePath.match(/^live_set master_track/)

  if (matches) {
    //debug(matches[0])
    trackObj = new LiveAPI(trackNameCallback, matches[0])
    if (trackObj.info.match(/property name str/)) {
      trackObj.property = 'name'
      param.trackName = trackObj.get('name')
    } else if (param.path.match(/mixer_device/)) {
      param.trackName = 'Mixer'
    }

    trackColorObj = new LiveAPI(trackColorCallback, matches[0])
    trackColorObj.property = 'color'
    param.trackColor = colorToString(trackColorObj.get('color'))
  }

  //post("PARAM DATA", JSON.stringify(param), "\n");
  outlet(OUTLET_MAPPED, true)
  setPathParam(param.path)

  // Defer outputting the new param val because the controller
  // will not process it since it was just sending other vals
  // that triggered the mapping.
  new Task(function () {
    sendVal()
  }).schedule(333)
  sendNames()
}

function refresh() {
  sendNames()
  sendVal()
}

function sendNames() {
  //debug(param.name, param.deviceName, param.trackName)
  sendParamName()
  sendDeviceName()
  sendTrackName()
  sendColor()
}

function sendParamName() {
  if (!instanceIdIsValid()) {
    //debug('invalid instanceId')
    return
  }
  var paramName = dequote(
    (param.customName || param.name || nullString).toString()
  )
  outlet(OUTLET_PARAM_NAME, paramName)
  outlet(OUTLET_OSC, ['/param' + instanceId, paramName])
}
function sendDeviceName() {
  if (!instanceIdIsValid()) {
    //debug('invalid instanceId')
    return
  }
  var deviceName = param.deviceName
    ? dequote(param.deviceName.toString())
    : nullString
  outlet(OUTLET_DEVICE_NAME, deviceName)
  outlet(OUTLET_OSC, ['/device' + instanceId, deviceName])
}
function sendTrackName() {
  if (!instanceIdIsValid()) {
    //debug('invalid instanceId')
    return
  }
  var trackName = param.trackName
    ? dequote(param.trackName.toString())
    : nullString
  outlet(OUTLET_TRACK_NAME, trackName)
  outlet(OUTLET_OSC, ['/track' + instanceId, trackName])
}

var DEFAULT_RED = 'FF0000FF'

function sendColor() {
  if (!instanceIdIsValid()) {
    //debug('invalid instanceId')
    return
  }
  var trackColor = param.trackColor
    ? dequote(param.trackColor.toString())
    : DEFAULT_RED
  //debug('SENDCOLOR', instanceId, trackColor)
  outlet(OUTLET_OSC, ['/val' + instanceId + 'color', trackColor])

  if (trackColor === DEFAULT_RED) {
    trackColor = '000000FF'
  }
  var red = parseInt(trackColor.substr(0, 2), 16) / 255.0
  var grn = parseInt(trackColor.substr(2, 2), 16) / 255.0
  var blu = parseInt(trackColor.substr(4, 2), 16) / 255.0
  var alp = parseInt(trackColor.substr(6, 2), 16) / 255.0

  outlet(OUTLET_COLOR, [red, grn, blu, alp])
}

function sendVal() {
  if (!instanceIdIsValid()) {
    return
  }
  //debug();
  // protect against divide-by-zero errors
  if (outMax === outMin) {
    if (outMax === 1) {
      outMin = 0.99
    } else if (outMax === 0) {
      outMax = 0.01
    }
  }

  if (
    param.val === undefined ||
    param.max === undefined ||
    param.min === undefined
  ) {
    outlet(OUTLET_OSC, ['/val' + instanceId, 0])
    outlet(OUTLET_OSC, ['/valStr' + instanceId, nullString])
    return
  }

  // the value, expressed as a proportion between the param min and max
  var valProp = (param.val - param.min) / (param.max - param.min)

  //debug('VALPROP', valProp, JSON.stringify(param), 'OUTMINMAX', outMin, outMax)

  // scale the param proportion value to the output min/max proportion
  var scaledValProp = (valProp - outMin) / (outMax - outMin)

  scaledValProp = Math.min(scaledValProp, 1)
  scaledValProp = Math.max(scaledValProp, 0)

  //debug('SCALEDVALPROP', '/val' + instanceId, scaledValProp)
  outlet(OUTLET_OSC, ['/val' + instanceId, scaledValProp])
  outlet(OUTLET_OSC, [
    '/valStr' + instanceId,
    paramObj ? paramObj.call('str_for_value', param.val) : nullString,
  ])
}

function receiveVal(val) {
  //debug(val);
  if (paramObj) {
    if (allowUpdateFromOsc) {
      //post('INVAL', val, 'OUTMIN', outMin, 'OUTMAX', outMax, '\n');
      var scaledVal = (outMax - outMin) * val + outMin
      param.val = (param.max - param.min) * scaledVal + param.min

      //debug('VALS', JSON.stringify({ param_max: param.max, param_min: param.min, scaledVal: scaledVal, val: val }));

      // prevent updates from params directly being sent to OSC for 500ms
      if (allowParamValueUpdates) {
        allowParamValueUpdates = false
        if (allowParamValueUpdatesTask !== null) {
          allowParamValueUpdatesTask.cancel()
        }
        allowParamValueUpdatesTask = new Task(function () {
          allowParamValueUpdates = true
        })
        allowParamValueUpdatesTask.schedule(500)
      }

      //post('PARAMVAL', param.val, "\n");
      paramObj.set('value', param.val)
      outlet(OUTLET_OSC, [
        '/valStr' + instanceId,
        paramObj.call('str_for_value', param.val),
      ])
    }
  } else {
    //debug('GONNA_MAP', 'ALLOWED=', allowMapping)
    // If we get a OSC value but are unassigned, trigger a mapping.
    // This removes a step from typical mapping.
    if (allowMapping) {
      // debounce mapping, since moving the CC will trigger many message
      allowMapping = false
      new Task(function () {
        allowMapping = true
      }).schedule(1000)

      // wait 500ms before paying attention to values again after mapping
      if (allowUpdateFromOsc) {
        allowUpdateFromOsc = false
        new Task(function () {
          allowUpdateFromOsc = true
        }).schedule(500)
      }

      //post("PRE-SELOBJ\n");
      var selObj = new LiveAPI('live_set view selected_parameter')
      if (!selObj.unquotedpath) {
        post('No Live param is selected.\n')
      } else {
        //debug('SELOBJ', selObj.unquotedpath, 'SELOBJINFO', selObj.info)
        // Only map things that have a 'value' property
        if (selObj.info.match(/property value/)) {
          setPath(selObj.unquotedpath)
        }
      }
    }
  }
}

function selectDevice() {
  if (!param.devicePath) {
    printOut('devicePath not set')
    return
  }
  var api = new LiveAPI();
  api.path = param.devicePath;
  var id = api.id
  api.path = ['live_set', 'view'];
  api.call('select_device', ['id', id]);
}