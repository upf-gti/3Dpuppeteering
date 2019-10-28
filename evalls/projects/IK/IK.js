// Based on FABRIK algorithm (https://developer.roblox.com/articles/Inverse-Kinematics-for-Animation)
function InverseKinematics(o) {
  //define some properties
  this.enabled = true;
  this.nodes_uids = [];//node_uid
 	this.constraints = [];
  this.target_uid = null;
  
  this._endEffector = null;
  this._originNode = null;

	this._joints = [];
  this.joint_constraints = [
    {
      type:"BALL",
    	angle: 95
    },
    { 
      type:"HINGE",
      angle: 20,
    }
  ];
  

  this._target = null;
  this.name = "";

  this._init_joints = [];
	this._new_joints = [];

  this._num_of_joints = 0;
  this.tolerance = 1;
  this.lengths = [];

  this.totalLength = null;
  //Swap x  and z axis (arm case)
  this.swap = false;
  
  //front and right vectors joints for debuggin (draw)
	prev_pos = [];
  front0 = [[0,0,0],[1,1,1]];
  up0 = [[0,0,0],[1,1,1]];
  front1 = [[0,0,0],[1,1,1]];
  up1 = [[0,0,0],[1,1,1]];
  
  //if we have the state passed, then we restore the state
  if(o)
    this.configure(o);
}

InverseKinematics.debug = false;

//bind events when the component belongs to the scene
InverseKinematics.prototype.onAddedToScene = function(scene)
{

  LEvent.bind(scene, "update", this.onUpdate, this );
  LEvent.bind(scene,"renderHelper", this.onRenderHelper, this);
}

//unbind events when the component no longer belongs to the scene
InverseKinematics.prototype.onRemovedFromScene = function(scene)
{
  LEvent.unbindAll(scene, this );
}


InverseKinematics.prototype.onRenderHelper = function(){
  if(!InverseKinematics.debug)
    return;
  
  var points = [];
  var pointsInit = [];
  for(var i=0;i<this._new_joints.length;i++)
  {
    points.push(this._new_joints[i].position);
  }
  for(var i=0;i<this._init_joints.length;i++)
  {
    pointsInit.push(this._init_joints[i].position);
  }
 
  LS.Draw.setColor(1,1,1,1);
	LS.Draw.renderLines( points, [[1,0,0,1],[1,1,0,1],[1,0,1,1]],true)
  LS.Draw.renderLines( pointsInit, [[1,0,0,1]],true)
  LS.Draw.setColor(0,1,1,1);
  LS.Draw.renderLines( prev_pos, [[1,0,1,1]],true)
  
  //Test right and front vectors 
  if(this.swap)
    LS.Draw.setColor(0,0,1,1);
  else
  	LS.Draw.setColor(1,0,0,1);
  LS.Draw.renderLines( up0)
  LS.Draw.renderLines( up1)
  if(this.swap)
    LS.Draw.setColor(1,0,0,1);
  else
  	LS.Draw.setColor(0,0,1,1);
  LS.Draw.renderLines( front0)
  LS.Draw.renderLines( front1)
}

/* Add a new joint to the chain */
InverseKinematics.prototype.addJoint = function ( joint, constraint )
{
  //If there are not any joint, set it as origin joint
  if(!this._joints.length)
    this._origin = joint.transform.position.clone();
  
  //Set default constraint (BALL)
	if(!constraint)
  	constraint = Object.assign({},this.joint_constraints[0]);
  
  joint.constraint = constraint;
  this.constraints.push(constraint)
  this._joints.push(joint);
  
  this._num_of_joints = this._joints.length;
  
  /*this.computeLengths();
  this.sumChainLength();*/
}

/* Calculate the lengths vector */
InverseKinematics.prototype.computeLengths = function()
{
  this.lengths = [];  
  for(var i =0; i < this._joints.length-1; i++) 
  {
    this.lengths[i] = this.computeDistance(this._joints[i], this._joints[i+1]);
  }
}

/* Calculate the distance between two joints */
InverseKinematics.prototype.computeDistance = function( joint1, joint2)
{
  if(!joint2)
    return;
  var pos1 = joint1.transform.getGlobalPosition();
  var pos2 = joint2.transform.getGlobalPosition();
	
  var dist = vec3.distance(pos1, pos2);
  return dist;
}

