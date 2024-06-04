inlets = 1
outlets = 1

var OUTLET_PARAM_NAME = 0
var INLET_INPUT = 0

setinletassist(INLET_INPUT, 'Input (object ID)')
setoutletassist(OUTLET_PARAM_NAME, 'Param Name (string)')

var selObj = null

//post('RELOADED fullParamName.js\n')

var log = function () {
  for (var i = 0, len = arguments.length; i < len; i++) {
    var message = arguments[i]
    if (message && message.toString) {
      var s = message.toString()
      if (s.indexOf('[object ') >= 0) {
        s = JSON.stringify(message)
      }
      post(s)
    } else if (message === null) {
      post('<null>')
    } else {
      post(message)
    }
  }
  post('\n')
}

function updateParamName(objId) {
  //log(objId)
  var nameArr = []
  var counter = 0
  var obj = new LiveAPI('id ' + objId)

  if (obj.id == 0) {
    return
  }

  while (counter < 10) {
    if (obj.type === 'Song') {
      break
    }
    if (obj.type === 'MixerDevice') {
      nameArr.unshift('Mixer')
    } else {
      nameArr.unshift(obj.get('name'))
    }
    obj = new LiveAPI(obj.get('canonical_parent'))
    counter++
  }
  outlet(OUTLET_PARAM_NAME, nameArr.join(' > '))
}
