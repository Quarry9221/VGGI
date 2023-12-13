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
    this.iIndexBuffer = gl.createBuffer(); // New index buffer
    this.count = 0;

    this.createIndices = function(innerStep) {
        const indices = [];
        // Assuming a grid of vertices
        for (let i = 0; i < innerStep; i++) {
            for (let j = 0; j < innerStep; j++) {
                const vertexIndex = i * (innerStep + 1) + j;
                indices.push(vertexIndex, vertexIndex + innerStep + 1, vertexIndex + 1);
                indices.push(vertexIndex + 1, vertexIndex + innerStep + 1, vertexIndex + innerStep + 2);
            }
        }
        return indices;
    };

    this.BufferData = function(vertices, normal) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal), gl.STREAM_DRAW);

        const indices = this.createIndices(75); // Assuming innerStep is defined somewhere
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.count = indices.length / 3; // Number of triangles
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        // Draw elements as triangles using indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count * 3, gl.UNSIGNED_SHORT, 0);

        gl.disableVertexAttribArray(shProgram.iAttribVertex);
        gl.disableVertexAttribArray(shProgram.iAttribNormal);
    };
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;

    this.iAttribNormal = -1;

    this.iLightPosition = -1;

    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.iModelMatrixNormal = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0.75, 0.85, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
        
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    
    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1,5,0,1] );

    surface.Draw();
}

function processSurfaceEquations(u, v) {
    // constant variables for equations
    const A = 0.3;
    const B = 0.3;
    const C = 0.15;
    const x = A * deg2rad(u) * Math.sin(deg2rad(u)) * Math.cos(deg2rad(v));
    const y = B * deg2rad(u) * Math.cos(deg2rad(u)) * Math.cos(deg2rad(v));
    const z = -C * deg2rad(u) * Math.sin(deg2rad(v));
    return { x, y, z };

}

function CreateSurfaceData()
{
    let vertexList = [];

    // 0 <= u <= 2PI, -PI <= v <= PI
    const innerStep = 5;
    for (let i = 0; i <= 360; i+=innerStep) {
        for (let j = -180; j <= 180; j+=innerStep) {
            const { x, y, z } = processSurfaceEquations(i, j);
            vertexList.push(x, y, z);
        }
    }

    for (let i = -180; i <= 180; i+=innerStep) {
        for (let j = 0; j <= 360; j+=innerStep) {
            const { x, y, z } = processSurfaceEquations(j, i);
            vertexList.push(x, y, z);
        }
    }


    return vertexList;
}

// Function to update the surface with the new max value of parameter r
function updateSurface() {
    const maxR = parseFloat(document.getElementById("paramR").value);
    surface.BufferData(CreateSurfaceData(maxR));
    document.getElementById("currentMaxR").textContent = maxR.toFixed(2);
    draw();
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData(), 100);

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


/**
 * initialization function that will be called when the page has loaded
 */
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
