//@ObjSelector
//global scripts can have any kind of code.
//They are used to define new classes (like materials and components) that are used in the scene.

function ObjSelector(){

 //Inputs
  this.addInput("array","array");
  this.addInput("index","number");
  //this.addProperty("index",0)
  // Outputs
	this.addOutput("obj","*");

  
}

ObjSelector.prototype.onExecute = function()
{
  var objs = this.getInputData(0);
  if(!objs)
    return;
	var idx = this.getInputData(1);
  if( idx == null|| idx == undefined )
    idx = 0;
  this.setOutputData(0, objs[idx]);
  	
}


LiteGraph.registerNodeType("features/Obj", ObjSelector );
  