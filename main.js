'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, normal) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);
   
        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(1,1,1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
       let modelViewProjection = m4.multiply(projection, matAccum1);

       let inversion = m4.inverse(modelViewProjection);
       let transposedModel = m4.transpose(inversion);

       gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
       gl.uniformMatrix4fv(shProgram.iModelMatrixNormal, false, transposedModel );
   
       /* Draw the six faces of a cube, with different colors. */
       gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);
       let x = document.getElementById('x').value
       let y = document.getElementById('y').value
       let z = document.getElementById('z').value
       gl.uniform3fv(shProgram.iLightPosition, [x, y, z]);
   
       gl.uniform3fv(shProgram.iLightDirection, [1, -1, -1]);
       let f = document.getElementById('f').value
       let r = document.getElementById('r').value
       gl.uniform1f(shProgram.iRange, r);
       gl.uniform1f(shProgram.iFocus, f);

    surface.Draw();
}
function UpdateDraw() {
    draw()
    window.requestAnimationFrame(UpdateDraw)
}
function processSurfaceEquations(u, v) {
    const A = 0.25;
    const B = 0.25;
    const C = 0.125;
    const x = A * deg2rad(u) * Math.sin(deg2rad(u)) * Math.cos(deg2rad(v));
    const y = B * deg2rad(u) * Math.cos(deg2rad(u)) * Math.cos(deg2rad(v));
    const z = -C * deg2rad(u) * Math.sin(deg2rad(v));
    return { x, y, z };

}

function CreateSurfaceData()
{
    let vertexList = [];
    let normalList = [];
    let step = 5;
    let delta = 0.001;

    for (let u = -180; u <= 180; u += step) {
        for (let v = 0; v <= 360; v += step) {

            let v1 = processSurfaceEquations(v, u);
            let v2 = processSurfaceEquations(v + step, u);
            let v3 = processSurfaceEquations(v, u + step);
            let v4 = processSurfaceEquations(v + step, u + step);
            vertexList.push(v1.x, v1.y, v1.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v3.x, v3.y, v3.z);
            
            vertexList.push(v3.x, v3.y, v3.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v4.x, v4.y, v4.z);


            let n1 = CalculateNormal(u, v, delta);
            let n2 = CalculateNormal(u, v + step, delta);
            let n3 = CalculateNormal(u + step, v, delta);
            let n4 = CalculateNormal(u + step, v + step, delta)

            normalList.push(...n1, ...n2, ...n3, ...n3, ...n2, ...n4);
        }
    }


    return { vertices: vertexList, normal: normalList };
}

function CalculateNormal(v, u, delta) {
    let currentPoint = processSurfaceEquations(u, v);
    let pointu = processSurfaceEquations(u + delta, v);
    let pointv = processSurfaceEquations(u, v + delta);

    let dg_du = [
        currentPoint.x - pointu.x  / delta,
        currentPoint.y - pointu.y / delta,
        currentPoint.z - pointu.z  / delta
    ];

    let dg_dv = [
        currentPoint.x -pointv.x  / delta,
        currentPoint.y -pointv.y  / delta,
        currentPoint.z -pointv.z  / delta
    ];

    let normal = m4.normalize(m4.cross(dg_du, dg_dv))

    return normal;
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelMatrixNormal         = gl.getUniformLocation(prog, "ModelNormalMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iLightDirection = gl.getUniformLocation(prog, "lightDirection");
    shProgram.iRange = gl.getUniformLocation(prog, "range");
    shProgram.iFocus = gl.getUniformLocation(prog, "focus");

    surface = new Model('Surface');
    let data = CreateSurfaceData();
    surface.BufferData(data.vertices, data.normal);

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    UpdateDraw();
}