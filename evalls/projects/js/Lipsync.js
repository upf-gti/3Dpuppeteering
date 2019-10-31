// --------------------- LIPSYNC MODULE --------------------

EnergyBased.prototype.refFBins = [0, 500, 700,3000, 6000];


// Constructor
function Lipsync() {
	this.BSW = [0,0,0]; //kiss,lipsClosed,jaw
  this.properties = {threshold: 0.5, 
                     dynamics: 30, 
                     maxDB: -30, 
                     smoothness: 0.6, 
                     pitch: 1, 
                     fftSize: 1024,
                     showSpectrum: false};
	this.addProperty( "method", "energy based", "enum", { values: ["energy based", "MFCC"] } );
	this.audioContext =  LGAudio.getAudioContext();
	this.sourceNode = this.audioContext.createBufferSource()
	this.audionode = this.audioContext.createAnalyser();
	this.audionode.graphnode = this;
  this.sourceNode.connect(this.audioContext.destination);
        this.sourceNode.connect(this.audionode);
	this.audionode.fftSize = this.properties.fftSize;
	this.audionode.maxDecibels = this.properties.maxDB;
	this.audionode.smoothingTimeConstant = this.properties.smoothness;
  
  //Inputs
  this.addInput("in","audio");
  this.addInput("source","*");
  // Outputs
	this.addOutput("weightKiss","number");
  this.addOutput("weightClosed","number");
  this.addOutput("weightJaw","number");

}
Lipsync.prototype.onStart = function()
{

  //this.defineFBins(this.properties["pitch"]);
  
}

Lipsync.prototype.onExecute = function()
{
  var source = this.getInputData(1)
  if(source&&source.buffer){
    this.sourceNode = this.audioContext.createBufferSource();
  	this.sourceNode.buffer = source.buffer
    this.sourceNode.connect(this.audioContext.destination);
        this.sourceNode.connect(this.audionode);
  }
    
  switch(this.properties.method){
    case "energy based":
      this.lipsync = new EnergyBased(this.properties);
      this.lipsync.defineFBins(this.properties.pitch);
      break;
    case "MFCC":
      this.lipsync = new MFCC(this.audionode);
      this.lipsync.init(LGAudio.getAudioContext().sampleRate);
      break;
  }
 //ENERGY BASED
  if(this.properties.method == "energy based"){
    // Short-term power spectrum
    var sampleRate = LGAudio.getAudioContext().sampleRate;
    console.log("sample rate", sampleRate )
    var bufferLength = this.audionode.frequencyBinCount;
    if( !this.lipsync.data || this.lipsync.data.length != bufferLength )
      this.lipsync.data = new Float32Array( bufferLength );
    this.audionode.getFloatFrequencyData(this.lipsync.data);
    
    var timeDomain = new Float32Array(this.properties.fftSize);
    this.audionode.getFloatTimeDomainData( timeDomain )
    var pitch = this.autoCorrelate(timeDomain, sampleRate); 
    if(pitch>-1) console.log("pitch", pitch)
    //if(pitch<=250&&pitch>=195){
    	// Analyze energies
    	this.lipsync.binAnalysis(this.audionode);
    	// Calculate lipsync blenshape weights
    	this.lipsync.lipAnalysis();
    //}
  
    
    this.BSW[0] = this.lipsync.BSW[0];
    this.BSW[1] = this.lipsync.BSW[1]; 
    this.BSW[2] = this.lipsync.BSW[2];
  }
  
  
  //MFCC
  	// Extract MFCCs
  if(this.properties.method == "MFCC"){
    this.lipsync.computeMFCCs();
    var mfcc = this.lipsync.mfcc;
    var kiss = ((mfcc[2]-mfcc[3]) + (mfcc[3]-mfcc[4]))/15;
    this.BSW[0] = Math.max(0,kiss);
    this.BSW[1] = Math.max(0, kiss/5); 
    this.BSW[2] = Math.abs(mfcc[0])/10;
  }
  
  this.setOutputData(0, this.BSW[0]);
  this.setOutputData(1, this.BSW[1]);
  this.setOutputData(2, this.BSW[2]);
  //if(this.properties.showSpectrum) this.showSpectrum();
}
/*Lipsync.prototype.onPropertyChanged = function(){
	if(this.properties.showSpectrum) this.showSpectrum();
}*/

