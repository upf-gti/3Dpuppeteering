"use strict"

// Based on FABRIK algorithm (https://developer.roblox.com/articles/Inverse-Kinematics-for-Animation)
function IKChain(o)
{
	//define some properties
	this.enabled = true;

	this.nodes_uids = [];//node_uid
	this.constraints = [];
	this.target_uid = null;

	this._endEffector = null;
	this._originNode = null;

	this._joints = [];

	this._target = null;
	this.name = "";

	this._init_joints = [];
	this._new_joints = [];
	this._origin = vec3.create();

	this._num_of_joints = 0;
	this.tolerance = 1;
	this.lengths = [];

	this.totalLength = null;
	//Swap x  and z axis (arm case)
	this.swap = false;
	this.front = IKChain.POSZ;
	this.up = IKChain.POSY;
  this.right = IKChain.POSX;
  
	//front and right vectors joints for debuggin (draw)
	this._front0 = new Float32Array([0,0,0,0,0,0]);
	this._front1 = new Float32Array([0,0,0,0,0,0]);
	this._up0 = new Float32Array([0,0,0,0,0,0]);
	this._up1 = new Float32Array([0,0,0,0,0,0]);
  this._right0 = new Float32Array([0,0,0,0,0,0]);
	this._right1 = new Float32Array([0,0,0,0,0,0]);
	this.prev_pos = [];

	//if we have the state passed, then we restore the state
	if(o)
		this.configure(o);
}
IKChain.POSX = 1;
IKChain.NEGX = 2;
IKChain.POSY = 3;
IKChain.NEGY = 4;
IKChain.POSZ = 5;
IKChain.NEGZ = 6;

IKChain["@right"] = { type: 'enum', values: { "-Z": IKChain.NEGZ,"+Z": IKChain.POSZ, "-Y": IKChain.NEGY,"+Y": IKChain.POSY,"-X": IKChain.NEGX,"+X": IKChain.POSX }};
IKChain["@front"] = { type: 'enum', values: { "-Z": IKChain.NEGZ,"+Z": IKChain.POSZ, "-Y": IKChain.NEGY,"+Y": IKChain.POSY,"-X": IKChain.NEGX,"+X": IKChain.POSX }};
IKChain["@up"] = { type: 'enum', values: { "-Z": IKChain.NEGZ,"+Z": IKChain.POSZ, "-Y": IKChain.NEGY,"+Y": IKChain.POSY,"-X": IKChain.NEGX,"+X": IKChain.POSX }};

this.debug = false;
IKChain.debug_lines = [];

IKChain.BALL_JOINT = 1;
IKChain.HINGE_JOINT = 2;

IKChain.joint_constraints = [{name: "Ball", type: IKChain.BALL_JOINT, angle: 95 }, { name:"Hinge", type:IKChain.HINGE_JOINT, angle: 20 }];

//bind events when the component belongs to the scene
IKChain.prototype.onAddedToScene = function(scene)
{
	LEvent.bind(scene, "update", this.onUpdate, this );
	LEvent.bind(LS.Renderer, "renderHelpers", this.onRenderHelpers, this);
 
}

//unbind events when the component no longer belongs to the scene
IKChain.prototype.onRemovedFromScene = function(scene)
{
	LEvent.unbindAll( scene, this );
  LEvent.unbindAll( LS.Renderer, this );
}

IKChain.axis_colors = [[1,0,0,1],[1,0,0,1],[1,1,0,1],[1,1,0,1],[1,0,1,1],[1,0,1,1]];

IKChain.prototype.onRenderHelpers = function() {
  
	if(!this.debug)
		return;

	var points = [];
	var pointsInit = [];
	for(var i = 0; i < this._new_joints.length; i++)
		points.push( this._new_joints[i].position );
	for(var i = 0; i < this._init_joints.length; i++)
		pointsInit.push( this._init_joints[i].position );

	//LS.Draw.setColor(1,1,1,1);
	LS.Draw.renderLines( points, IKChain.axis_colors, true);
	//LS.Draw.renderLines( pointsInit, [[1,1,1,1], [1,1,1,1],  [1,1,1,1]], true);
	//LS.Draw.setColor(0,1,1,1);
	//LS.Draw.renderLines( this.prev_pos, [[0,1,0,1], [0,1,0,1],  [0,1,0,1], [0,1,0,1]], true);

	//Test right and front vectors 

	LS.Draw.renderLines( this._up0,[[0,1,0,1], [0,1,0,1]] );
	LS.Draw.renderLines( this._up1, [[0,1,0,1], [0,1,0,1]]);
  
  LS.Draw.renderLines( this._right0,[[1,0,0,1], [1,0,0,1]] );
	LS.Draw.renderLines( this._right1, [[1,0,0,1], [1,0,0,1]]);
	
	LS.Draw.renderLines( this._front0,[[0,0,1,1], [0,0,1,1]] );
	LS.Draw.renderLines( this._front1 ,[[0,0,1,1], [0,0,1,1]] );
}

