Face.OUTPUTS = [
  ["face", "face"],
  ["neutral", "boolean"],
  ["lastState", "string"],
  ["state" , "string"],
  ["nextState" , "string"],
  ["vertices" , "number"],
  ["triangles" , "array"],
  ["points" , "array"],
  ["bounds" , "array"],
  ["refRect" , "array"],
  ["candideVertices", "array"],
  ["candideTriangles" , "array"],
  ["scale" , "number"],
  ["translationX" , "number"],
  ["translationY", "number"],
  ["rotationX" , "number"],
  ["rotationY", "number"],
  ["rotationZ", "number"]
];
Face.ATTRIBUTES = [

  "points" ,
  "scale",
  "rotationX" ,
  "rotationY",
  "rotationZ"
];

function Face(){

  this.addInput("face","*");
 
  this.color = "#323";
	this.bgcolor = "#535";
}
Face.prototype.onExecute = function()
{
  var face = {};
  
  var outputs = Face.OUTPUTS; 
  if(this.inputs){
		for(var i = 0; i < this.inputs.length; i++)
		{
			var input = this.inputs[i];
      var v = this.getInputData(i);
			if(v === undefined)
				continue;
      
      if(input.name == "face")
        face = v;
			else
				face[input.name] = v;
		}
  }
  
  if(this.outputs){

    for(var i = 0; i < this.outputs.length; i++)
    {
      var output = this.outputs[i];
      if(!output.links || !output.links.length)
        continue;

      var result = null;
      for(var j = 0; j < outputs.length; j++ )
      { 
        var out = outputs[j][0];
        if(out == output.name)
          if(out == "face")
            result = this.setValues(face);
        else
          result = face[out];
      }
      this.setOutputData(i, result);
    }
  }
}
Face.prototype.validate = function(face)
{
  var faceAttr = Face.ATTRIBUTES;
  var isValid = true;
  
  for(var i = 0; i<faceAttr.length; i++)
  {
    var attr = faceAttr[i];
    if(face[attr]==undefined)
      isValid = false;
  }
  return isValid;
}
Face.prototype.setValues = function(face)
{
  var outputs = Face.OUTPUTS;
  for(var i = 1; i<outputs.length ; i++)
  {
    var attr = outputs[i][0];
    if(face[attr] != undefined)
      continue;
    
    switch(attr)
    {
      case "neutral":
        face[attr] = false;
        break;
      case "lastState":
        face[attr] = "not_found";
        break;
      case "state":
        face[attr] = "not_found";
        break;
      case "nextState":
        face[attr] = "not_found";
        break;
      case "translationX":
        face[attr] = 0;
        break;
      case "translationX":
        face[attr] = 0;
        break;
      case "points":
        var points = [];
        for(var j = 0; j <68; j++)
          points[j] = {x:0,y:0, z:0};
        face[attr] = points;
        break;
      
      case "rotationZ":
        face[attr] = 0;
        break;
      case "scale":
        face[attr] = 1;
        break;
      case "rotationX":
        face[attr] = 0;
        break;
  		case "rotationY":
        face[attr] = 0;
        break;
  
    }
  }
  return face;
}
Face.prototype.onGetInputs = function() {
	return Face.OUTPUTS
}
Face.prototype.onGetOutputs = function ()
{
  return Face.OUTPUTS;
}
LiteGraph.registerNodeType("features/Face", Face );