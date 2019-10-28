function HeadPoseAnalyser()
{
	this.addInput("face","face");

 // this.properties = { defaultWeight: 0, targetWeight: 0.65 };
  this.color = "#323";
	this.bgcolor = "#535";
  
	this.addOutput("rotation", "quat");
  
  this.properties = {
    pitch_threshold: 15,
    yaw_threshold: 30,
    roll_threshold: 30,
    CALIBRATION_QUEUE_LENGTH: 20
  };
  
 
  this.faceNum = 0;
  this.faceQueue = [];
  this.maxQueueLength = 20;
  this.calibrating = false;
  this.calibrated = false;
  
  this.newFaceAngles = {};
  this.neutralPose = {};
  this.currentFaceAngles = null;
  
  this.lastFace = null;
  this.lastFaceAngles = null;
}


HeadPoseAnalyser.prototype.onExecute = function()
{
	var face = this.getInputData(0);
	
	if(face)
  {
    if(this.inputs){
    
  	for(var i= 1; i<this.inputs.length;i++)
    {
      var input = this.inputs[i];
      switch(input.name){
        case "rotationX":
          face.rotationX = this.getInputData(i);
          break;
        case "rotationY":
          face.rotationY = this.getInputData(i);
          break;
        case "rotationZ":
         face.rotationZ = this.getInputData(i);
          break;
        case "pitch_threshold":
          if(this.getInputData(i))
          	this.properties["pitch_threshold"] = this.getInputData(i);
          break;
        case "yaw_threshold":
          if(this.getInputData(i))
          	this.properties["yaw_threshold"] = this.getInputData(i);
          break;
        case "roll_threshold":
          if(this.getInputData(i))
          	this.properties["roll_threshold"] = this.getInputData(i);
          break;
      }
      
    }
  }
    this.maxQueueLength = this.properties["CALIBRATION_QUEUE_LENGTH"];
   // this.expressionConfidence = this.properties["expression_confidence"];

    if(face.neutral){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
    }
    if(this.faceNum >= this.maxQueueLength&&this.calibrating){

  		this.neutralPose ={}
      this.extractNeutralPose();

      this.cleanQueue();
      this.faceNum = 0;
      this.calibrating = false;
      this.calibrated = true;
    } 

    var faceAngles = {
      x: face.rotationX,		//pitch
      y: face.rotationY,		//yaw
      z: face.rotationZ     //roll
    };

    if(this.calibrating){

      var newFace = {
        headPose: faceAngles
      };
      this.queueNewFace(newFace);
    }
    else if(this.calibrated){

      var newFace = {
        headPose: faceAngles,
      };  
      this.queueNewFace(newFace);

      if(this.lastFace == null) return;

      this.optimizeFaceAngles(); 
      this.smoothFaceAngles();

      this.lastFaceAngles = Object.assign({},this.newFaceAngles);

    }
	}

  var rot = quat.create();

	var dtX = this.properties["pitch_threshold"]*DEG2RAD;
  var dtY = this.properties["yaw_threshold"]*DEG2RAD;
 	var dtZ = this.properties["roll_threshold"]*DEG2RAD;

 // if(dX !=undefined)
  if(this.lastFaceAngles){
  	rot[0] = this.lastFaceAngles.x*dtX;
  
  //if(dY !=undefined)
  	rot[1] = this.lastFaceAngles.y*dtY;
  
  //if(dZ !=undefined)
  	rot[2] = this.lastFaceAngles.z*dtZ;

  
  //if(dX!=undefined || dY!=undefined || dZ!=undefined){
  	quat.normalize(rot,rot);
  }
  this.setOutputData(0,rot);
  
  if(this.outputs){
    var result = 0;
  	for(var i= 1; i<this.outputs.length;i++)
    {
      var output = this.outputs[i];
      if(this.lastFaceAngles)
        switch(output.name){
          case "rotationX":
            result = this.lastFaceAngles.x;
            break;
          case "rotationY":
            result = this.lastFaceAngles.y;
            break;
          case "rotationZ":
            result = this.lastFaceAngles.z;
            break;
        }
      else
      	result=0;
        
        
      this.setOutputData(i,result);
    }
  }
  
}
HeadPoseAnalyser.prototype.onGetOutputs = function()
{
  return [["rotationX", "number"],["rotationY", "number"],["rotationZ","number"]]
}
HeadPoseAnalyser.prototype.onGetInputs = function()
{
  return [["rotationX", "number"],["rotationY", "number"],["rotationZ","number"], ["pitch_threshold","number"], ["yaw_threshold","number"], ["roll_threshold","number"]];
}

