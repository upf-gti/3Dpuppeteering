//@EyebrowsAnalyser
//global scripts can have any kind of code.
//They are used to define new classes (like materials and components) that are used in the scene.
EyebrowsAnalyser.EYEBROW_DOWN_L = "down left";
EyebrowsAnalyser.EYEBROW_DOWN_R = "down right";
EyebrowsAnalyser.EYEBROW_UP_L = "up left";
EyebrowsAnalyser.EYEBROW_UP_R = "up right";

EyebrowsAnalyser.ActionUnits = [ "EYEBROW_DOWN_L", "EYEBROW_DOWN_R", "EYEBROW_UP_L", "EYEBROW_UP_R" ];

EyebrowsAnalyser.FAPUS = ["ES", "ENS"];

function EyebrowsAnalyser(){

 //Inputs
  this.addInput("face","face");
  
  this.color = "#323";
	this.bgcolor = "#535";
  //Properties
  this.properties = {
    CALIBRATION_QUEUE_LENGTH: 20,
    expression_confidence: 1,
    pitch_confidence: 15,
    yaw_confidence : 15,
    roll_confidence: 15
  }
/*  this.addProperty("CALIBRATION_QUEUE_LENGTH",20);
  this.addProperty("expression confidence", 1)
	this.addProperty("PITCH_CONFIDENCE" , 5)
  this.addProperty("YAW_CONFIDENCE" , 10)
  this.addProperty("ROLL_CONFIDENCE" , 15)*/

  //----ACTION UNITS
  this.newAUWeights = {};
  this._AUStates = {};
  this._actionUnitWeightMap = {};
  this.neutralAUStates = {};
  this.lastAUWeights = {};
  
  var AUs = EyebrowsAnalyser.ActionUnits;
  
  for(var i = 0; i< AUs.length; i++)
  {
    var au = AUs[i];
  	this._AUStates[au] = 0 ;
  	this._actionUnitWeightMap[au] = 0;
  	this.neutralAUStates[au] = 0;
    this.lastAUWeights[au] = 0;
    this.newAUWeights[au] = 0;
  }
  //----CALIBRATION
  this.calibrated = false;
	this.calibrating = false;

	this.faceNum = 0;
	//this.maxQueueLength = CALIBRATION_QUEUE_LENGTH;
	this.faceQueue = [];
  this._currentFace = {};
  this.neutralFAPUs = {}//Object.assign({}, _neutralFAPUs);
  //this.neutralAUStates = {}//Object.assign({},actionUnit);
  this.neutralPose ={}// Object.assign({}, _neutralPose);
	this.scale = 1;
  
  this.newFaceAngles = {};
  this.currentAUWeights = null;
  this.currentFaceAngles = null;
  
  this.lastFace = null;
  this.lastFaceAngles = null;
	wait = 30;
 // this.expressionConfidence = 1;
}
EyebrowsAnalyser.prototype.onGetOutputs = function() {
	return [[EyebrowsAnalyser.EYEBROW_DOWN_L,"number"],
          [EyebrowsAnalyser.EYEBROW_DOWN_R ,"number"],
          [EyebrowsAnalyser.EYEBROW_UP_L ,"number"],
          [EyebrowsAnalyser.EYEBROW_UP_R ,"number"]];
}
EyebrowsAnalyser.prototype.onGetInputs = function() {
  return [["expr_confidence", "number"], ["pitch_confidence", "number"], ["yaw_confidence", "number"], ["roll_confidence", "number"]];
}
EyebrowsAnalyser.prototype.onExecute = function()
{
  var face = this.getInputData(0);
//  if(!face) return;
  if(this.inputs){

    for(var i= 1; i<this.inputs.length;i++)
    {
      var input = this.inputs[i];
      switch(input.name){
        
        case "expr_confidence":
          if(this.getInputData(i))
          	this.properties["expression_confidence"] = this.getInputData(i);
          break;
        case "pitch_confidence":
          if(this.getInputData(i))
          	this.properties["pitch_confidence"] = this.getInputData(i);
          break;
        case "yaw_confidence":
          if(this.getInputData(i))
          	this.properties["yaw_confidence"] = this.getInputData(i);
          break;
        case "roll_confidence":
          if(this.getInputData(i))
          	this.properties["roll_confidence"] = this.getInputData(i);
          break;
      }

    }
  }
	if(face)
  {
    this._currentFace = face;
    this.maxQueueLength = this.properties["CALIBRATION_QUEUE_LENGTH"];
    this.expressionConfidence = this.properties["expression_confidence"];
    
    if(face.neutral){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
    }
    
    if(this.faceNum >= this.maxQueueLength&&this.calibrating){
      this.scale = face.scale;

      this.neutralAUStates = {
        EYEBROW_DOWN_L: 0,
        EYEBROW_DOWN_R: 0,
        EYEBROW_UP_L: 0,
        EYEBROW_UP_R: 0
      }
      this.extractNeutralAUStates()
      this.extractNeutralFAPUs();
      this.extractNeutralPose();

      this.cleanQueue();
      this.faceNum = 0;
      this.calibrating = false;
      this.calibrated = true;
    } 

    var auStates = this.measureAUStates();

    var faceAngles = {
      x: -face.rotationX,		//pitch
      y: -face.rotationY,		//yaw
      z: face.rotationZ     //roll
    };

    if(this.calibrating){

      var fapus = this.measureFAPUs();

      var newFace = {
        FAPUs: fapus,
        AUStates: auStates,
        headPose: faceAngles
      };
      this.queueNewFace(newFace);
    }
    else if(this.calibrated){

      this._AUStates = auStates;
      this.computeWeights();
      var newFace = {
        AUStates: auStates,
        headPose: faceAngles,
        weightMap: this._actionUnitWeightMap
      };  
      this.queueNewFace(newFace);

      if(this.lastFace == null) return;

      this.optimizeAUWeights(); 
      //this.optimizeFaceAngles(); 

      this.smoothAUWeights();	
      //this.smoothFaceAngles();

      this.lastAUWeights = Object.assign({},this.newAUWeights);
      this.lastFaceAngles = Object.assign({},this.newFaceAngles);

    }
  }  
	
  
  if(this.outputs)
    for(var i = 0; i < this.outputs.length; i++)
    {
      var output = this.outputs[i];
      if(!output.links || !output.links.length)
        continue;

      var result = null;
      switch( output.name )
      {
        case EyebrowsAnalyser.EYEBROW_DOWN_L: 
          result = this.lastAUWeights["EYEBROW_DOWN_L"];
          break;
        case EyebrowsAnalyser.EYEBROW_DOWN_R: 
          result = this.lastAUWeights["EYEBROW_DOWN_R"];
          break;
        case EyebrowsAnalyser.EYEBROW_UP_L : 
          result = this.lastAUWeights["EYEBROW_UP_L"];
          break;
        case EyebrowsAnalyser.EYEBROW_UP_R : 
          result = this.lastAUWeights["EYEBROW_UP_R"];
          break;
      }
      this.setOutputData(i, result);
    }
  
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//							RSNeutralFace
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

EyebrowsAnalyser.prototype.measureFAPUs = function(landmarks)
{
  var fapus = {};
	if(this.calibrating){
  
    fapus["ES"] = (this.landmarkDistance(36,39)*0.5 + this.landmarkDistance(42,45)*0.5 + this.landmarkDistance(39,42)) / 1024;
		fapus["ENS"] = this.landmarkDistance(27,33) / 1024;
  }
  return fapus;
}
EyebrowsAnalyser.prototype.extractNeutralFAPUs = function()
{
	if(this.faceNum<=0) return;

  var sum = {
    ES:0, //eye separation
    ENS:0 //eye-nose separation
  }; //angle unit

	for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    for(var fapu in nf.FAPUs){
    	sum[fapu] += nf.FAPUs[fapu];
    }
	}

  for(var fapu in nf.FAPUs)
  {
    	this.neutralFAPUs[fapu] = sum[fapu]/this.faceNum;
  }
}
EyebrowsAnalyser.prototype.extractNeutralAUStates = function()
{
	if(this.faceNum<=0) return;

	for(var i = this.faceQueue.length - 1; i > -1; i--)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;

		var AUStates = this.faceQueue[i].AUStates;
		for(var au in AUStates)
		{
				this.neutralAUStates[au] += AUStates[au]/this.faceNum;
		}
	}
}
EyebrowsAnalyser.prototype.extractNeutralPose = function(){
	if(this.faceNum<=0) return;

	var sumYPR = { x:0, y:0, z:0}

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

EyebrowsAnalyser.prototype.landmarkDistance = function(i,j)
{
  var landmarks = this._currentFace.points;

  var vi = vec2.fromValues(landmarks[i].x, landmarks[i].y);
  var vj = vec2.fromValues(landmarks[j].x, landmarks[j].y);
  return vec2.dist(vi,vj);

}
EyebrowsAnalyser.prototype.measureAUStates = function(landmarks)
{
  var eyebrow_left = (this.landmarkDistance(22,42)+this.landmarkDistance(23,47)+this.landmarkDistance(24,46))/3;
  var eyebrow_right = (this.landmarkDistance(21,39)+this.landmarkDistance(20,40)+this.landmarkDistance(19,41))/3; 
  
  var auStates = {
    EYEBROW_DOWN_L: eyebrow_left,
    EYEBROW_UP_L: eyebrow_left,
    EYEBROW_DOWN_R: eyebrow_right,
    EYEBROW_UP_R: eyebrow_right
  }
  return auStates;
}
EyebrowsAnalyser.prototype.computeWeights = function()
{
  
	var ENS0 = this.neutralFAPUs["ENS"];
	var ES0 = this.neutralFAPUs["ES"];
    
  var smooth = this.scale/this._currentFace.scale;
  
	{//EYEBROW_Up_L,
		var currentValue = this._AUStates["EYEBROW_UP_L"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_UP_L"]///this.scale;
		
		var delta = (currentValue*smooth - neutralValue)/ENS0;

    if (delta >= 0)
      this._actionUnitWeightMap["EYEBROW_UP_L"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["EYEBROW_UP_L"] = 0;
    
	}

	{//EYEBROW_Up_R,
		var currentValue = this._AUStates["EYEBROW_UP_R"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_UP_R"]///this.scale;;

		var delta = (currentValue*smooth - neutralValue)/ENS0;

    if (delta >= 0)
      this._actionUnitWeightMap["EYEBROW_UP_R"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["EYEBROW_UP_R"] = 0;

	}
	
	{//EYEBROW_DOWN_L,
		var currentValue = this._AUStates["EYEBROW_DOWN_L"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_DOWN_L"]///this.scale;;

		var delta = (currentValue*smooth - neutralValue)/ES0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYEBROW_DOWN_L"] = 0;
    else
      this._actionUnitWeightMap["EYEBROW_DOWN_L"] = CalWeight(-delta, 1024 * 0.1);
  
	}

	{//EYEBROW_DOWN_R,
		var currentValue = this._AUStates["EYEBROW_DOWN_R"]///this._currentFace.scale;;
		var neutralValue = this.neutralAUStates["EYEBROW_DOWN_R"]///this.scale;;

		var delta = (currentValue*smooth - neutralValue)/ES0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYEBROW_DOWN_R"] = 0;
    else
      this._actionUnitWeightMap["EYEBROW_DOWN_R"] = CalWeight(-delta, 1024 * 0.1);
   
	}
}

EyebrowsAnalyser.prototype.evaluteStates = function()
{
	//LostTracking
	var lostTrackingRate = 1 - this.faceNum/this.faceQueue.length;

	//PoseShifting
	var rawAngles = this.lastFace.headPose;
  
  var pitch = this.properties["pitch_confidence"]*DEG2RAD - this.neutralPose.x;
  var yaw = this.properties["yaw_confidence"]*DEG2RAD - this.neutralPose.y;
  var roll = this.properties["roll_confidence"]*DEG2RAD - this.neutralPose.z;
  
	var wx = Math.clamp(Math.abs(rawAngles.x)/pitch,0,1);
	var wy = Math.clamp(Math.abs(rawAngles.y)/yaw,0,1);
	var wz = Math.clamp(Math.abs(rawAngles.z)/roll,0,1);
	var poseShiftingRate = Math.max(Math.max(wx, wy),wz);

	var conf = Math.max(lostTrackingRate,poseShiftingRate);
	conf = Math.pow(conf,2);
	this.expressionConfidence = this.properties["expression_confidence"] - conf;
  this.expressionConfidence = Math.clamp(this.expressionConfidence,0,1);
}
EyebrowsAnalyser.prototype.optimizeAUWeights = function()
{
  this.currentAUWeights = Object.assign({},this.lastFace.weightMap);
	this.newAUWeights = Object.assign({},this.currentAUWeights);

}
EyebrowsAnalyser.prototype.smoothAUWeights = function()
{ 	
	this.evaluteStates();
	for(var au in this.lastAUWeights)
	{
    this.newAUWeights[au] = this.lastAUWeights[au]*(1-this.expressionConfidence) + this.newAUWeights[au]*this.expressionConfidence;
		
	}
}

EyebrowsAnalyser.prototype.queueNewFace = function(face)
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

EyebrowsAnalyser.prototype.cleanQueue = function()
{
	while(this.faceQueue.length>0)
	{
		var frontface = this.faceQueue.shift();
		if(frontface) delete frontface;
	}
	this.faceNum = 0;
	this.lastFace = null;
}

function CalWeight(delta, threshold)
{
	var weight = 0;
	if ((delta > 0) && (threshold > 0))
	{
		weight = Math.min(Math.max(delta / threshold, 0.0), 1.0);
	}
	return weight;
}
LiteGraph.registerNodeType("features/EyebrowsAnalyser", EyebrowsAnalyser );
  