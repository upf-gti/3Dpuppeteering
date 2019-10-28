Gaze.prototype.gazePositions = {
    "RIGHT": [-150, 288.28, 423.680], "LEFT": [150, 288.28, 423.680],
    "UP": [6, 330, 423.680], "DOWN": [6, 170, 423.680],
    "UPRIGHT": [-150, 330, 423.680], "UPLEFT": [150, 330, 423.680],
    "DOWNRIGHT": [-150, 170, 423.680], "DOWNLEFT": [150, 170, 423.680],
    "CAMERA": [6, 288.28, 423.680]
  };

// Memory allocation
Gaze.prototype._tempV = vec3.create();
Gaze.prototype._tempQ = quat.create();
Gaze.prototype.targetP = vec3.create();
function Gaze()
{
    this.addInput("lookAt","string");
  	this.addOutput("weight","number");
    //this.addOutput("weight","number");
    this.cameraEye = this.gazePositions["CAMERA"] || vec3.create();
  	this.headPos = this.gazePositions["HEAD"] || vec3.create();
    //this.nextBlockIn = 2 + Math.random() * 3;
		// gaze
		var offsetDirections = ["UPRIGHT", "UPLEFT", "LEFT", "RIGHT", "DOWNRIGHT", "DOWNLEFT"]; // Upper and sides
		var randOffset = offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
		var randTarget =  offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
		//{
      gazeData = {
				start: 0,
				end: 4 + Math.random(),
				influence: "EYES",
				target: randTarget,
				offsetDirection: randOffset,
				offsetAngle: 10 + 5 * Math.random(),
       
			}
			// blink
			
	//	}

  this.lookAt = null;
  this.transition = false;
  this.weight = 0;
}
Gaze.prototype.onAdded = function()
{
  this.initGazeData(gazeData)

	LEvent.bind( LS.GlobalScene, "update", this.onUpdate, this );

}
Gaze.prototype.onRemoved = function( graph )
{
	LEvent.unbind( LS.GlobalScene, "update", this.onUpdate, this );
}
Gaze.prototype.updateTransition = function()
{
  this.transition = true
  // gaze
  var offsetDirections = ["UPRIGHT", "UPLEFT", "LEFT", "RIGHT", "DOWNRIGHT", "DOWNLEFT", "CAMERA"]; // Upper and sides
  var randOffset = offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
  var randTarget =  this.offsetDirection//offsetDirections[Math.floor(Math.random() * offsetDirections.length)];
  //if (Math.random() < 0.7)
  //{
  gazeData = {
    start: 0.5,
    end: 6 + Math.random(),
    influence: "EYES",
    target: randTarget,
    offsetDirection: randOffset,
    offsetAngle: 10 + 5 * Math.random(),
    dynamic: false
  }
  this.time = 0;
  this.initGazeData(gazeData)
}
Gaze.prototype.initGazeData = function(gazeData, shift){
  // Sync
  this.time = 0;
  this.start = gazeData.start || 0.0;
  this.end = gazeData.end || 2.0;
  if (!shift){
    this.ready = gazeData.ready || this.start + (this.end - this.start)/3;
    this.relax = gazeData.relax || this.start +2*(this.end - this.start)/3;
  } else {
    this.ready = this.end;
    this.relax = 0;
  }
  
  // Offset direction
  this.offsetDirection = stringToUpperCase(gazeData.offsetDirection, "Gaze offsetDirection", "RIGHT");
	
  // Target
 	this.target = stringToUpperCase(gazeData.target, "Gaze target", "CAMERA");
 // if (this.target == "FRONT") this.target = "CAMERA";
  
  // Angle
  this.offsetAngle = gazeData.offsetAngle || 0.0;
  
  // Start
  //this.transition = true;

  

  // Extension - Dynamic
  this.dynamic = gazeData.dynamic || false;

}
Gaze.prototype.onUpdate = function(value,dt)
{
  this.time+=dt;
}
Gaze.prototype.onExecute = function(){

  var name = this.getInputData(0);
  this.lookAt = LS.GlobalScene._nodes_by_name[name];
 
  // Define initial values
  if (this.time == 0|| this.transition)
    this.initGazeValues();
  
  // Time increase
  //this.time +=dt;
  // Wait for to reach start time
  if (this.time < this.start)
    return;
  // Stay still during ready to relax
  if (this.time > this.ready && this.time < this.relax)
    return;
  
  // Extension - Dynamic (offsets do not work here)
  if (this.dynamic){
    vec3.copy(this.EndP, this.gazePositions[this.target]);
    //console.log(this.gazePositions[this.target]);
  }

  //console.log(this.influence, this.neckInP, this.neckEndP, this.headInP, this.headEndP, this.eyesInP, this.eyesEndP);
  
  // Trans 1
  if (this.time < this.ready){
    
    inter = (this.time-this.start)/(this.ready-this.start);

    // Cosine interpolation
    inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5;
    inter2 = inter;
    //inter = Math.cos(Math.PI*inter+Math.PI)*0.5 + 0.5; // to increase curve, keep adding cosines
    // lookAt pos change
    vec3.lerp( this.lookAt.transform.position , this.InP, this.EndP, inter);
    this.lookAt.transform.mustUpdate = true;
    
     
  }
  
  // Trans 2
  if (this.time > this.relax && this.relax >= this.ready){
    inter = 1 - (this.time-this.relax)/(this.end-this.relax);
    // Cosine interpolation
    inter = Math.cos(Math.PI*inter + Math.PI)*0.5 + 0.5;
    inter2 = inter;
    // lookAt pos change
    vec3.lerp( this.lookAt.transform.position , this.InP, this.EndP, inter);
    this.lookAt.transform.mustUpdate = true;
		
  }
  console.log(inter)
  console.log(this.weight)
  var weight = this.weight*inter2;

  // End
  if (this.time > this.end){
    if(!this.dynamic){    	
      this.updateTransition(); 
      this.time = 0;
    // Extension - Dynamic
    }else{
      this.time = 0;

    	vec3.copy(this.lookAt.transform.position, this.EndP); 
            this.updateTransition();
    }
  }

  this.setOutputData(0,weight); 
}

