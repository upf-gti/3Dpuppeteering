//@MouthAnalyser
//global scripts can have any kind of code.
//They are used to define new classes (like materials and components) that are used in the scene.
MouthAnalyser.MOUTH_OPEN = "Mouth open";
MouthAnalyser.MOUTH_LEFT_RAISE = "Left raise";
MouthAnalyser.MOUTH_RIGHT_RAISE = "Right raise";
MouthAnalyser.MOUTH_LEFT = "Mouth Left"
MouthAnalyser.MOUTH_RIGHT = "Mouth right";
MouthAnalyser.ActionUnits = ["MOUTH_OPEN" , "MOUTH_LEFT_RAISE", "MOUTH_RIGHT_RAISE", "MOUTH_LEFT", "MOUTH_RIGHT"];
MouthAnalyser.FAPUS = ["MNS", "MW"];

/*var PITCH_CONFIDENCE = 5//10.0; //5.f
var YAW_CONFIDENCE = 10//15.0; //10.f
var ROLL_CONFIDENCE	= 15//20.0; //15.f*/

function MouthAnalyser(){

 //Inputs
  this.addInput("face","face");
 // this.addInput("isNeutral","boolean");

  this.color = "#323";
	this.bgcolor = "#535";
  //Properties
  this.properties = {
    
    CALIBRATION_QUEUE_LENGTH: 20,
    expression_confidence: 1,
    pitch_confidence: 10,
    yaw_confidence : 10,
    roll_confidence: 15
  }

  //----ACTION UNITS
  this._AUStates = {};
  this._actionUnitWeightMap = {};
  this.neutralAUStates = {};
  this.newAUWeights = {};
  this.newFaceAngles = {};
  this.currentAUWeights = null;
  this.currentFaceAngles = null;
  this.lastAUWeights = {};
  
  var AUs = MouthAnalyser.ActionUnits;
  
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
  calibrating = "";

	this.faceNum = 0;
	//this.maxQueueLength = CALIBRATION_QUEUE_LENGTH;
	this.faceQueue = [];
  this._currentFace = {};
  this.neutralFAPUs = {}//Object.assign({}, _neutralFAPUs);
  //this.neutralAUStates = {}//Object.assign({},actionUnit);
  this.neutralPose ={}// Object.assign({}, _neutralPose);
	this.scale = 1;
  
  
  this.lastFace = null;
  this.lastFaceAngles = null;
	wait = 30;
  //this.expressionConfidence = -1;
}
MouthAnalyser.prototype.onGetOutputs = function() {
	return [[MouthAnalyser.MOUTH_OPEN,"number"],
          [MouthAnalyser.MOUTH_LEFT_RAISE ,"number"],
          [MouthAnalyser.MOUTH_RIGHT_RAISE ,"number"],
          [MouthAnalyser.MOUTH_LEFT ,"number"],
          [MouthAnalyser.MOUTH_RIGHT ,"number"]];
}
MouthAnalyser.prototype.onGetInputs = function() {
  return [["expr_confidence", "number"], ["pitch_confidence", "number"], ["yaw_confidence", "number"], ["roll_confidence", "number"]];
}
MouthAnalyser.prototype.onExecute = function()
{
  var face = this.getInputData(0);
 // if(!face) return;
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

    if(face.neutral ){//|| this.getInputData(1)){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
    }
    if(this.faceNum >= this.maxQueueLength&&this.calibrating){
      this.scale = face.scale;

      var AUs = MouthAnalyser.ActionUnits;
 			this.neutralFAPUs = {}  
  		this.neutralPose ={}
      
      for(var i = 0; i< AUs.length; i++)
      {
        var au = AUs[i];

        this.neutralAUStates[au] = 0;

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
        case MouthAnalyser.MOUTH_OPEN: 
          result = this.lastAUWeights["MOUTH_OPEN"];
          break;
        case MouthAnalyser.MOUTH_LEFT_RAISE: 
          result = this.lastAUWeights["MOUTH_LEFT_RAISE"];
          break;
        case MouthAnalyser.MOUTH_RIGHT_RAISE : 
          result = this.lastAUWeights["MOUTH_RIGHT_RAISE"];
          break;
        case MouthAnalyser.MOUTH_LEFT : 
          result = this.lastAUWeights["MOUTH_LEFT"];
          break;
        case MouthAnalyser.MOUTH_RIGHT : 
          result = this.lastAUWeights["MOUTH_RIGHT"];
          break;
      }
      this.setOutputData(i, result);
    }
  
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//							RSNeutralFace
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

MouthAnalyser.prototype.measureFAPUs = function(landmarks)
{
  var fapus = {};
	if(this.calibrating){
  
		fapus["MNS"] = this.landmarkDistance(33,62) / 1024;
		fapus["MW"] = this.landmarkDistance(48,54) / 1024;
   
  }
  return fapus;
}
MouthAnalyser.prototype.extractNeutralFAPUs = function()
{
	if(this.faceNum<=0) return;
  
  var FAPUs = MouthAnalyser.FAPUS;
  var sum = {};
  for(var i = 0; i<FAPUs.length; i++)
  {
    var fapu = FAPUs[i];
    sum[fapu] = 0;
  }

	for(var i = 0; i < this.faceQueue.length; i++)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;
		var nf = this.faceQueue[i];
    for(var fapu in nf.FAPUs){
    	sum[fapu] += nf.FAPUs[fapu];
    }
	}
	//sha darreglar
  for(var fapu in nf.FAPUs){
  //	if(calibrating =="front"){
    	this.neutralFAPUs[fapu] = sum[fapu]/this.faceNum;
  /*  }
    else{
    	this.maxFAPUs[calibrating][fapu] = sum[fapu]/this.faceNum;
    }*/
  }
}
MouthAnalyser.prototype.extractNeutralAUStates = function()
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
MouthAnalyser.prototype.extractNeutralPose = function(){
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
  
  for(var pos in nf.headPose)
  {
    	this.neutralPose[pos] = sumYPR[pos]/this.faceNum;
  }
}

