function Rotation()
{

	this.addInput("angleX","number");
  this.addInput("angleY","number");
  this.addInput("angleZ","number");
  this.addInput("nodeName","string");
  this.addInput("rotateEyes", "number");
 // this.properties = { defaultWeight: 0, targetWeight: 0.65 };
  this.addOutput("enableLookAt", "boolean");
	this.addOutput("rotation", "quat");
  this.properties = {dtX: 0.2,
                     dtY: 0.5,
                     dtZ: 0.5};
  lookAtEyes = true;
}

Rotation.prototype.onAdded = function()
{
 console.log("start")
}


Rotation.prototype.onExecute = function()
{
  if(this.getInputData(3))
    lookAtEyes=!lookAtEyes;
  this.setOutputData(0, lookAtEyes);
  
  var dX = this.getInputData(0);
  var dY = this.getInputData(1);
  var dZ = this.getInputData(2);
  
  var name = this.getInputData(3);
    
  if(!name)
    var rot = quat.create();
  else{
  	var rot = node.transform.rotation;
  	var node = LS.GlobalScene._nodes_by_name[name];
  }
  
	var dtX = this.properties["dtX"];
  var dtY = this.properties["dtY"];
 	var dtZ = this.properties["dtZ"];

  
  //rot[0] = (dX<0.1&&dX>-0.1)? 0 : dX*dtX;
  //rot[1] = (dY<0.1&&dY>-0.1)? 0 :dY*dtY;
  if(dX !=undefined)
  	rot[0] = dX*dtX;
  
  if(dY !=undefined)
  	rot[1] = dY*dtY;
  
  if(dZ !=undefined)
  	rot[2] = dZ*dtZ;

  
  if(dX!=undefined || dY!=undefined || dZ!=undefined){
  	quat.normalize(rot,rot);
  
    this.setOutputData(1,rot)
    
    if(node){
  	node.transform.mustUpdate = true;
    node.scene.refresh();
    }
  }
 
  
  ///var target = LS.GlobalScene.getCamera()._center;
  //target[1] *= -1;
 /* var t = vec3.create();
  t[0] = target[1]
  t[1] = target[0]
  t[2] = target[2]*/
 /// var targetNode = LS.GlobalScene._nodes_by_name["eye_target"];
  ///targetNode.transform.position = target;
  
  //node._children[0].transform.lookAt(pos, t, [1,0,0], false);
  
  
}

LiteGraph.registerNodeType("features/Rotate", Rotation );