Lipsync.prototype.onDrawForeground = function(){
  if(this.properties.showSpectrum){
    if(this.properties.method == "MFCC")
      this.lipsync.drawSignal();
    else if(this.properties.method == "energy based"){
      var data = this.lipsync.data;
      if (data === undefined)
        return;

      width = gl.viewport_data[2];
      height = gl.viewport_data[3];

      gl.start2D();

      var factor = 20;
      var vecFactor = 5;

      // ----------- SIGNAL -----------
      gl.translate(50,100 + 10*factor/2);

      // Draw axis
      gl.strokeStyle = "rgba(255,255,255,0.6)";
      gl.beginPath(); gl.moveTo(0, factor*vecFactor*0.5); gl.lineTo(0,-factor*vecFactor);gl.stroke();
      gl.beginPath(); gl.moveTo(0, 0); gl.lineTo(data.length*factor*0.1,0);gl.stroke();

      var maxDB = this.properties.maxDB;
      var dynamicRange = this.properties.dynamics;
      var threshold = this.properties.threshold;

      // Draw previous signal
      gl.beginPath();
      gl.moveTo(0,0);
      for (var i = 0; i<data.length; i++){
        // final signal
        var val = 0.5+(data[i]+20)/140;
        gl.lineTo(i*factor*0.1, -val*factor*vecFactor);
      }
      gl.strokeStyle = "rgba(255,0,255,0.9)";
      gl.stroke()

      // Draw power spectrum normalized
      gl.beginPath();
      gl.moveTo(0,0);
      for (var i = 0; i<data.length; i++){
        // This is non-sense? data is already power spectrogram?
       // var pSpec = (data[i]-0.5)*140-20;
        pSpec = Math.pow(10, data[i]/10);
        pSpec = 10*Math.log10(pSpec + 1E-6);
        // final signal
        var val = (pSpec - maxDB)/dynamicRange + 1 - threshold;
        gl.lineTo(i*factor*0.1, -val*factor*vecFactor);
      }
      gl.strokeStyle = "rgba(0,255,255,0.9)";
      gl.stroke();

      // Draw threshold
      gl.beginPath(); gl.moveTo(0, threshold*factor*vecFactor); 
      gl.lineTo(data.length*factor*0.1, threshold*factor*vecFactor);
      gl.strokeStyle = "rgba(255,63,63,0.5)";gl.stroke();


      var nfft = this.audionode.frequencyBinCount;// LS.Globals.lipsyncModule.analyser.frequencyBinCount;
      var fs = LGAudio.getAudioContext().sampleRate//LS.Globals.lipsyncModule.context.sampleRate;
      var fBins = this.lipsync.fBins;
      var energy = this.lipsync.energy;

      // Bins division
      for (var binInd = 1; binInd < fBins.length; binInd++){
        // Start and end of bin
        var indxIn = Math.round(fBins[binInd]*nfft/(fs/2));
        // Line
        gl.beginPath();
        gl.moveTo(indxIn*factor*0.1, -vecFactor*factor);
        gl.lineTo(indxIn*factor*0.1, 0);
        gl.strokeStyle = "rgba(255,127,127,0.6)";
        gl.stroke();
      }


      // Energy
      gl.translate(0, 0.5*factor*vecFactor + 50);
      // Draw axis
      gl.beginPath();
      gl.strokeStyle = "rgba(255,255,255,0.9)";
      gl.moveTo(0,-30); gl.lineTo(0,0); gl.lineTo(50,0);
      gl.stroke();
      // Draw energy bars
      gl.fillStyle = "rgba(255,255,255,0.8)";
      gl.fillRect(5,0,10, - energy[0]*50);
      gl.fillRect(20,0,10, - energy[1]*50);
      gl.fillRect(35,0,10, - energy[2]*50);
      // Text
      gl.font = "15px Arial";
      gl.fillStyle = "rgba(255,255,255,0.8)";
      gl.fillText("Energies", 0, 20);
      gl.translate(0, -0.5*factor*vecFactor - 50);


      // Blend shape weights
      var bsw = this.BSW;
      gl.translate(0, 0.5*factor*vecFactor + 120);
      // Draw axis
      gl.beginPath();
      gl.moveTo(0,-30); gl.lineTo(0,0); gl.lineTo(50,0);
      gl.stroke();
      // Draw energy bars
      gl.fillRect(5,0,10, - bsw[0]*30);
      gl.fillRect(20,0,10, - bsw[1]*50);
      gl.fillRect(35,0,10, - bsw[2]*50);
      // Text
      gl.font = "15px Arial";
      gl.fillText("Blendshapes", 0, 20);
      gl.translate(0, -0.5*factor*vecFactor - 120);



      gl.translate(-50,-100 - 10*factor/2);
    }
	}
}

LiteGraph.registerNodeType("features/AudioPuppeteering", Lipsync );

