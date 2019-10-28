//@FaceFinder
//global scripts can have any kind of code.
//They are used to define new classes (like materials and components) that are used in the scene.
FaceFinder._brfv4 = null;
function FaceFinder(){

  this.color = "#323";
	this.bgcolor = "#535";
 //Inputs
  this.addInput("frame","image");
  
  // Outputs
	this.addOutput("faces","array");
 
  this.addProperty("maxFaces", 1);
  this.addProperty("mode", "TRACKING");
  
  this.ws   = {};
  this.ws.width = 640;
  this.ws.height = 480;
  

	this.ws.viewer = {};
	this.ws.viewer.color_G = 'rgba(0, 255, 0, 1)';
	this.ws.viewer.color_Y = 'rgba(255, 255, 0, 1)';
	this.ws.scale  = 0.5;

  this._faces = [];
  this.landmarks = {};
  this.pose = {};
  this.landmarks3D = [];
	
  //brfv4BaseURL = "fileserver/files//evalls/projects/testbrfv4/data/";
  brfv4BaseURL = "../evalls/projects/testbrfv4/data/";
  //this._brfv4	= null;
  this._brfManager		=  null;
  this.resolution		=  null;    
	this.state = "init";
  this._start_tracking = false;
  
  //Canvas
  this._dummyCanvas = document.createElement("canvas");//imageData
  this._dummyCanvas.id = "dummy";
  this._dummyCanvas.width = this.ws.width///this.ws.scale;
  this._dummyCanvas.height = this.ws.height///this.ws.scale;
  this._dummyCanvas.ctx = this._dummyCanvas.getContext('2d');
  this._viewerCanvas = document.createElement("canvas"); //visible canvas
  this._viewerCanvas.id = "viewer";//imageDataCTX
  this._viewerCanvas.width = this.ws.width;
  this._viewerCanvas.height = this.ws.height;
  this._viewerCanvas.ctx = this._viewerCanvas.getContext('2d');
  
  this.onResizeImage();
 	this._waiting_worker = false;
	this._start_app = false;

  
}

FaceFinder.prototype.onGetOutputs = function()
{
  return [["img", "image"], ["counter", "number"]];
}
//LS.RM.load("/evalls/projects/testbrfv4/data/brfv4_js_tk101018_v4.1.0_trial.js",{async: true},function(){waiting_worker = true;})
FaceFinder.prototype.onResizeImage = function () {
		
  var ww =300;
  var wh = 250;
  var s = wh /  this._dummyCanvas.height;
  if ( this._dummyCanvas.width * s < ww) {
    s = ww /  this._dummyCanvas.width;
  }
  var iw =  this._dummyCanvas.width * s;
  var ih =  this._dummyCanvas.height * s;
  var ix = (ww - iw) * 0.5;
  var iy = (wh - ih) * 0.5;

  this._dummyCanvas.style.transformOrigin = "0% 0%";
  this._dummyCanvas.style.transform = "matrix("+s+", 0, 0, "+s+", "+ix+", "+iy+")";
}
FaceFinder.prototype.onAdded = function( graph )
{
  
  var support	= (typeof WebAssembly === 'object');
  if(support) {
    // from https://github.com/brion/min-wasm-fail/blob/master/min-wasm-fail.js
    function testSafariWebAssemblyBug() {
      var bin = new Uint8Array([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,3,2,1,0,5,3,1,0,1,7,8,1,4,116,101,115,116,0,0,10,16,1,14,0,32,0,65,1,54,2,0,32,0,40,2,0,11]);
      var mod = new WebAssembly.Module(bin);
      var inst = new WebAssembly.Instance(mod, {});
      // test storing to and loading from a non-zero location via a parameter.
      // Safari on iOS 11.2.5 returns 0 unexpectedly at non-zero locations
      return (inst.exports.test(4) !== 0);
    }
    if (!testSafariWebAssemblyBug()) {
      support = false;
    }
  }
  if (!support) { brfv4BaseURL = "evalls/projects/testbrfv4/data/"; }
  console.log("Checking support of WebAssembly: " + support + " " + (support ? "loading WASM (not ASM)." : "loading ASM (not WASM)."));
  
	LEvent.bind( LS.GlobalScene, "renderGUI", this.onRenderGUI, this );
}

