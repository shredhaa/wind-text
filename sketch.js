let bodySegmentation;
let video;
let segmentation;
let faceMesh;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipped: true };
let previousLipDistance;

let paragraph = "In a quiet house at the edge of the village lived a girl who worked among the ashes. She moved gently through the rooms, sweeping the floor and tending the fire without complaint. When her stepmother spoke, she bowed her head and answered softly.";

let words = [];
let boxX, boxY, boxW, boxH;

function preload() {
  bodySegmentation = ml5.bodySegmentation("BodyPix", { flipped: true });
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO, { flipped: true });
  video.size(windowWidth, windowHeight);
  video.hide();
  bodySegmentation.detectStart(video, gotResults);
  faceMesh.detectStart(video, gotFaces);
  setupBox();
  initWords();
}

function setupBox() {
  boxX = width * 0.13;
  boxY = height * 0.12;
  boxW = width * 0.74;
  boxH = height * 0.75;
}

function initWords() {
  words = [];
  textFont('Palatino');
  textSize(19);

  let lineH = 28;
  let padding = 20;
  let maxLineW = boxW - padding * 2;

  let lines = [];
  let currentLine = [];
  let currentLineW = 0;

  // Wrap by whole word first, then split into chars
  let wordChunks = paragraph.split(" ");

  for (let wi = 0; wi < wordChunks.length; wi++) {
    let word = wordChunks[wi] + (wi < wordChunks.length - 1 ? " " : "");
    let wordW = textWidth(word);

    // If whole word doesn't fit, wrap to next line
    if (currentLineW + wordW > maxLineW && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentLineW = 0;
    }

    // Add each char of word to current line
    for (let ci = 0; ci < word.length; ci++) {
      let cw = textWidth(word[ci]);
      currentLine.push({ char: word[ci], w: cw });
      currentLineW += cw;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  let totalH = lines.length * lineH;
  let startY = boxY + (boxH - totalH) / 2;

  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    let lineW = line.reduce((sum, c) => sum + c.w, 0);
    let startX = boxX + padding + (maxLineW - lineW) / 2;
    let xCursor = startX;

    for (let ci = 0; ci < line.length; ci++) {
      words.push(new Word(line[ci].char, xCursor, startY + li * lineH));
      xCursor += line[ci].w;
    }
  }
}

function draw() {
  background(224, 255, 0);

  if (segmentation) {
    push();
    tint(255, 120);
    image(segmentation.mask, 0, 0, width, height);
    pop();
  }

  // Lip blow detection
  if (faces.length > 0 && faces[0].lips) {
    let lips = faces[0].lips;
    let topLeft = createVector(lips.x, lips.y);
    let bottomRight = createVector(lips.x + lips.width, lips.y + lips.height);
    let center = createVector(lips.centerX, lips.centerY);

    let lipDistance = dist(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);

    if (previousLipDistance > 90 && (previousLipDistance - lipDistance > 5)) {
      let blowStrength = map(previousLipDistance - lipDistance, 5, 60, 1, 8);
      blowStrength = constrain(blowStrength, 1, 8);
      for (let w of words) {
        trigger(w, center, blowStrength);
      }
    }
    previousLipDistance = lipDistance;
  }

  // Draw lip keypoints — outer + inner lip contour only
  if (faces.length > 0) {
    let keypoints = faces[0].keypoints;
    let lipIndices = [
      // Outer lip
      61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
      375, 321, 405, 314, 17, 84, 181, 91, 146,
      // Inner lip
      78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
      324, 318, 402, 317, 14, 87, 178, 88, 95
    ];

    for (let idx of lipIndices) {
      if (keypoints[idx]) {
        let kp = keypoints[idx];
        noStroke();
        fill(255, 0, 200, 200);
        circle(kp.x, kp.y, 5);
      }
    }
  }

  // Draw box (invisible)
  noFill();
  noStroke();
  rect(boxX, boxY, boxW, boxH);

  // Update + draw letters
  for (let w of words) {
    w.update();
    w.display();
  }
}

function trigger(word, mouth, blowStrength) {
  let force = p5.Vector.sub(word.position, mouth);
  let distance = force.mag();
  force.normalize();
  let magnitude = map(distance, 0, width, 0.1, 1) * random(0.1, 1) * blowStrength;
  force.mult(magnitude);
  word.applyForce(force);
  word.angleV = map(distance, 0, width, 0.01, 0.1) * random(0.5, 2) * blowStrength;
}

class Word {
  constructor(char, hx, hy) {
    this.char = char;
    this.homeX = hx;
    this.homeY = hy;
    this.position = createVector(hx, hy);
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
    this.angle = 0;
    this.angleV = 0;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.mult(0.92);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
    this.angle += this.angleV;
    this.angleV *= 0.95;
  }

  display() {
    push();
    translate(this.position.x, this.position.y);
    rotate(this.angle);
    fill(0);
    noStroke();
    textFont('Palatino');
    textSize(19);
    textAlign(LEFT, TOP);
    text(this.char, 0, 0);
    pop();
  }
}

function gotResults(result) {
  segmentation = result;
}

function gotFaces(results) {
  faces = results;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(windowWidth, windowHeight);
  setupBox();
  initWords();
}