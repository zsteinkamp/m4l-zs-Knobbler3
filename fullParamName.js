inlets=1;
outlets=1;

var OUTLET_PARAM_NAME = 0;
var INLET_PARAM_ID = 0;

setoutletassist(INLET_PARAM_ID, 'Param Id (string)');
setoutletassist(OUTLET_PARAM_NAME, 'Param Name (string)');

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

function foo() {
}

function isValidPath(path) {
  return typeof(path) === 'string' && path.match(/^live_set /);
}

function id(objId) {
  var obj = new LiveAPI(foo, "id " + objId);

  var nameArr = [];
  var counter = 0;
  var parent = null;
  while (counter < 10) {
    if (obj.type === 'Song') { break; }
    if (obj.type === 'MixerDevice') {
      nameArr.unshift('Mixer');
    } else {
      nameArr.unshift(obj.get("name"));
    }
    obj = new LiveAPI(foo, obj.get("canonical_parent"));
    counter++
  }
  outlet(OUTLET_PARAM_NAME, nameArr.join(" > "));
}