FaceFinder.prototype.onRemoved = function( graph )
{
	LEvent.unbind( LS.GlobalScene, "renderGUI", this.onRenderGUI, this );
}

FaceFinder.prototype.onRenderGUI = function( render_settings )
{
	var canvasW = gl.viewport_data[2];
  var canvasH = gl.viewport_data[3];
  if( !this._video || !this._video.videoWidth )
    return;

  if(!this._video_texture ||
     this._video_texture.width != this._video.videoWidth ||  
     this._video_texture.height != this._video.videoHeight )
  {
    
    this._video_texture = new GL.Texture( this._video.videoWidth, this._video.videoHeight, {minFilter:gl.LINEAR, magFilter: gl.LINEAR});
  }
  if(!this._landmarks_texture)
  {
    
    this._landmarks_texture = new GL.Texture( this._viewerCanvas.width, this._viewerCanvas.height, {});

  }
  
  if (this._video && this._video.readyState === this._video.HAVE_ENOUGH_DATA&&this._start_app) 
  {
    var ctx = this._viewerCanvas.ctx;
    ctx.clearRect(0, 0, this._viewerCanvas.width, this._viewerCanvas.height);

    if(this.properties.mode=="TRACKING"&& this._faces)
    {

      for(var i = 0; i<this._faces.length; i++)
      {

        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.ws.viewer.color_Y;
        ctx.save();
        //ctx.scale(1/this.ws.scale,1/this.ws.scale);
        ctx.beginPath();
        var face = this._faces[i];
        if(face.state == FaceFinder._brfv4.BRFState.FACE_DETECTION)
          continue;
        for (let i=0; i <  face.points.length-52; i++) {

          let current = face.points[i];
          let next    = face.points[i+1]
          //ctx.moveTo((current.x)*this.ws.scale,(current.y)*this.ws.scale);
          //ctx.lineTo((next.x)*this.ws.scale,(next.y)*this.ws.scale);
          ctx.moveTo((current.x),(current.y));
          ctx.lineTo((next.x),(next.y));
        }

        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = this.ws.viewer.color_G;

        for (let i=17; i< face.points.length; i++) {

          coord = face.points[i];
          //ctx.strokeRect((coord.x)*this.ws.scale,(coord.y)*this.ws.scale,1,1);
          ctx.strokeRect((coord.x),(coord.y),1,1);
        }

        ctx.restore();
      }
    }

    if(this.properties.mode=="DETECTION"&& this._faces)
    {
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.ws.viewer.color_Y;
      ctx.stroke();
      ctx.beginPath();
      for(var i = 0; i<this._faces.length; i++)
      {

        var rect = this._faces[i].refRect;

        ctx.rect(rect.x,rect.y,rect.width,rect.height)

      }
      ctx.closePath();

    }
  }
	if(FaceFinder._brfv4.sdkReady)
  	this._start_tracking = true;
}


FaceFinder.prototype.onExecute = function()
{
  this._video = this.getInputData(0);

   if(FaceFinder._brfv4 === null) {
      FaceFinder._brfv4 = { locateFile: function(fileName) { return brfv4BaseURL+fileName; } };  
      initializeBRF(FaceFinder._brfv4);
    }
    if(FaceFinder._brfv4.sdkReady&&!this._waiting_worker) {
      this._waiting_worker = true
      this.initSDK();
    }
	if(this._start_tracking)
    this.trackFaces();
	
  if(this.outputs)
    for(var i=0;i<this.outputs.length;i++)
      if(this.outputs[i].name == "img")
        this.setOutputData(i, this._viewerCanvas );
 		 else if(this.outputs[i].name == "counter"&&this._faces !=null)
   			this.setOutputData(i,this._faces.length);
}


