// Minimal WebGL2 utilities & 4x4 matrix helpers for 64k budget.

export function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s) + '\n' + src);
  }
  return s;
}

export function createTexture2D(gl, w, h, internalFormat, format, type, filter = gl.LINEAR) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createSceneFBO(gl, w, h) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  const colorTex = createTexture2D(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  const depthInfoTex = createTexture2D(gl, w, h, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.NEAREST);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, depthInfoTex, 0);

  const depthRb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);

  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo, colorTex, depthInfoTex, depthRb, w, h };
}

export function createSimpleFBO(gl, w, h) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const tex = createTexture2D(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}

export function destroyFBO(gl, obj) {
  if (!obj) return;
  if (obj.fbo) gl.deleteFramebuffer(obj.fbo);
  if (obj.colorTex) gl.deleteTexture(obj.colorTex);
  if (obj.depthInfoTex) gl.deleteTexture(obj.depthInfoTex);
  if (obj.tex) gl.deleteTexture(obj.tex);
  if (obj.depthRb) gl.deleteRenderbuffer(obj.depthRb);
}

export function mat4Perspective(out, fovRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovRad * 0.5);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function mat4LookAtBasis(out, eye, right, up, forward) {
  // Camera looks along +forward, so -Z in view space is +forward
  const zx = -forward.x, zy = -forward.y, zz = -forward.z;
  const rx = right.x, ry = right.y, rz = right.z;
  const ux = up.x, uy = up.y, uz = up.z;

  out[0] = rx; out[1] = ux; out[2] = zx; out[3] = 0;
  out[4] = ry; out[5] = uy; out[6] = zy; out[7] = 0;
  out[8] = rz; out[9] = uz; out[10] = zz; out[11] = 0;
  out[12] = -(rx * eye.x + ry * eye.y + rz * eye.z);
  out[13] = -(ux * eye.x + uy * eye.y + uz * eye.z);
  out[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
  out[15] = 1;
  return out;
}

export function mat4FromBasis(out, pos, right, up, forward, scale = 1) {
  // Local +Z = -forward (so nose points along +forward when mesh nose is -Z)
  out[0] = right[0] * scale;    out[1] = right[1] * scale;    out[2] = right[2] * scale;    out[3] = 0;
  out[4] = up[0] * scale;       out[5] = up[1] * scale;       out[6] = up[2] * scale;       out[7] = 0;
  out[8] = -forward[0] * scale; out[9] = -forward[1] * scale; out[10] = -forward[2] * scale; out[11] = 0;
  out[12] = pos[0];             out[13] = pos[1];             out[14] = pos[2];             out[15] = 1;
  return out;
}