MouthAnalyser.prototype.landmarkDistance = function(i,j)
{
  var landmarks = this._currentFace.points;

  var vi = vec2.fromValues(landmarks[i].x, landmarks[i].y);
  var vj = vec2.fromValues(landmarks[j].x, landmarks[j].y);
  return vec2.dist(vi,vj);

}
MouthAnalyser.prototype.measureAUStates = function(landmarks)
{
  var mouth_open  = (this.landmarkDistance(61,67)+this.landmarkDistance(62,66)+this.landmarkDistance(63,65))/3;
  var mouth_left_raise = - (this.landmarkDistance(42,54)-this.landmarkDistance(54,33)); 
	var mouth_right_raise = - (this.landmarkDistance(39,48) - this.landmarkDistance(48,33)); 
	var mouth_left = this.landmarkDistance(54,45) - this.landmarkDistance(54,33);
	var mouth_right  = this.landmarkDistance(48,36) - this.landmarkDistance(48,33);
	  
  var auStates = {
    MOUTH_OPEN: mouth_open , 
    MOUTH_LEFT_RAISE: mouth_left_raise, 
    MOUTH_RIGHT_RAISE: mouth_right_raise, 
    MOUTH_LEFT: mouth_left, 
    MOUTH_RIGHT: mouth_right
  }
  return auStates;
}
MouthAnalyser.prototype.computeWeights = function()
{
  var smooth = this.scale/this._currentFace.scale;
  
  var MNS0 = this.neutralFAPUs["MNS"];
	var MW0 = this.neutralFAPUs["MW"];

	{//MOUTH_OPEN,
		var currentValue = this._AUStates["MOUTH_OPEN"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_OPEN"];

		var delta = (currentValue - neutralValue)/MNS0; 

    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_OPEN"] = CalWeight(delta, 1024 * 1);//1.2
    else
      this._actionUnitWeightMap["MOUTH_OPEN"] = 0;
    
	}

	{//MOUTH_LEFT_RAISE,	
		var currentValue = this._AUStates["MOUTH_LEFT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_LEFT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;

    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_LEFT_RAISE"] = CalWeight(delta, 1024 * 0.4);
    else
      this._actionUnitWeightMap["MOUTH_LEFT_RAISE"] =  0;
    
	}

	{//MOUTH_RIGHT_RAISE,
		var currentValue = this._AUStates["MOUTH_RIGHT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_RIGHT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_RIGHT_RAISE"] = CalWeight(delta, 1024 * 0.4);
    else
      this._actionUnitWeightMap["MOUTH_RIGHT_RAISE"] = 0;
  
	}
  {//MOUTH_LEFT_DECLINE,	
		var currentValue = this._AUStates["MOUTH_LEFT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_LEFT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_LEFT_DECLINE"] =0;
    else
      this._actionUnitWeightMap["MOUTH_LEFT_DECLINE"] =  CalWeight(-delta, 1024 * 0.7);
	}

	{//MOUTH_RIGHT_DECLINE,
		var currentValue = this._AUStates["MOUTH_RIGHT_RAISE"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_RIGHT_RAISE"];

		var delta = (currentValue - neutralValue)/MNS0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_RIGHT_DECLINE"] =0;
    else
      this._actionUnitWeightMap["MOUTH_RIGHT_DECLINE"] =  CalWeight(-delta, 1024 * 0.7);

	}

	{//MOUTH_LEFT,	
		var currentValue = this._AUStates["MOUTH_LEFT"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_LEFT"];

		var delta = (currentValue - neutralValue)/MW0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_LEFT"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["MOUTH_LEFT"] = 0;

	}

	{//MOUTH_RIGHT,
		var currentValue = this._AUStates["MOUTH_RIGHT"]*smooth;
		var neutralValue = this.neutralAUStates["MOUTH_RIGHT"];

		var delta = (currentValue - neutralValue)/MW0;
    
    if (delta > 0)
      this._actionUnitWeightMap["MOUTH_RIGHT"] = CalWeight(delta, 1024 * 0.2);
    else
      this._actionUnitWeightMap["MOUTH_RIGHT"] = 0;
  }
}


MouthAnalyser.prototype.evaluteStates = function()
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
	this.expressionConfidence =  this.properties["expression_confidence"] - conf;
	this.expressionConfidence = Math.clamp(this.expressionConfidence,0,1);
}
MouthAnalyser.prototype.optimizeAUWeights = function()
{
  this.currentAUWeights = Object.assign({},this.lastFace.weightMap);
	this.newAUWeights = Object.assign({},this.currentAUWeights);
  
	this.newAUWeights["MOUTH_RIGHT_RAISE"] = Math.clamp(this.currentAUWeights["MOUTH_RIGHT_RAISE"] - this.currentAUWeights["MOUTH_LEFT"], 0, 1);
  this.newAUWeights["MOUTH_LEFT_RAISE"] = Math.clamp(this.currentAUWeights["MOUTH_LEFT_RAISE"] - this.currentAUWeights["MOUTH_RIGHT"], 0, 1);

}
MouthAnalyser.prototype.smoothAUWeights = function()
{ 	
	this.evaluteStates();

	for(var au in this.lastAUWeights)
	{
    this.newAUWeights[au] = this.lastAUWeights[au]*(1-this.expressionConfidence) + this.newAUWeights[au]*this.expressionConfidence;
		
	}
}

MouthAnalyser.prototype.queueNewFace = function(face)
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

MouthAnalyser.prototype.cleanQueue = function()
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
LiteGraph.registerNodeType("features/MouthAnalyser", MouthAnalyser );
  