Lipsync.prototype.autoCorrelate = function( buf, sampleRate ) {
	var SIZE = buf.length;
	var MAX_SAMPLES = Math.floor(SIZE/2);
	var best_offset = -1;
	var best_correlation = 0;
	var rms = 0;
	var foundGoodCorrelation = false;
	var correlations = new Array(MAX_SAMPLES);

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var lastCorrelation=1;
	for (var offset = 0; offset < MAX_SAMPLES; offset++) {
		var correlation = 0;

		for (var i=0; i<MAX_SAMPLES; i++) {
			correlation += Math.abs((buf[i])-(buf[i+offset]));
		}
		correlation = 1 - (correlation/MAX_SAMPLES);
		correlations[offset] = correlation; // store it, for the tweaking we need to do below.
		if ((correlation>0.9) && (correlation > lastCorrelation)) {
			foundGoodCorrelation = true;
			if (correlation > best_correlation) {
				best_correlation = correlation;
				best_offset = offset;
			}
		} else if (foundGoodCorrelation) {
			// short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
			// Now we need to tweak the offset - by interpolating between the values to the left and right of the
			// best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
			// we need to do a curve fit on correlations[] around best_offset in order to better determine precise
			// (anti-aliased) offset.

			// we know best_offset >=1, 
			// since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
			// we can't drop into this clause until the following pass (else if).
			var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];  
			return sampleRate/(best_offset+(8*shift));
		}
		lastCorrelation = correlation;
	}
	if (best_correlation > 0.01) {
		// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
		return sampleRate/best_offset;
	}
	return -1;
//	var best_frequency = sampleRate/best_offset;
}
//-------------------------------ENERGY BASED
console.log("hoola")
function EnergyBased(properties){
	this.energy = [0,0,0,0,0,0,0,0];
  this.BSW = [0,0,0]; //kiss,lipsClosed,jaw
  // Change freq bins according to pitch
  this.fBins = [];
  this.maxDB = properties.maxDB;
  this.dynamics = properties.dynamics;
  this.threshold = properties.threshold;
  
}
// Define fBins
EnergyBased.prototype.defineFBins = function(pitch){
  for (var i = 0; i<this.refFBins.length; i++)
      this.fBins[i] = this.refFBins[i] * pitch;
}


// Analyze energies
EnergyBased.prototype.binAnalysis = function(audionode){
  
  // Signal properties

  var nfft = audionode.frequencyBinCount;
  var fs = LGAudio.getAudioContext().sampleRate;
 /* var nfft = this.data.length;//this.analyser.frequencyBinCount;
  var fs = LGAudio.getAudioContext().sampleRate;//this.sampleRate; //???*/
  var fBins = this.fBins;
  var energy = this.energy;

  // Energy of bins
  for (var binInd = 0; binInd < fBins.length-1; binInd++){
    // Start and end of bin
    var indxIn = Math.round(fBins[binInd]*nfft/(fs/2));
    var indxEnd = Math.round(fBins[binInd+1]*nfft/(fs/2));

    // Sum of freq values
    energy[binInd] = 0;
    for (var i = indxIn; i<indxEnd; i++){
			// Power Spectogram
      //var value = Math.pow(10, this.data[i]/10);
      // Previous approach
      var value = this.threshold+(this.data[i]+20)/140;
      //var value = this.data[i];///!!!!!!!!!!!!!!!!
      if (value < 0) value = 0;
      energy[binInd] += value;
    }
    // Divide by number of sumples
    energy[binInd] /= (indxEnd-indxIn);
    // Logarithmic scale
    //energy[binInd] = 10*Math.log10(energy[binInd] + 1E-6);
    // Dynamic scaling
    //energy[binInd] = ( energy[binInd] - this.maxDB)/this.dynamics + 1 - this.threshold;
  }
}

// Calculate lipsyncBSW
EnergyBased.prototype.lipAnalysis = function(){
  
  var energy = this.energy;

  if (energy !== undefined){
    var value = 0;
    

    // Kiss blend shape
    // When there is energy in the 1 and 2 bin, blend shape is 0
    value = (0.5 - (energy[2]))*2;
    if (energy[1]<0.2)
      value = value*(energy[1]*5)
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.BSW[0] = value;

    // Lips closed blend shape
    value = energy[3]*3;
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.BSW[1] = value;
    
    // Jaw blend shape
    value = 0.8*(energy[1] - energy[3]);
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.BSW[2] = value;
    /*
    // Debug
    // outstr
    var timestamp = LS.GlobalScene.time -  this.timeStart;
    this.outstr+= timestamp.toFixed(4) + "," +
      						energy[0].toFixed(4) + "," + 
      						energy[1].toFixed(4) + "," + 
      						energy[2].toFixed(4) + "," +
      						energy[3].toFixed(4) + "," +
      						this.BSW[0].toFixed(4) + "," + 
            			this.BSW[1].toFixed(4) + "," + 
      						this.BSW[2].toFixed(4) + "\n";
*/
  }

}



