# 3Dpuppeteering
[[Demo](https://webglstudio.org/demos/puppeteering/latest/)]
[[Related paper](https://webglstudio.org/papers/ICGI2019/)]

Web application for real time animation of a virtual actor. The character can be controlled using a webcam (default) or a gamepad. 

This project is developed in [WebGLStudio](https://webglstudio.org/) and uses the [Beyond Reality Face (v4)](https://github.com/Tastenkunst/brfv4_javascript_examples) library for facial landmark tracking.

![alt text](https://webglstudio.org/papers/ICGI2019/preview.png)

> **tags:** JavaScript, WebGL, Puppeteering, Facial retargeting, Animation, Embodied Virtual Actor, Gestures, Facial Expressivity, Virtual Characters, Real-time, 3D graphics

# Using Webcam
Before start, you must pre-initialize a neutral face. That means you have to put a neutral expression looking into the screen and press "Calibrate" button. You can also modify some thresholds if you active "Show Parameters".

![alt text](https://www.upf.edu/documents/115100603/127073945/3D+puppeteering+v2/96dbe711-4b8a-7198-e889-0ecafe617b7d?t=1572260942821)

# Using Gamepad

The available expressions are represented in a 2d circumplex space (Valence-Arousal representation) as is shown in the following image. You can move in this space with the left joystick of the gamepad.

<p align="center">
  <img align = "middle" src="https://webglstudio.org/users/evalls/WebcamPuppeteering/img/control_gamepad.png" width="350">
  <img align = "middle" hspace = "40" src="https://webglstudio.org/users/evalls/WebcamPuppeteering/img/rang_expressions.png" width="250">
</p>

> # Lip sync
In the gamepad mode you can also activate the lip synchronization with your voice. For this, a microphone is required.