/* Sum all the lengths and set up the totalLength param used in the solver */
InverseKinematics.prototype.sumChainLength = function()
{
  var sum = 0;
  for(var i in this.lengths)
  {
    sum += this.lengths[i];
  }
  this.totalLength = sum;
}

InverseKinematics.prototype.setJoints = function()
{
  //If the nodes are saved, get them by their id (we can't serialize it as SceneNode, we have to save its uid)
  if(this.nodes_uids.length==2&&!this._originNode&&!this._endEffector)
  {
    this._originNode = LS.GlobalScene.getNode(this.nodes_uids[0] );
  	this._endEffector = LS.GlobalScene.getNode(this.nodes_uids[1] );
    
  }
  //Set default nodes
  if(!this._originNode||!this._endEffector)
  {
    this._originNode = LS.GlobalScene.getNode("mixamorig_LeftUpLeg")
    this._endEffector = LS.GlobalScene.getNode("mixamorig_LeftFoot")    
  }
  
  this._joints = [];
  var joint = this._originNode;
  
  if(!joint)
    return;
  
  //Build all the chain 
  var i = 0;
  while(joint && joint!=this._endEffector)
  {
    
    this.addJoint(joint, this.constraints[i]);
    joint = joint._children[0];
    i++;
  }
  this.addJoint(joint,this.constraints[i]);
  
  //Set/Update the origin and end effector id
  if( this.nodes_uids.length==2 ){
		this.nodes_uids[0] = this._originNode._uid;
  	this.nodes_uids[1] = this._endEffector._uid;
  }
  else{
    this.nodes_uids.push(this._originNode._uid);
  	this.nodes_uids.push(this._endEffector._uid);
  }
  this._num_of_joints = this._joints.length;
  
  this.computeLengths();
  this.sumChainLength();

}
InverseKinematics.prototype.onUpdate = function(e,dt)
{
  if(this.enabled)
  {
    if(this._joints.length==0)
      this.setJoints();

    if(!this._target&&this.target_uid)
    {
      var target = LS.GlobalScene.getNode(this.target_uid);
      if(target)
        this._target = target;
    }

    this.solve();
  }
}

/* This solver, by the moment, does not have constrainsts neither multiple end effectors with sub-bases */
InverseKinematics.prototype.solve = function()
{
	//Build working chain (not modify node joints directly)
  if(this._new_joints.length ==0)
  {
    debugger;
    for(var i = 0; i< this._joints.length; i++)
    {
      //all in global coordinates
      var global_matrix = this._joints[i].transform.getGlobalMatrix().clone();
      var pos = this._joints[i].transform.globalPosition.clone();
      
      var joint = {
        position : pos,
        globalMatrix: global_matrix          
      }
      var joint2 = Object.assign({},joint);
      joint.right = this._joints[i].transform.getRight();
			joint.front = this._joints[i].transform.getFront();
      this._init_joints.push(joint);
      this._new_joints.push(joint2);
      
      //Test chain (to draw)
      prev_pos.push(pos)
    }
  }
	
  var target = this._target.transform.getGlobalPosition();
  var distance = vec3.distance(this._new_joints[0].position, target);

  /* If the target is out of reach for the chain */
  if(distance > this.totalLength)
  {
    var a = vec3.create();
  
    vec3.sub(a, target, this._new_joints[0].position)
    vec3.normalize(a,a);
    vec3.scale(a,a,this.totalLength);
    vec3.add(a, a,this._joints[0].transform.getGlobalPosition());
    target = a;
  }
  /* The target is reachable */

  var bcount = 0;
  /* diff is the distance from the end effector to the chain target */
  var diff = vec3.distance((this._new_joints[this._num_of_joints-1].position), target);
  /*this.backward();
  this.forward();*/
  
  while( diff > this.tolerance) //if it is within the error margin
  {
    /*this.backward();
    this.forward();
    diff = vec3.distance((this._new_joints[this._num_of_joints-1].position), target);*/
    bcount ++;

    if(bcount > 10)
    {
      this.backward();
    	this.forward();
      break;
    }
  }
  this.apply();  

}