//--------------------------------MFCC
function MFCC(analyser){
	//MFCC
  var opt ={};
  this.analyser = analyser;
	this.analyser.fftSize = this.fftSize=  256;
  // MFCCs banks
  this.filterBanks = [];
  this.filteredEnergies = [];
  
  // Pre-emphasis filter (freq domain)
  this.h = [];
  // DCT
  this.dct = [];
  // Cep lifter
  this.cepWin = [];
  
  // MFCC results
  this.logFiltE = [];
  this.cepstralCoeff = [];
  this.mfcc = [0,0,0,0];
  this.MFCC_E_D_N_Z = [];
  
  // Delta
  this.prevMFCC = [];
  this.deltaCoeff = [];
  
  // MFCC parameters
  this.numFilters = this.nFilt = 24; // Julius 24
  this.mfccDim =  12;
  this.lowFreq = 0; // Julius disables hiPass and loPass, max-min freqs? Sampling rate?
  this.highFreq = 8000; // mHi is 8000kHz in Julius
  this.preEmph = 0.97;

  this.lifter = 22;
  this.deltaWin = 2; // Delta window
  this.visualizationMFCC = 10;
  
  // Signal processing parameters
  this.smpFreq = 16000;
  this.smpPeriod = 625;
  this.frameSize = 400;
  this.fShift = 160;

  // CMN - Cepstral Mean Normalization
  this.cmn = null;
  // CMN
  this.cmn = new CMN (this.mfccDim);
  // LOGS
  this.mag = [];
  this.fbe = [];
  this.cc = [];
  this.mfccLog = [];
  this.timestamp = [];
  
  this.max = -1000000;
  this.min = 1000000;
}

// Init
MFCC.prototype.init = function(fs){
  this.fs = fs || 44100;
  
  // Define fft size according to MFCC options
  var fftSecs = this.frameSize / this.smpFreq;
  var fftSamples = fftSecs * this.fs;
  // Find closer fftSize that's power of two
  var fftSize = 256;
  
  // fftSize has to be always bigger than fftSamples (Matlab)
  var diff = fftSize - fftSamples;
  while (diff < 0 && fftSize <= 32768){
  	fftSize *= 2;
    diff = fftSize - fftSamples;
  }

  this.analyser.fftSize = this.fftSize = fftSize;
  
  console.log("FFT size:", fftSize);
  
  // FFT buffer
  this.data = new Float32Array(this.analyser.frequencyBinCount);
  this.powerSpec = new Float32Array(this.analyser.frequencyBinCount);
  // Waveform
  this.wave = new Float32Array(this.analyser.fftSize);
  
  
  // Create filter banks
  this.createFilterBanks();
  // Create DCT matrix
  this.createDCT();
  // Create ceplifter
  this.createLifter();
  
  // Previous coeff initialization
  for (var i = 0; i<(this.deltaWin*2+1) + this.visualizationMFCC; i++){
    this.prevMFCC[i] = [];
    for (var j = 0; j<this.mfccDim+1; j++)
      this.prevMFCC[i][j] = -1;
  }

}