Gaze.prototype.initGazeValues = function(){
  
  
  // Find target position (copy? for following object? if following object and offsetangle, need to recalculate all the time!)
  if (this.gazePositions)
    if (this.gazePositions[this.target])
  		vec3.copy(this.targetP, this.gazePositions[this.target]);
  	else
      vec3.set(this.targetP, 0, 210, 70);
  else
    vec3.set(this.targetP, 0, 210, 70);
  
  
  // Angle offset
  // Define offset angles (respective to head position?)
  // Move to origin
  v = this._tempV;
  q = this._tempQ;
  vec3.subtract(v, this.targetP, this.headPos);
  magn = vec3.length(v);
  vec3.normalize(v,v);
  
  // Rotate vector and reposition
  switch (this.offsetDirection){
    case "UPRIGHT":
      quat.setAxisAngle(q, v, -25*DEG2RAD);//quat.setAxisAngle(q, v, -45*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);
      this.weight = -0.1;
      break;
    case "UPLEFT":
      quat.setAxisAngle(q, v, -75*DEG2RAD);//quat.setAxisAngle(q, v, -135*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);
      this.weight = -0.1;
      break;
    case "DOWNRIGHT":
      quat.setAxisAngle(q, v, 25*DEG2RAD);//quat.setAxisAngle(q, v, 45*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);
      this.weight = 0.3;
      break;
    case "DOWNLEFT":
      quat.setAxisAngle(q, v, 75*DEG2RAD);//quat.setAxisAngle(q, v, 135*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);
      this.weight = 0.3;
      break; 
    case "RIGHT":
      vec3.rotateY(v,v,this.offsetAngle*DEG2RAD);
      this.weight = 0.01;
      break;
    case "LEFT":
      vec3.rotateY(v,v,-this.offsetAngle*DEG2RAD);
      this.weight = 0.01;
      break;
    case "UP":
      quat.setAxisAngle(q, v, -45*DEG2RAD);//quat.setAxisAngle(q, v, -90*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);
      this.weight = -0.1;
      break;
    case "DOWN":
      quat.setAxisAngle(q, v, 45*DEG2RAD);//quat.setAxisAngle(q, v, 90*DEG2RAD);
      vec3.rotateY(v,v, this.offsetAngle*DEG2RAD);
      vec3.transformQuat(v,v,q);
      this.weight = 0.3;
      break;
  }
  // Move to head position and save modified target position
  
  vec3.scale(v,v,magn);
  vec3.add(v,v,this.headPos);
  vec3.copy(this.targetP,v);
  
  if (!this.lookAt || !this.lookAt.transform)
    return console.log("ERROR: lookAt not defined ", this.lookAt);
  
  // Define initial and end positions

  this.InP = vec3.copy(vec3.create(), this.lookAt.transform.position);
  this.EndP = vec3.copy(vec3.create(), this.targetP); // why copy? targetP shared with several?
  this.transition= false;
}
// Turn to upper case and error check
var stringToUpperCase = function(item, textItem, def){
 // To upper case
  if (Object.prototype.toString.call(item) === '[object String]')
    return item.toUpperCase();
  else{ // No string
    //console.warn(textItem + " not defined properly.", item);
    return def;
  }
}
LiteGraph.registerNodeType("features/GazePuppeteering", Gaze );