inlets=1;
outlets=1;

var OUTLET_PARAM_NAME = 0;
var INLET_INPUT = 0;

setinletassist(INLET_INPUT, 'Input (init)');
setoutletassist(OUTLET_PARAM_NAME, 'Param Name (string)');

var selObj = null;

var log = function() {
  for(var i=0,len=arguments.length; i<len; i++) {
    var message = arguments[i];
    if(message && message.toString) {
      var s = message.toString();
      if(s.indexOf("[object ") >= 0) {
        s = JSON.stringify(message);
      }
      post(s);
    }
    else if(message === null) {
      post("<null>");
    }
    else {
      post(message);
    }
  }
  post("\n");
};

function selectedParamCallback(args)
{
  if (!selObj) { return; }
  if (arrayfromargs(args)[1] === 0) {
    // device ID 0 means nothing selected
    return;
  }

  var nameArr = [];
  var counter = 0;
  var obj = selObj;

  if (obj.id == 0) {
    return;
  }

  while (counter < 10) {
    if (obj.type === 'Song') { break; }
    if (obj.type === 'MixerDevice') {
      nameArr.unshift('Mixer');
    } else {
      nameArr.unshift(obj.get("name"));
    }
    obj = new LiveAPI(obj.get("canonical_parent"));
    counter++;
  }
  outlet(OUTLET_PARAM_NAME, nameArr.join(" > "));
}

function init() {
  selObj = new LiveAPI(selectedParamCallback, "live_set view selected_parameter");
  selObj.mode = 1; // have the ID follow the path
  selObj.property = "unquotedpath"
}