MFCC.prototype.computeMFCCs = function(){
  
  // Signal treatement (not done)
  // · Preemphasize -> wave[i] -= wave[i - 1] * preEmph;
  // Preemphize done in frequency domain
  // · if "-ssload", load noise spectrum for spectral subtraction from file
  
  // FFT and wave data
	this.analyser.getFloatFrequencyData(this.data);
  this.analyser.getFloatTimeDomainData(this.wave);
  
  // FFT not computed yet
  if ((this.data[0]) === -Infinity) 
    return;
  
  // Signal properties
  var nfft = this.analyser.frequencyBinCount;
  var fftSize = this.analyser.fftSize;
  var fs = this.fs;//context.sampleRate;
  var nFilt = this.filterBanks.length;// this.numFilters

  // Calculate Log Raw Energy (before preemphasize and windowing in HTK default)
  var energy2 = 0;
  for (var i = 0; i<fftSize; i++)
    energy2 += this.wave[i] * this.wave[i];
  var energy = Math.log(energy2);
  
  //if (energy>0)
  //	console.log("ENERGY--> ", energy);
  
  this.mfcc = [];
  
  // Apply filters
  var filteredEnergies = this.filteredEnergies;
  var logFiltE = this.logFiltE;
  // Filter the signal and get filter coefficients
  for (var i = 0; i<nFilt; i++){
    filteredEnergies[i] = 0;
    for (var j = 0; j<nfft; j++){ // this.filterBanks[i].length = nfft
      var invLog = Math.pow(10, this.data[j]/20); // Remove last step (20*log10(data))
      invLog *= fftSize; // Remove division 1/N
      invLog *= 1/1.0 // Matlab fft compensation? 1/1.5?
      invLog = (Math.abs(invLog)); // Magnitude spectrum Matlab
      //invLog *= Math.pow(2,15);//? Similar values to Matlab? MAG
      // Pre-emphasis filter
      invLog *= this.h[j];
      // Magnitude
      this.powerSpec[j] = invLog;
      filteredEnergies[i] += this.filterBanks[i][j] *  invLog;
      
      if (this.max < invLog)this.max = invLog;
      if (this.min > invLog) this.min = invLog;
      
    }

    // Log
    if (filteredEnergies[i]<1 ) filteredEnergies[i] = 1;
    logFiltE[i] = Math.log(filteredEnergies[i]);
    
  }

  var cepCoeff = this.cepstralCoeff;
  var mfccDim = this.mfccDim;
  var sqrt2var = Math.sqrt(2.0/nFilt);
  // DCT of the coefficients
  for (var i = 0; i<mfccDim; i++){
    cepCoeff[i] = 0;
    for (var j = 0; j<nFilt; j++){ // fbank dim
      cepCoeff[i] += logFiltE[j] * this.dct[i][j];
    }
  }
  
  
  var lifter = this.lifter;
  var mfcc = this.mfcc;
  // Weight cepstrums
  for (var i = 0; i < mfccDim; i++){
    mfcc[i] = cepCoeff[i] * this.cepWin[i];
  }
  
  mfcc[mfccDim] = energy; // 13 numbers (12 mfcc + energy)
 
  
  // Compute delta coefficients
  var deltaCoeff = this.deltaCoeff;
  var prevMFCC = this.prevMFCC;
  var divisor = 0;
  for (var n = 1; n <= this.deltaWin; n++) divisor += n * n;
  divisor *= 2;
  
  
  // LOGS
  if (!this.startTime)
    this.startTime = LGAudio.getAudioContext().currentTime;//LS.Globals.AContext.currentTime;

  //var currentTime = LS.Globals.AContext.currentTime - this.startTime;
  var currentTime = LGAudio.getAudioContext().currentTime - this.startTime;
  if (currentTime < 2.6525){ // HARDCODED
    
    this.timestamp.push(currentTime);
    this.mag.push([]);
    this.fbe.push([]);
    this.cc.push([]);
    this.mfccLog.push([]);

    // CEPSTRAL COEFFICIENTS
    // MFCC COEFFICIENTS
    for (var i = 0; i<mfccDim; i++){
      this.cc[this.cc.length-1][i] = cepCoeff[i];
      this.mfccLog[this.mfccLog.length-1][i] = mfcc[i];
    }

    // POWER SPECT
    for (var i = 0; i<nfft; i++){
      this.mag[this.mag.length-1][i] = this.powerSpec[i];
    }
    // FBE
    for (var i = 0; i< nFilt; i++)
      this.fbe[this.fbe.length-1][i] = filteredEnergies[i];
    
  } else{
  	this.ended = true;
  }
    
  // Delta coefficients
  // Should compare the next and the past frame. As the next is not available in real-time,
  // the current mfcc is used.
  for (var i = 0; i<mfccDim+1; i++){
    var sum = 0;
    for (var n = 1; n <= this.deltaWin; n++){
      // Indices
      var nextIdx = this.deltaWin - n;
      var pastIdx = this.deltaWin + n;
    	// First iterations
      if (prevMFCC[nextIdx][i] == -1)
        prevMFCC[nextIdx][i] = mfcc[i];
      if (prevMFCC[pastIdx][i] == -1)
        prevMFCC[pastIdx][i] = mfcc[i];
      
      
      // Compute delta coefficients
      // From the book it should be something like [b] [a] [current] [i] [j] -> (i-a) + (j-b)
      // But: the mfcc calculation rate is not the same in each app (at least in our case as we don't
      // calculate them in a regular timestamp)
      // Then: the temporal relation between previous mfcc will not be the same as trained. Is it still
      // worth it?
      // In Julius the next frame is solved like:
      // p = currentFrame + theta; -> theta being 1 or 2 (n)
      sum += n*(prevMFCC[nextIdx][i] - prevMFCC[pastIdx][i]);       
  	}
    deltaCoeff[i] = sum / divisor;
    mfcc[i + mfccDim + 1] = deltaCoeff[i]; // 26 dimensions
  }
  
  // Assign to prevMFCC (should this values be normalized CMN? I don't think so)
  for (var i = 0; i<mfccDim+1; i++){
    // Move to the right
    var prevMFCCLength = (this.deltaWin*2+1) + this.visualizationMFCC;
    for (var j = 1; j< prevMFCCLength; j++) // Store more for visualization
      prevMFCC[prevMFCCLength-j][i] = prevMFCC[prevMFCCLength-j-1][i];
    // Store current result
    prevMFCC[0][i] = mfcc[i];
  }
  
  

	// Maybe?
  //#ifdef POWER_REJECT ?

  // Remove ENERGY from mfcc array
  mfcc.splice(12, 1);
  // MFCC is now MFCC(12) + DELTA_MFCC(12) + DELTA_ENERGY(1)
  
  
  // Cepstral Mean Normalization (CMN)
  mfcc = this.cmn.realtime(mfcc);
  // Update
  this.cmn.update();
  
}