/* Add a new joint to the chain */
IKChain.prototype.addJoint = function ( joint, constraint )
{
	//Set default constraint (BALL)
  if(!constraint){
		constraint = Object.assign({}, IKChain.joint_constraints[0] );
  	this.constraints.push( constraint )
  }
	
  joint.constraint = Object.assign({},constraint);
	this._joints.push( joint );
	this._num_of_joints = this._joints.length;

	/*this.computeLengths();
	this.sumChainLength();*/
}

/* Calculate the lengths vector */
IKChain.prototype.computeLengths = function()
{
	this.lengths = [];  
	for(var i =0; i < this._joints.length-1; i++) 
	{
		this.lengths[i] = this.computeDistance(this._joints[i], this._joints[i+1]);
	}
}

/* Calculate the distance between two joints */
IKChain.prototype.computeDistance = function( joint1, joint2)
{
	if(!joint2)
		return;
	var pos1 = joint1.transform.getGlobalPosition();
	var pos2 = joint2.transform.getGlobalPosition();

	var dist = vec3.distance(pos1, pos2);
	return dist;
}

/* Sum all the lengths and set up the totalLength param used in the solver */
IKChain.prototype.sumChainLength = function()
{
	var sum = 0;
	for(var i in this.lengths)
	{
		sum += this.lengths[i];
	}
	this.totalLength = sum;
}

