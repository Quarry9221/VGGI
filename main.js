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
   
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
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
    gl.clearColor(0,0,0,1);
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
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    let inversion = m4.inverse(modelViewProjection);
    let transposedModel = m4.transpose(inversion);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    gl.uniformMatrix4fv(shProgram.iModelMatrixNormal, false, transposedModel );
    gl.uniform3fv(shProgram.iLightPosition, [0.0, 1.0, 0.0]);

    surface.Draw();
}

function processSurfaceEquations(u, v) {
    // constant variables for equations
    const A = 0.25;
    const B = 0.25;
    const C = 0.125;
    const x = A * u * Math.sin(u) * Math.cos(v);
    const y = B * u * Math.cos(u) * Math.cos(v);
    const z = -C * u * Math.sin(v);
    return { x, y, z };

}

function CreateSurfaceData()
{
    let vertexList = [];
    let normalList = [];
    let step = 0.01;
    let delta = 0.001;

    // 0 <= u <= 2PI, -PI <= v <= PI

    for (let u = 0; u <= 2 * Math.PI; u += step) {
        for (let v = -Math.PI; v <= Math.PI; v += step) {

            let v1 = processSurfaceEquations(u, v);
            let v2 = processSurfaceEquations(u, v + step);
            let v3 = processSurfaceEquations(u + step, v);
            let v4 = processSurfaceEquations(u + step, v + step);
            vertexList.push(v1.x, v1.y, v1.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v3.x, v3.y, v3.z);
            
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v4.x, v4.y, v4.z);
            vertexList.push(v3.x, v3.y, v3.z);

            let n1 = CalculateNormal(u, v, delta);
            let n2 = CalculateNormal(u, v + step, delta);
            let n3 = CalculateNormal(u + step, v, delta);
            let n4 = CalculateNormal(u + step, v + step, delta)

            normalList.push(n1.x, n1.y, n1.z);
            normalList.push(n2.x, n2.y, n2.z);
            normalList.push(n3.x, n3.y, n3.z);
            
            normalList.push(n2.x, n2.y, n2.z);
            normalList.push(n4.x, n4.y, n4.z);
            normalList.push(n3.x, n3.y, n3.z);
        }
    }


    return { vertices: vertexList, normal: normalList };
}

function CalculateNormal(u, v, delta) {
    let currentPoint = processSurfaceEquations(u, v);
    let pointu = processSurfaceEquations(u + delta, v);
    let pointv = processSurfaceEquations(u, v + delta);

    let dg_du = {
        x: (pointu.x - currentPoint.x) / delta,
        y: (pointu.y - currentPoint.y) / delta,
        z: (pointu.z - currentPoint.z) / delta
    };

    let dg_dv = {
        x: (pointv.x - currentPoint.x) / delta,
        y: (pointv.y - currentPoint.y) / delta,
        z: (pointv.z - currentPoint.z) / delta
    };

    let normal = cross(dg_du, dg_dv);

    normalize(normal);

    return normal;
}


function cross(a, b) {
    let x = a.y * b.z - b.y * a.z;
    let y = a.z * b.x - b.z * a.x;
    let z = a.x * b.y - b.x * a.y;
    return { x: x, y: y, z: z }
}

function normalize(a) {
    var b = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    a.x /= b;
    a.y /= b;
    a.z /= b;
}

// Function to update the surface with the new max value of parameter r
function updateSurface() {
    let data = CreateSurfaceData();
    surface.BufferData(data.vertices, data.normal);
    draw();
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelMatrixNormal         = gl.getUniformLocation(prog, "ModelNormalMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");

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

    draw();
}