// Create filter banks
MFCC.prototype.freq2mel = function(f){return 1127 * Math.log(1+f/700);}
MFCC.prototype.mel2freq = function(m){return 700*(Math.exp(m/1127) - 1);}

// Create filter banks Matlab implementation
MFCC.prototype.createFilterBanks = function(){
  
  // Half of the fft size
  var K = this.analyser.frequencyBinCount+1;
  var fftSize = this.fftSize;
  // Sampling frequency
  var fs = this.fs;
  // Filters
  var M = this.numFilters;
  var lowFreq = this.lowFreq;
  var highFreq = this.highFreq;
  var fMin = 0;
  var fMax = 0.5 * fs;

  // PRE EMPHASIS FILTER
  // Create pre-emphasis filter
  for (var i = 0; i < fftSize/2; i++){
    var w = i/(fftSize/2) * Math.PI;
    var real = 1 - this.preEmph*Math.cos(-w);
    var img = -this.preEmph*Math.sin(-w);
    this.h[i] = Math.sqrt(real*real + img*img);
  }
  
  
  var f = [];
  //var fw = [];
  // Create mel and freq points
  for (var i = 0; i<K; i++){
    f[i] = fMin + i*(fMax - fMin)/K;
    //fw[i] = this.freq2mel(f[i]);
  }
  
  
  // Create cutoff frequencies
  var c = [];
  //var cw = [];
  var mLF = this.freq2mel(lowFreq);
  var mHF = this.freq2mel(highFreq);
  for (var i = 0; i<M+2; i++){
  	c[i] = this.mel2freq(mLF + i*(mHF-mLF)/(M+1)); 
  	//cw[i] = this.freq2mel(c[i]);
  }
  

  // Create filter banks
  for (var i = 0; i < M; i++){
    this.filterBanks[i] = [];//new Array(K);
    // Create triangular filter
    for (var j = 0; j < K; j++){
      this.filterBanks[i][j] = 0;
      // Up-slope
      if (f[j]>=c[i] && f[j]<=c[i+1])
      	this.filterBanks[i][j] = (f[j] - c[i])/(c[i+1] - c[i]);
      // Down-slope
      if (f[j]>=c[i+1] && f[j]<=c[i+2])
        this.filterBanks[i][j] = (c[i+2]-f[j])/(c[i+2] - c[i+1]);
    }
    
  }
  
  // LOG FILTERBANKS
  this.LOGFB = "";
  for (var i = 0; i< K; i++)
  	this.LOGFB += "bin" + i + ", ";
  for (var i = 0; i < M; i++){
    this.LOGFB +="\n";
    for (var j = 0; j < K; j++)
      this.LOGFB += this.filterBanks[i][j] + ", ";
  }
}

// DCT matrix
MFCC.prototype.createDCT = function(){
  var mfccDim = this.mfccDim;
  var nFilt = this.nFilt;
  // DCT of the coefficients
  var sqrt2var = Math.sqrt(2/nFilt);
  for (var i = 0; i<mfccDim; i++){
    this.dct[i] = [];
    for (var j = 0; j<nFilt; j++){
      this.dct[i][j] = sqrt2var * Math.cos(i*Math.PI*((j+1)-0.5)/nFilt);
    }
  }
}