IKChain.prototype.setJoints = function(numJoints)
{
	//If the nodes are saved, get them by their id (we can't serialize it as SceneNode, we have to save its uid)
	if(this.nodes_uids.length == 2 && !this._originNode && !this._endEffector)
	{
		this._originNode = LS.GlobalScene.getNode(this.nodes_uids[0] );
		this._endEffector = LS.GlobalScene.getNode(this.nodes_uids[1] );
	}
	//Set default nodes
	/*if(!this._originNode || !this._endEffector)
	{
		this._originNode = LS.GlobalScene.getNode("mixamorig_LeftArm")
		this._endEffector = LS.GlobalScene.getNode("mixamorig_LeftHand")    
	}*/
//If there are not any joint, set it as origin joint
			
	this._joints = [];
  var joint = this._endEffector;// Object.assign({},this._endEffector);

  if(!joint)
    return;
  
  if(numJoints)
  {
    
    //for(var i = 0; i<numJoints; i++)
    for(var i = numJoints-1; i>=0; i--)
    {
      this.addJoint(joint, this.constraints[i]);
      joint = joint.getParent();
    }
    this._joints.reverse();
    this._originNode = this._joints[0];
    this._origin.set( this._originNode.transform.position );
  }
  else
  {
    //Build all the chain 
    //var i = 0;
    var i = this.constraints.length-1
    while(joint && joint != this._originNode)
    {
      this.addJoint(joint, this.constraints[i]);
      joint = joint.getParent();
      i--;
    }
    this.addJoint(joint,this.constraints[i]);
    this._joints.reverse();
    this._origin.set( this._originNode.transform.position );
  }
	//Set/Update the origin and end effector id
	if( this.nodes_uids.length == 2 ){
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

IKChain.prototype.onUpdate = function(e,dt)
{
	if(this._joints.length == 0)
		this.setJoints();

	if(!this._target && this.target_uid)
	{
		var target = LS.GlobalScene.getNode( this.target_uid );
		if(target)
		this._target = target;
	}
	if(this.enabled)
		this.solve();
}

/* This solver, by the moment, does not have constrainsts neither multiple end effectors with sub-bases */
IKChain.prototype.solve = function()
{
	//Build working chain (not modify node joints directly)
	if(this._new_joints.length == 0)
	{
		for(var i = 0; i < this._joints.length; i++)
		{
			//all in global coordinates
			var global_matrix = this._joints[i].transform.getGlobalMatrix();
			var pos = this._joints[i].transform.globalPosition.clone();

			var joint = {
				position : vec3.fromValues(pos[0],pos[1],pos[2]),
				globalMatrix: global_matrix          
			}
      var joint2 = {
				position : vec3.fromValues(pos[0],pos[1],pos[2]),
				globalMatrix: global_matrix          
			}
			//var joint2 = Object.assign({},joint);
			joint.right = this._joints[i].transform.getRight();
			joint.front = this._joints[i].transform.getFront();
      joint.up = this._joints[i].transform.getTop();
			this._init_joints.push(joint);
			this._new_joints.push(joint2);

			//Test chain (to draw)
			this.prev_pos.push( pos );
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
	var diff = vec3.distance( this._new_joints[this._num_of_joints-1].position, target );
	this.backward();
	this.forward();

	/*while( diff > this.tolerance ) //if it is within the error margin
	{

		diff = vec3.distance((this._new_joints[this._num_of_joints-1].position), target);
		bcount ++;

		if(bcount > 10)
		{
			/*this.backward();
			this.forward();*/
      //this.apply();
		/*	break;
		}
	}*/
	this.apply();  
}

/*
 * From the end effector, set to the goal, we calculate the positions for the rest of 
 * the joints to accomplish the goal 
* */
IKChain.prototype.backward = function(chain)
{
  var endEffPrevPos = this._new_joints[ this._num_of_joints - 1 ].position.clone();
	var target = this._target.transform.getGlobalPosition();
	this._new_joints[ this._num_of_joints - 1 ].position.set( target );
	this.prev_pos[ this._num_of_joints - 1 ] = target;
	var new_pos = vec3.create();

	for(var i = this._num_of_joints - 2; i > -1; i--)
	{   
		// Create direct line to target and travel join distance across it 
		var prev = this._new_joints[i+1].position;
		var current = this._new_joints[i].position;
		var r = vec3.distance(prev, current);
		var l_factor = this.lengths[i] / r;

		// Find position for the joint
		vec3.lerp( new_pos, this._new_joints[i+1].position, this._new_joints[i].position, l_factor);
		switch( this.constraints[i].type )
		{
      case IKChain.HINGE_JOINT:
        var prevVec = vec3.sub(vec3.create(),this._new_joints[i].position, this._new_joints[i-1].position)
        var toTarget = vec3.sub(vec3.create(),target, this._new_joints[i].position)
        vec3.normalize(prevVec,prevVec)
        vec3.normalize(toTarget,toTarget)
        var cross = vec3.cross(vec3.create(), toTarget,prevVec);
        console.log(cross)
        if(cross[0]<-0.01|| cross[1]<-0.01)
        {
          
          var d1 = vec3.dist(target,this._new_joints[i].position);
          var d2= vec3.dist(target,new_pos);
          var d = Math.abs(d2-d1);
          vec3.subValue(new_pos,this._new_joints[i].position,d);
          var r = vec3.distance(prev, new_pos);
					var l_factor = this.lengths[i] / r;
          vec3.lerp( new_pos, this._new_joints[i+1].position, new_pos, l_factor);
        }
        break;
    }
		this._new_joints[i].position.set( new_pos );

		//-----------------------------DEBUG---------------------------------------
		
    // Create direct line to target and travel join distance across it 
		var r1 = vec3.distance( this.prev_pos[i+1], this.prev_pos[i]);
		// Find position fot the joint 
		var pp = vec3.create();
		vec3.lerp(pp,this.prev_pos[i+1], this.prev_pos[i], this.lengths[i]/r1);
		//Cambiar de coordenadas globales a coordenadas locales del padre

		this.prev_pos[i] = pp.clone();//new_pos;
    //-----------------------------------------------------------------------------
	}
}

/*  
 * We put again the "root" on the original position, and we calculate again the joints
 * positions 
*/
IKChain.prototype.forward = function(chain)
{
 	this._new_joints[0].position = this._init_joints[0].position.clone();
	//---TEST
	this.prev_pos[0] = this._init_joints[0].position.clone();
	//----

	for(var i =0; i < this._num_of_joints - 1; i++)
	{ 
		// Create direct line to target and travel join distance across it 
		var r = vec3.distance(this._new_joints[i+1].position, this._new_joints[i].position);
		var l_factor = this.lengths[i]/r;
		var new_pos = vec3.create();
    
		vec3.lerp(new_pos, this._new_joints[i].position, this._new_joints[i+1].position, l_factor);
		//new_pos = this._new_joints[i+1].position.clone();

		//-------------------------------DEBUG------------------------------------------
		var pp =  new_pos.clone();
		vec3.lerp(pp, this.prev_pos[i], this.prev_pos[i+1], l_factor);
		this.prev_pos[i+1] = pp;
		//---------------------------------------------------------------------------------------
    
		/*switch( this.constraints[i].type )
		{
      case IKChain.BALL_JOINT:

        //If there're some angle motion constraint, set previos position to new position
        var newJointVec = vec3.sub(vec3.create(),new_pos, this._new_joints[i].position);
        var initJointVec = vec3.sub(vec3.create(),this._init_joints[i+1].position, this._new_joints[i].position);

        vec3.normalize(newJointVec,newJointVec);
        vec3.normalize(initJointVec, initJointVec);

        var angle = vec3.angle(initJointVec,newJointVec)*RAD2DEG;

        if(angle >this.constraints[i].angle)
        {
          this._new_joints[i+1].position = this._joints[i+1].transform.getGlobalPosition();
          //this._new_joints[i+2].position = this._joints[i+2].transform.getGlobalPosition();
         return
        }
        break;	  
    
      case IKChain.HINGE_JOINT:

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
       	var toTarget = vec3.sub(vec3.create(), this._target.transform.getGlobalPosition(),parentPos);
        
        vec3.normalize(toChildVec,toChildVec);
        vec3.normalize(toParentVec, toParentVec);
				vec3.normalize(toTarget, toTarget);
        var parentToChild = vec3.negate(vec3.create(), toParentVec);
        var xaxis = vec3.cross(vec3.create(),toTarget, parentToChild)
        
       

        //Obtenir l'angle entre els dos vectors del hinge en l'eix X (si es major de 178, invertir la rotacio)
      

        //Dot product gives the smaller angle (190 is 10) 
        var angle = vec3.angle(toParentVec,toChildVec)*RAD2DEG;
        var cross = vec3.cross(vec3.create(),toParentVec,toChildVec);

				var distToTarget = vec3.dist( this._new_joints[0].position, this._target.transform.getGlobalPosition())
        var min = Math.min(cross[0],cross[1]);

        //If the new position form an angle bigger than ~178º (if dir<0 means that the angle is bigger than 180º)
        if ((cross[0] < 0.0001) && this.totalLength >= distToTarget)//(dir < -0.1 ) 
        {
					var parentPosLocal = this._joints[i].transform._parent.getPosition();
          var currentPosLocal =  this._joints[i].transform._parent.globalToLocal(this._new_joints[i].position);
          var toTargetLocal = this._joints[i].transform._parent.globalToLocal(this._target.transform.getGlobalPosition())
          var newVec = vec3.sub(vec3.create(),currentPosLocal, parentPosLocal);

          //var l = vec3.length(initVec);

         /* vec3.normalize(initVec,initVec);*/
        /*  var newVecNorm = vec3.create();
          //newVec = this._joints[i].transform._parent.globalToLocal(newVec)
          vec3.normalize(newVecNorm, newVec);
					
          var angleBetefore = vec3.dot(newVec,toTargetLocal );
          var t = new LS.Transform();
          t._global_matrix = this._joints[i].transform.getGlobalMatrix();
          t._local_matrix = this._joints[i].transform.getLocalMatrix()
          
          
          var localAxis  = this._joints[i].transform._parent.globalToLocal(cross);
          vec3.normalize(localAxis,localAxis);
          
          t.setPosition(currentPosLocal[0], currentPosLocal[1], currentPosLocal[2]);
          

          t.rotation = this._joints[i].transform.rotation.clone();
          t._must_update= true;
          t.rotate(2*angleBetefore*RAD2DEG, localAxis, false);
          var pos = vec3.create();
          vec3.transformQuat(pos, newVecNorm,t.rotation);
          vec3.scaleAndAdd(pos, parentPosLocal,pos,this.lengths[i-1]);
          pos = this._joints[i].transform._parent.localToGlobal(pos)

          var r1 = vec3.distance(pos, parentPos);
					var l_factor = this.lengths[i-1]/r1;
					vec3.lerp(pos, parentPos, pos, l_factor);
          //vec3.lerp(pos, this._new_joints[i-1].position, pos,this.lengths[i-1]/l)

          
          var new_axis = vec3.create()
          vec3.normalize(new_axis,pos);
          var ChildVec = vec3.sub(vec3.create(),new_pos, pos);
        var ParentVec = vec3.sub(vec3.create(),parentPos, pos);
          vec3.normalize(ChildVec,ChildVec)
          vec3.normalize(ParentVec,ParentVec)
          var v = vec3.cross(vec3.create(),ParentVec,ChildVec);
          if(v[0]>0) this._new_joints[i].position = pos;
          //angle = vec3.angle(new_axis,newJointVec)*RAD2DEG;
         	

        }
        //If hinge has a Minimum angle
       /* if(angle<this._joints[i].constraint.angle)
        {
          new_pos = this._joints[i+1].transform.getGlobalPosition();
          //vec3.lerp(new_pos, this._new_joints[i].position, new_pos, l_factor);
          this._new_joints[i+1].position = new_pos.clone();
          //return;
        }*/
        
       /* break;
    }*/

		/* Find position fot the joint */
    /*var r = vec3.distance(this._new_joints[i+1].position, this._new_joints[i].position);
		var l_factor = this.lengths[i]/r;
		vec3.lerp(new_pos, this._new_joints[i].position, this._new_joints[i+1].position, l_factor);*/
		this._new_joints[i+1].position = new_pos.clone();
	}
}

IKChain.prototype.apply = function () 
{
	for(var i = 0; i < this._num_of_joints-1;i++) //- 1; i++)
	{
		//var parentRot = this._joints[i].parentNode.transform.getGlobalMatrix().clone();
		
    //Save and reset (for interpolate later) joint rotation	
		var rot = this._joints[i].transform._rotation.clone(); 
		this._joints[i].transform.resetRotation();
				
	//	var currentAxis = this._joints[i].transform.globalToLocal( this._new_joints[i+1].position );
		
    
    //-------------------DEBUG-------------------------
		var xaxis = this._new_joints[i].position.clone();
		var yaxis = this._new_joints[i].position.clone();
    var zaxis = this._new_joints[i].position.clone();
    
    if(i==0){
    	this._front0.set( this._new_joints[i].position );
    	this._up0.set( this._new_joints[i].position );
      this._right0.set( this._new_joints[i].position );
    }
    if(i==1){
    	this._front1.set( this._new_joints[i].position );
    	this._up1.set( this._new_joints[i].position );
      this._right1.set( this._new_joints[i].position );
    }
		//---------------------------------------------------
    
    //Set front, up and right axis to orient rotation
    var selectAxis = "Y";
   	var orientToAxis = null; 
    
		var dataZ = this.setOrientationAxis(this.front,"Z", i);
    zaxis = dataZ[0];
    if(dataZ[1]!="")
    {
      selectAxis = dataZ[1];
      orientToAxis = dataZ[2];
    }
    var dataY = this.setOrientationAxis(this.up,"Y", i);
    yaxis = dataY[0];
    if(dataY[1]!="")
    {
      selectAxis = dataY[1];
      orientToAxis = dataY[2];
    }
    var dataX = this.setOrientationAxis(this.right,"X", i);
    xaxis = dataX[0];
    if(dataX[1]!="")
    {
      selectAxis = dataX[1];
      orientToAxis = dataX[2];
    }
    
		var quaternion = quat.create();

    vec3.orientTo( quaternion, xaxis,yaxis,zaxis,orientToAxis, selectAxis);
		//Interpolate rotations
		//quat.slerp( quaternion, rot, quaternion,0.7 );
    this._joints[i].transform._rotation.set( quaternion );
		this._joints[i].transform._must_update = true;
	}
}
IKChain.prototype.setOrientationAxis = function(axis,name,i) 
{
  var selectAxis = "";
  var orientToAxis = null;
  var newAxis = this._new_joints[i].position.clone();
  
  switch(axis)
  {	
    case IKChain.POSX:
      newAxis[0] = newAxis[0]+ 10;
      break;
      
    case IKChain.NEGX:
      newAxis[0] = newAxis[0]- 10;
      break;
      
    case IKChain.POSZ:
      newAxis[2] = newAxis[2]+ 10;
      break;
      
    case IKChain.NEGZ:
      newAxis[2] = newAxis[2]- 10;
      break;
      
		// If this axis is the axis that follow the bone
    case IKChain.POSY:
      newAxis =  this._joints[i].transform.globalToLocal( this._new_joints[i+1].position );
			if(name=="X"){
        orientToAxis = LS.RIGHT.clone();
        if(i==0) this._right0.set( this._new_joints[i+1].position ,3 );
        if(i==1) this._right1.set( this._new_joints[i+1].position ,3 );
      }if(name=="Y"){
        orientToAxis = LS.TOP.clone();
        if(i==0) this._up0.set( this._new_joints[i+1].position ,3 );
        if(i==1) this._up1.set( this._new_joints[i+1].position ,3 );
      }if(name=="Z"){
        orientToAxis = LS.FRONT.clone();
        if(i==0) this._front1.set( this._new_joints[i+1].position ,3 );
        if(i==1) this._front1.set( this._new_joints[i+1].position ,3 );
  		}

      //vec3.negate(orientToAxis,orientToAxis)
      vec3.negate(newAxis,newAxis)
      selectAxis = name;
     
      break;
      
    case IKChain.NEGY:
      newAxis =  this._joints[i].transform.globalToLocal( this._new_joints[i+1].position );
      if(name=="X"){
        orientToAxis = LS.RIGHT.clone();
        if(i==0) this._right0.set( this._new_joints[i+1].position ,3 );
        if(i==1) this._right1.set( this._new_joints[i+1].position ,3 );
      }if(name=="Y"){
        orientToAxis = LS.TOP.clone();
        if(i==0) this._up0.set( this._new_joints[i+1].position ,3 );
        if(i==1) this._up1.set( this._new_joints[i+1].position ,3 );
      }if(name=="Z"){
        orientToAxis = LS.FRONT.clone();
        if(i==0) this._front1.set( this._new_joints[i+1].position ,3 );
        if(i==1) this._front1.set( this._new_joints[i+1].position ,3 );
  		}
      selectAxis = name;
      
      break;
  }
  //-------------------DEBUG--------------------
  if(selectAxis == ""){
    if(i==0){
      if(name == "X")
        this._right0.set( newAxis,3 );
      if(name == "Y")
        this._up0.set( newAxis,3 );
      if(name == "Z")
        this._front0.set( newAxis,3 );
    }
    if(i==1){
      if(name == "X")
        this._right1.set( newAxis,3 );
      if(name == "Y")
        this._up1.set( newAxis,3 );
      if(name == "Z")
        this._front1.set( newAxis,3 );
    }
   //-------------------------------------------------     
  	newAxis = this._joints[i].parentNode.transform.globalToLocal(newAxis);
  }
  return [newAxis,selectAxis,orientToAxis];
}

//OrientTo (get perpendicular vectors)
//Algorithm http://matthias-mueller-fischer.ch/publications/stablePolarDecomp.pdf
vec3.orientTo = (function(){ 
	
	var temp = mat3.create();

	return function( out, xaxis, yaxis, zaxis, fixed, select )
	{
		vec3.normalize(xaxis, xaxis);
		vec3.normalize(yaxis, yaxis)
		vec3.normalize(zaxis, zaxis);

		mat3.setColumn(temp, xaxis, 0 ); //x
		mat3.setColumn(temp, yaxis, 1 ); //y
		mat3.setColumn(temp, zaxis, 2 ); //z

		var first_quat = out || quat.create();
		//quat.fromMat3( first_quat, temp );
		quat.fromMat3AndQuat( first_quat, temp );
		//Reorient perpendicular vectors (get rotation respect Up vector)
		var new_up = vec3.create();
		if(fixed)
		{
			
			var axis = yaxis.clone();
			switch(select)
			{
				case "X":
					axis = xaxis.clone();
					break;
				case "Y":
					axis = yaxis.clone();
					break;
				case "Z":
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
})();

// EDITOR STUFF ******************************************************
IKChain["@inspector"] = function( component, inspector )
{
	inspector.widgets_per_row = 1;

	inspector.addCheckbox("Swap axis", component.swap, { callback: function(v) {
		component.swap = v;
	}});
  
  //--------------------AXIS---------------------------------
  inspector.widgets_per_row = 1;
  inspector.addCombo( "right", component.right, { values: IKChain["@right"].values, name_width: "50%", callback: function(v){
				component.right = v;
			}});
  inspector.addCombo( "up", component.up, { values: IKChain["@up"].values, name_width: "50%", callback: function(v){
				component.up = v;
			}});
  inspector.addCombo( "front", component.front, { values: IKChain["@front"].values, name_width: "50%", callback: function(v){
				component.front = v;
			}});
  
  //--------------------CHAIN--------------------------------
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

  var nodeEnd = "";
  if(!component._endEffector)
  	component._endEffector = LS.GlobalScene.selected_node;
  
  nodeEnd = component._endEffector;
  
	inspector.addNode("End effector", nodeEnd, {  callback: function(v){
			nodeEnd = v;
			component._endEffector = nodeEnd;
      component.nodes_uids[1] = component._endEffector._uid;
			//childrenNodes = v.getDescendants();
			//widgets_right.refresh();
		}});
  
  var nodeOrig = "";
  if(!component._originNode)
  	component._originNode = component._endEffector._parentNode;
  
 // nodeOrig = component._originNode;
  
  var widgetNode = inspector.addNode("Origin", component._originNode, { callback: function(v){
			//nodeOrig = v;
			component._originNode = v;
      component.nodes_uids[0] = component._originNode._uid;
    	component.setJoints()
			//childrenNodes = v.getDescendants();
			//widgets_right.refresh();
		}});
  
  if(component._originNode && component._endEffector && component._num_of_joints<2){
    component.setJoints();
  }
  inspector.widgets_per_row = 2;
  inspector.addNumber("Joints", component._num_of_joints, {step:1, precision:0, min:2, max:5, callback: function(v){

    component.setJoints(v);
    component._originNode = component._originNode
    inspector.refresh();
   	}});
	inspector.addButton(null,"Edit joints", { callback: function(v,e){
		IKChain.showPoseNodesDialog( component, e );
   	}});

  
  //----------------------------TARGET---------------------
	inspector.addSeparator();
  inspector.addTitle("Objective")
	inspector.widgets_per_row = 3;
	var target = null;
	if(component.target_uid)
	{
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
			delete component._joints;
			component._num_of_joints = 0;
			component._origin = null;
			component._target = null;
			component.target_uid = null;
			component.name = "";
		}
		inspector.refresh();
		LS.GlobalScene.requestFrame();
	});

	inspector.addSeparator();
	inspector.addCheckbox("Debug render", component.debug, function(v){ 
    component.debug = v; 
    LS.GlobalScene.requestFrame(); 
  });
}

IKChain.showPoseNodesDialog = function( component, event )
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
/*
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
		}*/
		widgets_right.widgets_per_row = 2;
		widgets_right.addSeparator();
		widgets_right.addTitle("Joint type");
		var types = {};
		var angles = [];

		for(var i = 0; i < IKChain.joint_constraints.length; i++)
		{
			var v = IKChain.joint_constraints[i];
			types[v.name] = v.type;
			angles.push(v.angle );
		}
		for(var i = 0; i< component._joints.length; i++)
		{
			widgets_right.addCombo( component._joints[i].name, component.constraints[i].type, { id:i, values: types, name_width: "50%", callback: function(v){
				var id = this.options.id;
				component._joints[id].constraint.type = v;
				component.constraints[id].type = v;
				widgets_right.refresh();
			}});

			widgets_right.addNumber("Angle", component.constraints[i].angle, {id:i, values: angles, callback: function(v){
				var id = this.options.id;
				component._joints[id].constraint.angle = v;
				component.constraints[id].angle = v;
				widgets_right.refresh();
			}});
		}

		/*widgets_right.addButton(null,"Apply", function(v){
			if(!nodeEnd)
			return;
			dialog.close();
		});*/

	}

	return dialog;
}

LS.registerComponent( IKChain );