HeadPoseAnalyser.prototype.extractNeutralPose = function(){
	if(this.faceNum<=0) return;

  var sumYPR = { x:0, y:0, z:0}// Object.assign({}, _neutralPose);
  
  for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    for(var pos in nf.headPose){
    	sumYPR[pos] += nf.headPose[pos];
    }
	}
  
  for(var pos in nf.headPose){
    	this.neutralPose[pos] = sumYPR[pos]/this.faceNum;
  }
}
HeadPoseAnalyser.prototype.smoothFaceAngles = function()
{
	if(this.lastFace == null) return;
	
	var weight = 0;
  var delta = {};
  if(!this.lastFaceAngles) return;
  var smoothCoefficient = 0.8; 
  for(var i in this.newFaceAngles){
    
		delta[i] = this.newFaceAngles[i] - this.lastFaceAngles[i];
  
   	this.newFaceAngles[i] = (1-smoothCoefficient)*this.newFaceAngles[i] + smoothCoefficient*this.lastFaceAngles[i];
  }
  
}

HeadPoseAnalyser.prototype.optimizeFaceAngles = function()
{
	this.currentFaceAngles = Object.assign({},this.lastFace.headPose);
  var pitch = this.properties["pitch_threshold"]*DEG2RAD;
  var yaw = this.properties["yaw_threshold"]*DEG2RAD;
  var roll = this.properties["roll_threshold"]*DEG2RAD;
   for(var i in this.newFaceAngles){
  	this.currentFaceAngles[i] = this.currentFaceAngles[i] - this.neutralPose[i]; 
  }
	this.newFaceAngles.x = Math.min(Math.max(this.currentFaceAngles.x, -pitch), pitch)// - 0.02*this.newAUWeights["EYELID_CLOSE_R"] - 0.02*this.newAUWeights["EYELID_CLOSE_L"] - 0.01*this.newAUWeights["MOUTH_LEFT"]- 0.01*this.newAUWeights["MOUTH_RIGHT"];
	this.newFaceAngles.y = Math.min(Math.max(this.currentFaceAngles.y, -yaw), yaw) //- 0.02*this.newAUWeights["EYELID_CLOSE_R"] - 0.02*this.newAUWeights["EYELID_CLOSE_L"]- 0.01*this.newAUWeights["MOUTH_LEFT"]- 0.01*this.newAUWeights["MOUTH_RIGHT"];
	this.newFaceAngles.z = Math.min(Math.max(this.currentFaceAngles.z, -roll),roll)// - 0.02*this.newAUWeights["EYELID_CLOSE_R"] - 0.02*this.newAUWeights["EYELID_CLOSE_L"]- 0.01*this.newAUWeights["MOUTH_LEFT"]- 0.01*this.newAUWeights["MOUTH_RIGHT"]
  
  /*for(var i in this.newFaceAngles){
  	this.newFaceAngles[i] = this.newFaceAngles[i] - this.neutralPose[i]; 
  }*/
}

HeadPoseAnalyser.prototype.queueNewFace = function(face)
{
	this.faceQueue.push(face);
	
	if(face != null){
		this.faceNum++;
		this.lastFace = face;
	}

	while(this.faceQueue.length > this.maxQueueLength)
	{
		var frontface = this.faceQueue.shift();
		if(frontface == this.lastFace) this.lastFace = null;
		if(frontface != null){ 
			this.faceNum--;
			delete frontface;
		}
	};
}

HeadPoseAnalyser.prototype.cleanQueue = function()
{
	while(this.faceQueue.length>0)
	{
		var frontface = this.faceQueue.shift();
		if(frontface) delete frontface;
	}
	this.faceNum = 0;
	this.lastFace = null;
}


LiteGraph.registerNodeType("features/HeadPoseAnalyser", HeadPoseAnalyser );