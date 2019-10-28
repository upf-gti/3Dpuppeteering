
function Blink()
{
	//this.addInput("defaultWeight","number");
	//this.addInput("targetWeight","number");
	this.addOutput("weight","number");
  this.properties = { defaultWeight: 0, targetWeight: 1 };
	//this.addOutput("on_start",LiteGraph.EVENT);
   // Initial eyeLidsBSW
  this.initialWeight = 0;
  this.targetWeight = 1;
  
  // Transition
  this.transition = true;
  this.time = 0;
	this.weight = 0;
  blinkData = {
    delay: function() {
        return Math.random() * 8000 + 2000;
    },
    duration: function() {
        return 1000//Math.floor(Math.random()*100)+200;
    },
    blinkAgain: function() {
        return (Math.random() < .3);
    },
    betweenBlinks: function() {
      
        return this.duration() / 2;
    },
    start: 0,// blinkData.start || 0,
    end: 0.4,// blinkData.end || 0.4,
    //attackPeak:  (blinkData.end - blinkData.start)*0.4 + blinkData.start, //blinkData.attackPeak ||
    stop: false,
    blink: false,
    time: 0
	};
}

Blink.prototype.onAdded = function()
{
  this.blinkEyes(true);
  LEvent.bind( LS.GlobalScene, "update", this.onUpdate, this );
}
Blink.prototype.onRemoved = function()
{
  LEvent.unbind( LS.GlobalScene, "update", this.onUpdate, this );
}
Blink.prototype.onUpdate = function(action, dt)
{
  if(this.transition)
  	this.time+=dt;
}
Blink.prototype.onExecute = function()
{
	
  //if(this.blinkData.blink||this.transition){
    console.log("time "+this.time) 
    console.log(Math.cos(this.time))
    this.weight = 1/((this.time*8-4)^4+1)*this.properties["targetWeight"];
  	if(this.weight<0)
      this.weight = 0;
  //}
 // else 
  //  this.weight =  this.properties["defaultWeight"];
	this.setOutputData(0,this.weight);
}
Blink.prototype.blinkEyes = function(continueBlinking){
  var that = this;
  that.blinkData = blinkData;
  if(!that.blinkData.stop){

    //that.blink.start = now();
    that.blinkData.blink = true;
    that.transition = true;
    setTimeout(function() {  
				that.time = 0;
				that.blinkData.blink= false;
      	that.transition = false;
        // Change of blinking again
        if(that.blinkData.blinkAgain()) {
          setTimeout(function() {           
            that.blinkEyes(false);
          }, that.blinkData.betweenBlinks());
        }
      }, 
     that.blinkData.duration());

      // Continue blinking?
      if (continueBlinking) {
          setTimeout(function() {
              that.blinkEyes(true);
          }, that.blinkData.delay());
      }
  }
}
LiteGraph.registerNodeType("features/BlinkPuppeteering", Blink );