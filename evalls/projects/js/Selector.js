function Selector(){
	
  //Inputs
  this.addInput("sel","boolean");
  this.addInput("A","");
  this.addInput("B","");
  
  //Outputs
  this.addOutput("out","");


}
;

Selector.prototype.onExecute = function()
{
  var sel = this.getInputData(0);
	var A = this.getInputData(1);
	var B = this.getInputData(2);
	
	if(sel)
		this.setOutputData(0, A );
  else
    this.setOutputData(0, B );
}
LiteGraph.registerNodeType("features/OutputSelector", Selector);