// Lifter coefficients
MFCC.prototype.createLifter = function(){
  var lifter = this.lifter;
  var mfccDim = this.mfccDim;
  // Weight cepstrums
  for (var i = 0; i < mfccDim; i++){
    this.cepWin[i] = 1.0 + lifter/2 * Math.sin(i * Math.PI/lifter);
  }
}
MFCC.prototype.drawSignal = function(){
 
  width = gl.viewport_data[2];
  height = gl.viewport_data[3];
  
  gl.start2D();
  
  // Filter banks
  var filterBanks = this.filterBanks;
  var nfft = this.analyser.frequencyBinCount;

  var scaleW = 0.5;
  
  gl.translate(40,50);
  if (filterBanks){
    for (var i = 0; i<filterBanks.length; i++){
      gl.beginPath();
      // Draw lines
      gl.moveTo(0,0);
      for (var j = 0; j<nfft; j++)
        gl.lineTo(j * scaleW, -filterBanks[i][j]*20);
      
      gl.strokeStyle = "rgba(255,255,255,0.9)";
      gl.stroke();
    }
    // Show frequencies
    gl.font = "10px Arial";
    gl.fillStyle = "rgba(255,255,255,0.8)";
    gl.textAlign = "center";
    // mhi
    gl.fillText(this.highFreq+"Hz", this.highFreq/(this.fs*0.5) * nfft * scaleW, 15);
    // Half freq
    gl.fillText(this.fs/4 + "Hz", (nfft/2)*scaleW, 15);
    // Max freq
    gl.fillText(this.fs/2 + "Hz", (nfft-1)*scaleW, 15);
  }
  gl.translate(-40,-50);
  
  
  // FFT
  var data = this.data;
  if (data){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++)
      gl.lineTo(i * scaleW, -45 - (data[i]+20)/1.4);
    
    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.translate(-40,-100);
  }
  
  
  // Power Spectrogram
  var powerSpec = this.powerSpec;
  var scaleH = 4;//0.001;
  if (powerSpec){
    gl.beginPath();
    gl.translate(40,100);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<nfft; i++)
      gl.lineTo(i * scaleW, -powerSpec[i]*scaleH);
    
    gl.strokeStyle = "rgba(127,255,127,0.9)";
    gl.stroke();

    gl.translate(-40,-100);
  }
  
  
  // Wave
  var wave = this.wave;
  if (wave){
    gl.beginPath();
    gl.translate(40,200);
    // Draw lines
    gl.moveTo(0,0);
    for (var i = 0; i<wave.length; i++)
      gl.lineTo(i *0.5 * scaleW, wave[i]*100);
    
    gl.strokeStyle = "rgba(255,255,255,0.9)";
    gl.stroke();

    gl.translate(-40,-200);
  }
  
  
  // MFCC visualization
  // max mfcc ~= 32 / training = 18 (not CMN)
  // max delta ~= 8 / training = 5
  // max energy ~= 5 / training = 2 (not CMN)
  var prevMFCC = this.prevMFCC;
  if (prevMFCC){
    
    if (prevMFCC[0]){
      gl.translate(40,300);
      //console.log(prevMFCC);
      var rect = {x: 0, y: 0, w: 20, h: 20};

      for (var n = 0; n < prevMFCC.length; n++) {
        for (var i = 0; i < prevMFCC[n].length-1; i++){
        
          var hue = (-prevMFCC[n][i]*5 + 180) % 360;         
          gl.fillStyle = "hsla("+hue+", 100%, 50%, 0.5)";

          if (i == 12){
            hue = (-prevMFCC[n][i]*30 + 180) % 360;
          	gl.fillStyle = "hsla("+hue+", 100%, 50%, 0.5)";
          }
          gl.fillRect(rect.x + n*rect.w, rect.y + i*rect.h, rect.w, rect.h);
        }
      }
    
      // Legend
      var legendW = 162;
      var xMove = 55;
      rect.y = rect.y + rect.h*(prevMFCC[0].length);
      gl.fillStyle = "rgba(127, 127, 127, 0.7)";
      gl.fillRect(rect.x+xMove-20, rect.y-5, legendW, rect.h*2);
      
      rect.h = 15;
      rect.w = 2;
      for (var i = 0; i < 60; i++){
        var hue = ( - (i-30)*5 + 180) % 360; 
        gl.fillStyle = "hsla("+hue+", 100%, 50%, 0.5)";
        gl.fillRect(xMove + rect.x + i * rect.w, rect.y , rect.w, rect.h);
      }
      gl.font = "10px Arial";
  		gl.fillStyle = "rgba(255,255,255,0.8)";
  		gl.textAlign = "center";
			gl.fillText("-30", xMove-5 + rect.x, rect.y + rect.h + 15);
      gl.fillText("0", xMove + 55 + rect.x, rect.y + rect.h+15);
      gl.fillText("30", xMove + 115 + rect.x, rect.y + rect.h+15);
      
    	gl.translate(-40,-300);
    }
  }
  
  // MFCC Visualization 2
  if (prevMFCC){
    if (prevMFCC[0]){
      // Translate
      gl.translate(width - 400, 350);
      
      var numSampl = prevMFCC.length;
      var rect = {x: 0, y: 0, w: 20, h: 2};
      // Paint as signal
      for (var n = prevMFCC.length-1; n >=0 ; n--) {
        for (var i = 0; i < prevMFCC[n].length-1; i++){       
          gl.fillStyle = "rgba(255,255,255,"+ Math.pow((numSampl-n)/numSampl, 2)+")";
          gl.fillRect(rect.x + i*rect.w, rect.y -prevMFCC[n][i]*4, rect.w, rect.h);
        }
      }
      // Paint x axis line
      gl.beginPath();
      // Draw lines
      gl.moveTo(0,0);
      gl.lineTo(numSampl*rect.w, 0);
      gl.strokeStyle = "rgba(255,255,255,0.8)";
      gl.stroke();
      
      // Translate back
      gl.translate(-width + 400, -350);
    }
  }

}