FaceFinder.prototype.initSDK = function() {

  this.resolution	= new FaceFinder._brfv4.Rectangle(0, 0,this._dummyCanvas.width,  this._dummyCanvas.height);
  this._brfManager	= new FaceFinder._brfv4.BRFManager();
  var size = this.resolution.height;
  if(this.resolution.height > this.resolution.width) {
    size = this.resolution.width;
  }
  
  
  // this._dummyCanvas.ctx.drawImage(this._video, 0, 0, resolution.width, resolution.height);
 
 
  
  switch(this.properties.mode){
    case "DETECTION":
      this._brfManager.setMode(FaceFinder._brfv4.BRFMode.FACE_DETECTION)//brfv4.BRFMode.FACE_TRACKING);
      this._brfManager.init(this.resolution, this.resolution, "com.tastenkunst.brfv4.js.examples.minimal.webcam");
      this._brfManager.setNumFacesToTrack(this.properties.maxFaces);
 			this._brfManager.setFaceDetectionRoi(this.resolution);
  		this._brfManager.setFaceDetectionParams(		size * 0.30, size * 1.00, 12, 8);
  
      break;
    
    case "TRACKING":
      this._brfManager.setMode(FaceFinder._brfv4.BRFMode.FACE_TRACKING);
      this._brfManager.init(this.resolution, this.resolution, "com.tastenkunst.brfv4.js.examples.minimal.webcam");
      this._brfManager.setNumFacesToTrack(this.properties.maxFaces);
      this._brfManager.setFaceTrackingStartParams(	size * 0.30, size * 1.00, 22, 26, 22);
  		this._brfManager.setFaceTrackingResetParams(	size * 0.25, size * 1.00, 40, 55, 32);
      
      break;
  }

// this._brfManager.setNumFacesToTrack(this.properties.maxFaces);
  
  
  //var image = this._dummyCanvas.ctx.getImageData(0, 0, resolution.width, resolution.height).data.buffer;
 // brfv4.HEAPU8.set(image)
 
  //this.trackFaces();
   this._start_tracking = true;
  
  
}
FaceFinder.prototype.trackFaces = function() {
  
  if(!this._video)
    return;
 
  this._dummyCanvas.ctx.drawImage(this._video, 0, 0, this.resolution.width, this.resolution.height);
  
 // imageDataCtx.setTransform(-1.0, 0, 0, 1, resolution.width, 0); // mirrored for draw of video
  //imageDataCtx.drawImage(webcam, 0, 0, resolution.width, resolution.height);
  //imageDataCtx.setTransform( 1.0, 0, 0, 1, 0, 0); // unmirrored for draw of results
  this._brfManager.update(this._dummyCanvas.ctx.getImageData(0, 0,this.resolution.width, this.resolution.height).data);

  var faces = this._brfManager.getFaces();
	this._faces= faces;
  for(var i = 0; i < faces.length; i++) {
    var face = faces[i];
		this._start_app = true;
    if(		face.state === FaceFinder._brfv4.BRFState.FACE_TRACKING_START ||
       face.state === FaceFinder._brfv4.BRFState.FACE_TRACKING) {
      this._start_app = true;
      var landmarks = face.points;
      this.pose.yaw = - face.rotationY ;
      this.pose.pitch = face.rotationX;
      this.pose.roll = - face.rotationZ;
      
      for(var i=0; i< landmarks.length; i++) {
        var coord = landmarks[i];
        var landmark = {};
        landmark.x = coord.x; 
        landmark.y = coord.y;
        landmark.z = 0;
        landmarks[i] = landmark;
      }
      face.points = landmarks;
     // this.setOutputData(0, this.landmarks3D);
     // this.setOutputData(1,this.pose);
     
    } 
    //this._faces = faces;
    //this.state = face.state;
    
  }
	this.setOutputData(0,this._faces);
 
  this._start_tracking = false;

}


FaceFinder.prototype.onStop = function(){
	this._video = null;
  delete this._brfManager;

 this._waiting_worker = false;
}

LiteGraph.registerNodeType("features/FaceProcessing", FaceFinder );
  