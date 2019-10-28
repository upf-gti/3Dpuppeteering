function RadialDeadZone()
{
  this.addInput("x","number"); // in: initial stick x value
  this.addInput("y","number"); // in: initial stick y value
    
  this.addOutput("x","number"); // out: resulting stick x value
  this.addOutput("y","number"); // out: resulting stick y value
    
  this.properties = { deadZoneLow: 0.1,
                      deadZoneHigh: 0.95};
	//this.prevX = null;
  //this.prevY = null;
  //this.threshold = 0.4; 
  prevX = 0;
  prevY = 0;
  smooth = 0.1;
}

RadialDeadZone.prototype.onExecute = function()
{
    var x = this.getInputData(0);
    var y = this.getInputData(1);
    var mag = Math.sqrt(x*x + y*y);
    var deadZoneLow = this.properties["deadZoneLow"];
    var deadZoneHigh = this.properties["deadZoneHigh"];
    
    if (mag > deadZoneLow)
    {
        // scale such that output magnitude is in the range [0.0f, 1.0f]
        var legalRange = 1.0 - deadZoneHigh - deadZoneLow;
        var normalizedMag = Math.min(1.0, (mag - deadZoneLow) / legalRange);
        var scale = normalizedMag / mag; 
        var outX = x * scale;
        var outY = y * scale;
    	/*if(this.prevX !=null && this.prevY !=null){
      	if(x - this.prevX > this.threshold)
          outX = outX*0.5+this.prevX+0.5;
        if(y - this.prevY > this.threshold)
          outY = outY*0.5+this.prevY+0.5;
      } */ 
    }
    else
    {
        // stick is in the inner dead zone
        var outX = 0.0;
        var outY = 0.0;
    }
  	outX = smooth*outX+(1-smooth)*prevX;
  	outY = smooth*outY+(1-smooth)*prevY;
  	prevX = outX;
  	prevY = outY;
    this.setOutputData(0, outX);
    this.setOutputData(1, outY);
  //prevX=outX;
  //prevY=outY;
}
LiteGraph.registerNodeType("features/RadialDeadZone", RadialDeadZone );