function AnimationManager()
{
	//Inputs
  this.addInput("previous","number");
	this.addInput("next","number");
  this.addInput("select","number");
  //Outputs
  this.addOutput("animation","string");
  
  this._animations = [];
  this._values_changed = false;
  this.selected = "";
  showIndex = 0;
  
	this.size = [300,80];
  this._dt = 0;
  this._change = false;
}

AnimationManager.title = "AnimationManager";
AnimationManager.grid_size = 64;

AnimationManager.prototype.onExecute = function()
{
  this._dt++;
  var prev = this.getInputData(0);
  var next = this.getInputData(1);
  var select = this.getInputData(2);
  
  if(prev){
    if(this._dt>10)
    { 
      this._dt = 0;

    	this.changeAnimation(-prev);
    }
  }
  if(next)
  {
    if(this._dt>10)
    { 
      this._dt = 0;

    	this.changeAnimation(next);
    }
  }

  if(select)
  {
  	this.selected = this._animations[showIndex].name;
  }
  
  if(this.selected==""&&this._animations.length)
  {
    for(var i in this._animations)
    {
      if(this._animations[i].isDefault)
      {
        this.selected = this._animations[i].name;
      }
    }
  }
  this.setOutputData(0, this.selected );
  if(this.outputs.length>1)
  {
    var name = this._animations[showIndex].name;
    name = name.split(".")[0];
    var vec = name.split("/");
    name = vec[vec.length-1];
   
    this.setOutputData(1,name);
  }

}

AnimationManager.prototype.changeAnimation = function(index)
{
  var newIndex = showIndex+index;
  if(newIndex>=this._animations.length)
    newIndex = 0;
  
  if(newIndex<0)
    newIndex = this._animations.length-1;
  showIndex = newIndex;
}

AnimationManager.prototype.onDrawBackground = function( ctx )
{
  ctx.fillStyle = "white";
	ctx.strokeStyle = "#BBB";
  ctx.font = "10px Arial";
	ctx.fillText( "Selected",  80,  this.size[1]/2-30);
  ctx.font = "15px Arial";
  var n = 1;
  var current = this.selected;
  while(n>0){
    var n = current.search("/");
    current = current.slice(n+1);
  }
  ctx.fillText(current , 90, this.size[1]/2-10);
  ctx.font = "10px Arial";
  ctx.fillText("Animations", 80, this.size[1]/2+10);
  ctx.font = "15px Arial";
  
  if(this._animations.length){
  	var animation = this._animations[showIndex].name;
  	var n = 1;
  	while(n>0){
  		var n = animation.search("/");
    	animation = animation.slice(n+1);
  	}
  
  	ctx.fillText(animation, 90, this.size[1]/2+30);
  }
}
AnimationManager.prototype.onGetOutputs = function()
{
  return [["name","string"]];
}

AnimationManager.prototype.onInspect = function( inspector )
{
  var node = this;
	inspector.widgets_per_row = 6;

  for(var i = 0; i < this._animations.length; ++i)
  {
      let animation = this._animations[i];
      inspector.addString( null, animation.name, { point: animation.name, width: "70%", callback: function(v){
        this.options.point = v;
        node.setDirtyCanvas(true);
      }});
      inspector.addButton(null,"X", { point: animation.name, width: "10%", callback: function(){
        LiteGUI.confirm("Are you sure? ", (function(v){
          if(!v)
            return;
          node.removeAnimation( animation.name );	
          inspector.refresh();
        }).bind(this.options));
      }});

    	inspector.addCheckbox("default",  animation.isDefault, { animationIdx: i, callback: function(v){
      	if(v)
        {
          for(var i in node._animations)
          {
          	if(node._animations[i].isDefault)
              node._animations[i].isDefault = false;
          }
        }
        var i = this.options.animationIdx;
        node._animations[i].isDefault = v;
        inspector.refresh();
      }});
	}
  inspector.widgets_per_row = 1;

  var new_point_name = "";
  inspector.addSeparator();
  inspector.addTitle("New animation");
  inspector.widgets_per_row = 2;
  
  inspector.widgets_per_row = 1;
  inspector.addSeparator();
  inspector.addButton("Select animation","<img src='https://webglstudio.org/latest/imgs/mini-icon-folder.png'>",{ micro: true, callback: function(){
    	EditorModule.showSelectResource( { type:"animation", on_complete: function(v){
      	new_animation_name = v; 
        if(new_animation_name){
          node.addAnimation( new_animation_name);
    		}
    		inspector.refresh();
      }});
  }});
  
}

AnimationManager.prototype.addAnimation = function( name)
{
  if( this.findAnimation(name) )
  {
    console.warn("there is already an animation with this name" );
    return;
  }
  var defaultAnim = false;
  if(this._animations.length==0)
    defaultAnim = true;
  this._animations.push({name:name, isDefault: defaultAnim});
  this._values_changed = true;
  this.setDirtyCanvas(true);
}

AnimationManager.prototype.removeAnimation = function(name)
{
  for(var i = 0; i < this._animations.length; ++i)
    if( this._animations[i].name == name )
    {
      this._animations.splice(i,1);
      this._values_changed = true;
      return;
    }
}

AnimationManager.prototype.findAnimation = function( name )
{
  for(var i = 0; i < this._animations.length; ++i)
    if( this._animations[i].name == name )
      return this._animations[i];
  return null;
}

AnimationManager.prototype.onSerialize = function(o)
{
  o.animations = this._animations;
  
}

AnimationManager.prototype.onConfigure = function(o)
{
  if(o.animations)
    this._animations = o.animations;
  for(var i in this._animations)
  {
    LS.RM.load(this._animations[i].name)
  }

}
LiteGraph.registerNodeType("features/animationManager", AnimationManager );