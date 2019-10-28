//@EyelidsAnalyser
//global scripts can have any kind of code.
//They are used to define new classes (like materials and components) that are used in the scene.
EyelidsAnalyser.EYELID_CLOSE_L = "Left closed";
EyelidsAnalyser.EYELID_CLOSE_R = "Right closed";
EyelidsAnalyser.EYELID_OPEN_L = "Left open";
EyelidsAnalyser.EYELID_OPEN_R = "Right open"
EyelidsAnalyser.ActionUnits = ["EYELID_CLOSE_L" , "EYELID_CLOSE_R", "EYELID_OPEN_L", "EYELID_OPEN_R"]
EyelidsAnalyser.FAPUS = ["IRISD_L", "IRISD_R"];


function EyelidsAnalyser(){

 //Inputs
  this.addInput("face","face");
  
  this.color = "#323";
	this.bgcolor = "#535";

  //Properties
  this.properties = {
    CALIBRATION_QUEUE_LENGTH: 20,
    expression_confidence: 1,
    pitch_confidence: 15,
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
  
  var AUs = EyelidsAnalyser.ActionUnits;
  
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
  
  
  this.lastFace = null;
  this.lastFaceAngles = null;

  //this.expressionConfidence = -1;
}
EyelidsAnalyser.prototype.onGetOutputs = function() {
	return [[EyelidsAnalyser.EYELID_CLOSE_L,"number"],
          [EyelidsAnalyser.EYELID_CLOSE_R ,"number"],
          [EyelidsAnalyser.EYELID_OPEN_L ,"number"],
          [EyelidsAnalyser.EYELID_OPEN_R ,"number"]];
}

EyelidsAnalyser.prototype.onGetInputs = function() {
  return [["expr_confidence", "number"], ["pitch_confidence", "number"], ["yaw_confidence", "number"], ["roll_confidence", "number"]];
}

EyelidsAnalyser.prototype.onExecute = function()
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

    if(this.faceNum >= this.maxQueueLength&&this.calibrating){
      this.scale = face.scale;

      var AUs = EyelidsAnalyser.ActionUnits;

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

    if(face.neutral){
      this.calibrating = true;
      this.calibrated = false;
      this.faceNum = 0;
      this.faceQueue = [];
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
        case EyelidsAnalyser.EYELID_CLOSE_L: 
          result = this.lastAUWeights["EYELID_CLOSE_L"];
          break;
        case EyelidsAnalyser.EYELID_CLOSE_R: 
          result = this.lastAUWeights["EYELID_CLOSE_R"];
          break;
        case EyelidsAnalyser.EYELID_OPEN_L : 
          result = this.lastAUWeights["EYELID_OPEN_L"];
          break;
        case EyelidsAnalyser.EYELID_OPEN_R : 
          result = this.lastAUWeights["EYELID_OPEN_R"];
          break;
      }
      this.setOutputData(i, result);
    }
  
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//							RSNeutralFace
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

EyelidsAnalyser.prototype.measureFAPUs = function(landmarks)
{
  var fapus = {};
	if(this.calibrating){
  
    fapus["IRISD_L"] = this.landmarkDistance(44,46) / 1024;
		fapus["IRISD_R"] = this.landmarkDistance(37,41) / 1024; 
  }
  return fapus;
}
EyelidsAnalyser.prototype.extractNeutralFAPUs = function()
{
	if(this.faceNum<=0) return;
  
  var FAPUs = EyelidsAnalyser.FAPUS;
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
EyelidsAnalyser.prototype.extractNeutralAUStates = function()
{
	if(this.faceNum<=0) return;
	//if(calibrating =="front"){
	//	this.initActionUnitWeightMap(this.neutralAUStates);
  /*}else{
    this.initActionUnitWeightMap(this.maxAUStates[calibrating]);
  }*/
	for(var i = this.faceQueue.length - 1; i > -1; i--)
	{
		if( this.faceQueue[i] == null || this.faceQueue[i] == undefined) continue;

		var AUStates = this.faceQueue[i].AUStates;
		for(var au in AUStates)
		{
      //if(calibrating =="front"){
				this.neutralAUStates[au] += AUStates[au]/this.faceNum;
     /* }
      else{
      	this.maxAUStates[calibrating][au] += AUStates[au]/this.faceNum;
      }*/
		}
	}
}
EyelidsAnalyser.prototype.extractNeutralPose = function(){
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
  
	//sha darreglar
  for(var pos in nf.headPose){
    //if(calibrating =="front"){
    	this.neutralPose[pos] = sumYPR[pos]/this.faceNum;
    /*}
    else{
    	this.maxPoses[calibrating][pos] = sumYPR[pos]/this.faceNum;
    }*/
  }
}

EyelidsAnalyser.prototype.landmarkDistance = function(i,j)
{
  var landmarks = this._currentFace.points;

  var vi = vec2.fromValues(landmarks[i].x, landmarks[i].y);
  var vj = vec2.fromValues(landmarks[j].x, landmarks[j].y);
  return vec2.dist(vi,vj);

}
EyelidsAnalyser.prototype.measureAUStates = function(landmarks)
{

	var eyelid_left = (this.landmarkDistance(44,46)+this.landmarkDistance(43,47))/2; 
	var eyelid_right = (this.landmarkDistance(38,40)+this.landmarkDistance(37,41))/2; 

  var auStates = {
    EYELID_CLOSE_L: eyelid_left , 
    EYELID_CLOSE_R: eyelid_right, 
    EYELID_OPEN_L: eyelid_left, 
    EYELID_OPEN_R: eyelid_right
  }
  return auStates;
}
EyelidsAnalyser.prototype.computeWeights = function()
{
  var smooth = this.scale/this._currentFace.scale;
  
  var IRISD_L0 = this.neutralFAPUs["IRISD_L"];
	var IRISD_R0 = this.neutralFAPUs["IRISD_R"];
  
	{//EYELID_CLOSE_L,
		var currentValue = this._AUStates["EYELID_CLOSE_L"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_CLOSE_L"];

		var delta = (currentValue - neutralValue)/IRISD_L0; 

    if (delta > 0)
      this._actionUnitWeightMap["EYELID_CLOSE_L"] = 0;
    else
      this._actionUnitWeightMap["EYELID_CLOSE_L"] = CalWeight(-delta, 1024 * 0.4);
    
	}

	{//EYELID_CLOSE_R,	
		var currentValue = this._AUStates["EYELID_CLOSE_R"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_CLOSE_R"];

		var delta = (currentValue - neutralValue)/IRISD_R0;

    if (delta > 0)
      this._actionUnitWeightMap["EYELID_CLOSE_R"] = 0;
    else
      this._actionUnitWeightMap["EYELID_CLOSE_R"] =  CalWeight(-delta, 1024 * 0.4);
    
	}

  {//EYELID_OPEN_L,	
		var currentValue = this._AUStates["EYELID_OPEN_L"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_OPEN_L"];

		var delta = (currentValue - neutralValue)/IRISD_L0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYELID_OPEN_L"] = CalWeight(delta, 1024 * 0.6);
    else
      this._actionUnitWeightMap["EYELID_OPEN_L"] =  0;
	}

	{//EYELID_OPEN_R,
		var currentValue = this._AUStates["EYELID_OPEN_R"]*smooth;
		var neutralValue = this.neutralAUStates["EYELID_OPEN_R"];

		var delta = (currentValue - neutralValue)/IRISD_R0;
    
    if (delta > 0)
      this._actionUnitWeightMap["EYELID_OPEN_R"] = CalWeight(delta, 1024 * 0.6);
    else
      this._actionUnitWeightMap["EYELID_OPEN_R"] =  0;

	}

}


EyelidsAnalyser.prototype.evaluteStates = function()
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
EyelidsAnalyser.prototype.optimizeAUWeights = function()
{
  this.currentAUWeights = Object.assign({},this.lastFace.weightMap);
	this.newAUWeights = Object.assign({},this.currentAUWeights);

}
EyelidsAnalyser.prototype.smoothAUWeights = function()
{ 	
	this.evaluteStates();

	for(var au in this.lastAUWeights)
	{
    this.newAUWeights[au] = this.lastAUWeights[au]*(1-this.expressionConfidence) + this.newAUWeights[au]*this.expressionConfidence;
		
	}
}

EyelidsAnalyser.prototype.queueNewFace = function(face)
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

EyelidsAnalyser.prototype.cleanQueue = function()
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
LiteGraph.registerNodeType("features/EyelidsAnalyser", EyelidsAnalyser );
  