//----------------------------- Cepstral Mean Normalization (CMN)

// Cepstral mean normalization
// Real time processing uses the previous input to calculate the current CMN
// parameters, thus for the first input utterance CMN cannot be performed.
// when the realtime option is ON the previous 5 second of input is always used.

// CMN is meant for reducing noise and other variables, such as vocal tract. Explained here:
// http://dsp.stackexchange.com/questions/19564/cepstral-mean-normalization
function CMN (mfccDim){
  
  this.cweight = 100;
  this.mfccDim = mfccDim; // 12
  this.veclen = mfccDim * 2 + 1; // 25
  this.cpStep = 5; // CPSTEP
  this.cpMax = 500; // CPMAX
  this.clistMax = 5; // CPSTEP 
  this.clistNum = 0;
  this.clist = [];
  for (var i = 0; i<this.clistMax; i++){
    this.clist[i] = {};
    this.clist[i].mfcc_sum = [];
    this.clist[i].framenum = 0;
  }
  this.mfcc_sum = []; // veclen 25
  this.cmeanInit = []; // veclen
  this.cmeanInitSet = false;
  this.allFramenum = 0;
  
  this.init();
  
};

CMN.prototype.init = function(){
   for (var i = 0; i < this.veclen; i++) this.mfcc_sum[i] = 0;
  this.framenum = 0;
}

CMN.prototype.realtime = function(mfcc){
   
  this.framenum++;
  if (this.cmeanInitSet){
    // initial data exists
    for (var i = 0; i <this.veclen; i++){
      // accumulate current MFCC to sum
      this.mfcc_sum[i] += mfcc[i];
      // calculate mean
      // map (do_map = map_cmn = true by default)
      
      var mean = mfcc[i] + this.cweight*this.cmeanInit[i];
      var divisor = this.framenum + this.cweight;
      mean /= divisor;
      if (i < this.mfccDim)
        mfcc[i] -= mean;
    }
  } else {
    // no initial data
    for (var i = 0; i<this.veclen; i++){
      // accumulate current MFCC to sum
      this.mfcc_sum[i] += mfcc[i];
      // calculate current mean
      var mean = this.mfcc_sum[i] / this.framenum;
      // mean normalization
      if (i < this.mfccDim)
        mfcc[i] -= mean;
    }
  }
  
  return mfcc;
}

CMN.prototype.update = function(){
  
  if (this.framenum == 0) return;
  
  // compute cepstral mean from now and previous sums up to CPMAX frames
  for (var i = 0; i < this.veclen; i++) 
    this.cmeanInit[i] = this.mfcc_sum[i];
  var frames = this.framenum;
  for (var i = 0; i < this.clistNum; i++){
    for (var j = 0; j< this.veclen; j++) 
      this.cmeanInit[j] += this.clist[i].mfcc_sum[j];
    if (this.clist[i] === undefined)
      console.error("UNDEFINED", JSON.stringify(this.clist), i); 
    else
    frames += this.clist[i].framenum;
    if (frames >= this.cpMax) break;
  }
  for (var i = 0; i< this.veclen; i++)
    this.cmeanInit[i] /= frames;
  
  
  this.cmeanInitSet = true;
  
  // expand clist if necessary
  if (this.clistNum == this.clistMax && frames < this.cpMax){
    this.clistMax += this.cpStep;
    for (var i = this.clistNum; i < this.clistMax; i++){
      this.clist[i] = {};
      this.clist[i].mfcc_sum = [];
      this.clist[i].framenum = 0;
    }
  }
  
  // shift clist
  var tmp = this.clist.splice(0, this.clistMax-1);
  //console.log ("TMP", JSON.stringify(tmp));
  this.clist[0] = {mfcc_sum: [], framenum: 0};
  for (var i = 0; i < this.veclen; i++)
    this.clist[0].mfcc_sum[i] = this.mfcc_sum[i];
  
  this.clist[0].framenum = this.framenum;
  this.clist = this.clist.concat(tmp);
  //console.log ("CLIST", JSON.stringify(this.clist));
  if (this.clistNum < this.clistMax)
    this.clistNum++;

}