/*
 * From the end effector, set to the goal, we calculate the positions for the rest of 
 * the joints to accomplish the goal 
* */
InverseKinematics.prototype.backward = function(chain)
{
  
  var target = this._target.transform.getGlobalPosition();
  this._new_joints[this._num_of_joints-1].position = target;
  prev_pos[this._num_of_joints-1] = target;

  for(var i =this._num_of_joints - 2; i > -1; i--)
  {   
    /* Create direct line to target and travel join distance across it */
    var prev = this._new_joints[i+1].position;
    var current = this._new_joints[i].position;
    var r = vec3.distance(prev, current);
    var l_factor = this.lengths[i]/r;

    /* Find position fot the joint */
    var new_pos = vec3.create();
    vec3.lerp(new_pos, this._new_joints[i+1].position, this._new_joints[i].position, l_factor);
    	
    this._new_joints[i].position =  new_pos.clone();
    
    //-----------------------------TEST
     /* Create direct line to target and travel join distance across it */

    var r1 = vec3.distance(prev_pos[i+1], prev_pos[i]);
    /* Find position fot the joint */
    var pp = vec3.create();
    vec3.lerp(pp,prev_pos[i+1], prev_pos[i], this.lengths[i]/r1);
    //Cambiar de coordenadas globales a coordenadas locales del padre
	
    prev_pos[i] =  pp.clone();//new_pos;
    
  }
}
/*  
 * We put again the "root" on the original position, and we calculate again the joints
 * positions 
*/
InverseKinematics.prototype.forward = function(chain)
{
 
  this._new_joints[0].position = this._init_joints[0].position.clone();
  //---TEST
  prev_pos[0] =  this._init_joints[0].position.clone();
  //----
  
  for(var i =0; i <  this._num_of_joints - 1; i++)
  { 
    /* Create direct line to target and travel join distance across it */
    var r = vec3.distance(this._new_joints[i+1].position, this._new_joints[i].position);
    var l_factor = this.lengths[i]/r;
    var new_pos = vec3.create();
    new_pos = this._new_joints[i+1].position.clone();
    
    //---TEST
    var pp =  new_pos.clone();
    vec3.lerp(pp, prev_pos[i], prev_pos[i+1], l_factor);
    prev_pos[i+1] = pp;
    //-----
    switch(this._joints[i].constraint.type){
    	
      case "BALL":
    
        //If there're some angle motion constraint, set previos position to new position
        var newJointVec = vec3.sub(vec3.create(),new_pos, this._new_joints[i].position);
      	var initJointVec = vec3.sub(vec3.create(),this._init_joints[i+1].position, this._new_joints[i].position);
      	
        vec3.normalize(newJointVec,newJointVec);
      	vec3.normalize(initJointVec, initJointVec);
        
      	var angle = vec3.angle(initJointVec,newJointVec)*RAD2DEG;
      	
        if(angle >this._joints[i].constraint.angle)
      	{
          this._new_joints[i+1].position = this._joints[i+1].transform.getGlobalPosition();
          //this._new_joints[i+2].position = this._joints[i+2].transform.getGlobalPosition();
          //return;
      	}
  			break;	  
      case "HINGE":
    
        if(this.swap)
        {
          var xaxis = LS.RIGHT.clone();
        }
        else
        {
          var xaxis = LS.RIGHT.clone();
          vec3.negate(xaxis,xaxis)
        }
				//Get global position of parent node	
        if(i-1<0)
        {
          var parentPos = this._joints[i].transform._parent.getGlobalPosition();
          var parentPosInit = this._joints[i].transform._parent.getGlobalPosition();
        }
        else
        {
          var parentPos = this._new_joints[i-1].position;
          var parentPosInit = this._init_joints[i-1].position;
        }
        //Compute vectors from this joint to its parent and its child      
        var toChildVec = vec3.sub(vec3.create(),new_pos, this._new_joints[i].position);
        var toParentVec = vec3.sub(vec3.create(),parentPos, this._new_joints[i].position);
        vec3.normalize(toChildVec,toChildVec);
        vec3.normalize(toParentVec, toParentVec);

        var angle = vec3.angle(toParentVec,toChildVec)*RAD2DEG;
        var cross = vec3.cross(vec3.create(),toParentVec,toChildVec)
        var dir = vec3.dot(cross,xaxis);
				
        //If the new position form an angle bigger than ~178º
        if (dir < -0.1 ) 
        {
          var alpha = 180-angle;
          alpha = Math.abs(alpha)*DEG2RAD; 
          
          var initVec = vec3.sub(vec3.create(),this._init_joints[i].position, parentPos);
          var newVec = vec3.sub(vec3.create(),this._new_joints[i].position, parentPos);
          
          var l = vec3.length(newVec);
          
          vec3.normalize(initVec,initVec);
          vec3.normalize(newVec, newVec);
          
          var angleBetefore = vec3.dot(newVec,initVec )
          //quat.rotateToFrom(vec3.create(), v1, v2, delta)
          
          //Rotate newVec and put the new position in this direction
          if(this.swap){
            var pos = vec3.rotateX(vec3.create(),newVec,2*alpha)
          }else
            var pos = vec3.rotateX(vec3.create(),newVec,-2*alpha)//-angle*DEG2RAD)

          //yaxisA[2]*=-1
          vec3.scaleAndAdd(pos, parentPosInit,pos,l)
          //vec3.lerp(pos, this._new_joints[i-1].position, pos,this.lengths[i-1]/l)

          this._new_joints[i].position = pos;
          var new_axis = vec3.create()
          vec3.normalize(new_axis,pos);
          angle = vec3.angle(new_axis,newJointVec)*RAD2DEG;

        }
        //If hinge has a Minimum angle
        if(angle<this._joints[i].constraint.angle&&dir>0)
        {
          new_pos = this._joints[i+1].transform.getGlobalPosition();
          //vec3.lerp(new_pos, this._new_joints[i].position, new_pos, l_factor);
          this._new_joints[i+1].position = new_pos.clone();
          //return;
        }
        break;
     }
    
     /* Find position fot the joint */
   	vec3.lerp(new_pos, this._new_joints[i].position, this._new_joints[i+1].position, l_factor);

    this._new_joints[i+1].position = new_pos.clone();
  }

}

InverseKinematics.prototype.apply = function () 
{

  for(var i = 0; i < this._num_of_joints-1;i++) //- 1; i++)
  {
    var zaxis = LS.FRONT.clone();
		var xaxis = LS.RIGHT.clone();

    var parentRot = this._joints[i].parentNode.transform.getGlobalMatrix().clone();
		
    var rot = this._joints[i].transform._rotation.clone(); 
    this._joints[i].transform.resetRotation();
    
		
    var yaxis = this._joints[i].transform.globalToLocal( this._new_joints[i+1].position );

    var front_pos = this._new_joints[i].position.clone();
    var right_pos = this._new_joints[i].position.clone();

    if(this._init_joints[i].front[0]<=0&&this.swap|| this._init_joints[i].front[2]<0&&!this.swap )
			front_pos[2] = front_pos[2]+ 20;    
    else if(this._init_joints[i].front[0]>0&&this.swap || this._init_joints[i].front[2]>=0&&!this.swap )
      front_pos[2] = front_pos[2]- 20;
    
    if(this._init_joints[i].right[2]>0&&this.swap || this._init_joints[i].right[0]>0&&!this.swap)
			right_pos[0] = right_pos[2] +20;    
    else if(this._init_joints[i].right[2]<=0&&this.swap || this._init_joints[i].right[0]<=0&&!this.swap)
      right_pos[0] = right_pos[2]- 20; 
    /*front_pos[2] = this.swap? front_pos[2]-20 : front_pos[2]+ 20;  
    right_pos[0] = right_pos[0]-20;    */
    
    /*if(this._joints[i].constraint.type=="HINGE")
        vec3.negate(right_pos , LS.RIGHT);*/ 
    
    //-------------TEST----------------
    if(i==0)  
    {
      
      front0 = [this._new_joints[i].position.clone(),front_pos];
      up0 = [this._new_joints[i].position.clone(), right_pos]
    }
    if(i==1)  
    {
      front1 = [this._new_joints[i].position.clone(),front_pos];
      up1 = [this._new_joints[i].position.clone(), right_pos]
    }
    //--------------------------------------
    
    //Local to Global
    var inv = mat4.create()
    mat4.invert(inv,parentRot);

    mat4.multiplyVec3( zaxis, inv, front_pos )
    mat4.multiplyVec3( xaxis, inv, right_pos )
    
    
    if(this.swap){
    
      var quaternion = vec3.orientTo(zaxis,yaxis,xaxis,LS.TOP);
    
    }else{
   		var quaternion = vec3.orientTo(xaxis,yaxis,zaxis,LS.TOP);
     
    }
    //guardar rotacio inicial i passarli juntament amb la final
    quat.slerp(quaternion, rot,quaternion,1);
    this._joints[i].transform._rotation.set(quaternion)
    this._joints[i].transform._must_update = true;
  }
}
vec3.orientTo = function(xaxis,yaxis,zaxis,fixed)
{
  //OrientTo (get perpenicular vectors)
  //Algorithm http://matthias-mueller-fischer.ch/publications/stablePolarDecomp.pdf
  var temp = mat3.create();

  vec3.normalize(xaxis, xaxis);
  vec3.normalize(yaxis, yaxis)
  vec3.normalize(zaxis, zaxis);
  
	mat3.setColumn(temp, xaxis, 0 ); //x
  mat3.setColumn(temp, yaxis, 1 ); //y
  mat3.setColumn(temp, zaxis, 2 ); //z

  var first_quat = quat.create();
  //quat.fromMat3( first_quat, temp );
  quat.fromMat3AndQuat( first_quat, temp );

  //Reorient perpendicular vectors (get rotation respect Up vector)
  var new_up = vec3.create();
  if(fixed)
  {
    var axisId = fixed.findIndex(function (v){ return v!=0})
    var axis = yaxis.clone();
    switch(axisId)
    {
      case 0:
        axis = xaxis.clone();
        break;
      case 1:
        axis = yaxis.clone();
        break;
      case 2:
        axis = zaxis.clone();
        break;
    }
    vec3.transformQuat(new_up, fixed,first_quat);
    var new_quat = quat.create();
    quat.rotateToFrom(new_quat,new_up,axis);
    quat.multiply(first_quat,new_quat,first_quat);
  }

  return first_quat;
}
quat.rotateToFrom = function(out, v1, v2, delta)
{
  	if(!delta)
      delta = 0.01;
  //http://number-none.com/product/IK%20with%20Quaternion%20Joint%20Limits/
		out = out || quat.create();
  
  	var axis = vec3.cross(vec3.create(), v1, v2);
  	var dot = vec3.dot(v1, v2);
  
  	if( dot < -1 + delta){
      out[0] = 0;
      out[1] = 1; 
      out[2] = 0; 
      out[3] = 0; 
			return out;
		}
  	
    out[0] = axis[0] * 0.5;
    out[1] = axis[1] * 0.5; 
    out[2] = axis[2] * 0.5; 
    out[3] = (1 + dot) * 0.5; 
  
  	quat.normalize(out, out); 
  
  	return out;    
}


InverseKinematics["@inspector"] = function( component, inspector)
{
	inspector.widgets_per_row = 1;
 	
  inspector.addCheckbox("Swap axis", component.swap, { callback: function(v) {
  	component.swap = v;
  }});
  
  if(component.nodes_uids.length)
  	component.setJoints();
	var new_chain_name = "";
	inspector.addTitle("Chain")
	inspector.addStringButton( "Name", component.name, { callback: function(v) { 
		new_chain_name = v;

		if(!new_chain_name)
			return;
		component.name =  new_chain_name ;

	}});

  inspector.widgets_per_row = 2;
  inspector.addInfo("Joints", component._num_of_joints );
	inspector.addButton(null,"Edit joints", { callback: function(v,e){
		InverseKinematics.showPoseNodesDialog( component, e );

    	}});
  
	inspector.addSeparator();
	inspector.widgets_per_row = 3;
	var target = null;
  if(component.target_uid){
   target = LS.GlobalScene.getNode(component.target_uid);
   if(target)
     component._target = target;
  }
  
  var target_widget = inspector.addNode("Target", target, { width: "70%", callback: function(v){
    component._target = v;
    target = v;
    component.target_uid = v._uid;
    
  }});
  inspector.addButton(null,"From Select.", { width: "30%", callback: function(){
			target_widget.setValue( SelectionModule.getSelectedNode() );
		}});
  inspector.widgets_per_row = 1;
	inspector.addButtons(null,["Apply","Delete"], function(v){

		if(v == "Apply")
    {

			component.setJoints();
    }
		else if( v == "Delete" )
		{
      delete this._joints;
      this._num_of_joints = 0;
      this._origin = null;
      this._target = null;
      this.target_uid = null;
      this.name = "";

		}
		inspector.refresh();
		LS.GlobalScene.requestFrame();
	});

}

InverseKinematics.showPoseNodesDialog = function( component, event )
{
  var scene = component._root.scene;
	var dialog = new LiteGUI.Dialog({title:"Nodes in Chain", close: true, width: 600, height: 400, resizable: true, scroll: true, draggable: true});

	var area = new LiteGUI.Area();
  dialog.add(area);
	
	var widgets_right = new LiteGUI.Inspector({ height: "100%", noscroll: false });
	area.add( widgets_right );
  dialog.show('fade');
	widgets_right.on_refresh = inner_refresh_right;

	var nodeEnd = null;
  var nodeOrig = null;

	widgets_right.refresh();

	function inner_refresh_right()
	{
		widgets_right.clear();
    
		widgets_right.addTitle("Select a node");
		widgets_right.widgets_per_row = 2;
    var childrenNodes = [];
    if(component.nodes_uids.length==2)
    {
    	component._originNode = LS.GlobalScene.getNode(component.nodes_uids[0] );
  		component._endEffector = LS.GlobalScene.getNode(component.nodes_uids[1] );
    }
    if(component._endEffector)
      nodeEnd = component._endEffector;

    if(component._originNode)
    {
      nodeOrig = component._originNode;
     	childrenNodes = nodeOrig.getDescendants();
    }
    var nodeOrig_widget = widgets_right.addNode("Origin", nodeOrig, { width: "70%", callback: function(v){
			nodeOrig = v;
      component._originNode = nodeOrig;
      component.nodes_uids[0] = component._originNode._uid;
      childrenNodes = v.getDescendants();
      widgets_right.refresh();
		}});
    
		widgets_right.addButton(null,"From Select.", { width: "30%", callback: function(){
			nodeOrig_widget.setValue( SelectionModule.getSelectedNode() );
		}});
    widgets_right.widgets_per_row = 2;
    if(childrenNodes.length)
    {
      //selected no acaba de funcionar
      var nodeEnd_widget = widgets_right.addList("End effector", childrenNodes, {selected: childrenNodes.indexOf(nodeEnd), width: "70%",  callback: function(v){
        nodeEnd = v;
        component._endEffector = nodeEnd;
        component.nodes_uids[1] = component._endEffector._uid;
        component.setJoints();
        widgets_right.refresh();
      }});
      
      widgets_right.addButton(null,"From Select.", { width: "30%", callback: function(){
        nodeEnd = SelectionModule.getSelectedNode();
        component._endEffector = nodeEnd;
        component.nodes_uids[1] = component._endEffector._uid;
        component.setJoints();
        widgets_right.refresh();
        //nodeEnd_widget.selectIndex(childrenNodes.indexOf(nodeEnd))
       	
      }});
    }
    widgets_right.widgets_per_row = 2;
    widgets_right.addSeparator();
    widgets_right.addTitle("Joint type");
    var types = [];
    var angles = [];
    
    for ( i = 0; i < component.joint_constraints.length; i++)
    {
      types.push(component.joint_constraints[i].type)
      angles.push(component.joint_constraints[i].angle)
    }
    for(i=0; i< component._joints.length; i++)
    {
      widgets_right.addCombo(component._joints[i].name, component.constraints[i].type, {id:i, values: types, name_width: "50%", callback: function(v){
        var id = this.options.id;
        
        component._joints[id].constraint.type = v;
       	component.constraints[id].type = v;
        widgets_right.refresh();
      }})
      
      widgets_right.addNumber("Angle", component.constraints[i].angle, {id:i, values: angles, callback: function(v){
        var id = this.options.id;
        
        component._joints[id].constraint.angle = v;
       	component.constraints[id].angle = v;
        widgets_right.refresh();
      }})
    }

		widgets_right.addButtons(null,["Apply"], function(v){
			if(!nodeEnd)
				return;
			if(v == "Apply")
			{
				
				dialog.close();
        
			}

		});
    
	}

	return dialog;
}

LS.registerComponent( InverseKinematics );
