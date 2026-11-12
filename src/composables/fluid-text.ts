// @ts-nocheck
// fluidText.js — 滑鼠攪動文字的流體扭曲效果（OGL + GPU 流體模擬）
// 原理：
// 1. 把文字畫在 2D canvas 上，當作貼圖
// 2. 在 GPU 上跑一個小型流體模擬（速度場 + 渦度 → 會捲成漩渦）
// 3. 另外維護一張「UV 座標場」，被流體帶著走（advection），再慢慢回彈到原位
// 4. 最後用這張 UV 場去取樣文字貼圖 → 文字被攪動、捲起、再復原
import { Renderer, Program, Mesh, Triangle, RenderTarget, Texture } from 'ogl'

const baseVertex = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  uniform vec2 texelSize;
  varying vec2 vUv, vL, vR, vT, vB;
  void main () {
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const frag = (body) => `precision highp float;
  varying vec2 vUv, vL, vR, vT, vB;
  ${body}`

// 在滑鼠位置「噴」一筆速度（高斯分布）
const splatShader = frag(`
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
  }
`)

// 讓速度場帶著自己走
const advectShader = frag(`
  uniform sampler2D uVelocity, uSource;
  uniform vec2 texelSize;
  uniform float dt, dissipation;
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = vec4(dissipation * texture2D(uSource, coord).xy, 0.0, 1.0);
  }
`)

// 讓 UV 場被流體帶著走，同時慢慢回到原本的 vUv（文字復原）
const advectUVShader = frag(`
  uniform sampler2D uVelocity, uSource;
  uniform vec2 texelSize;
  uniform float dt, relax;
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec2 uv = texture2D(uSource, coord).xy;
    gl_FragColor = vec4(mix(uv, vUv, relax), 0.0, 1.0);
  }
`)

const divergenceShader = frag(`
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) L = -C.x;
    if (vR.x > 1.0) R = -C.x;
    if (vT.y > 1.0) T = -C.y;
    if (vB.y < 0.0) B = -C.y;
    gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
  }
`)

const curlShader = frag(`
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
  }
`)

// 渦度增強：這就是「捲成漩渦」的關鍵
const vorticityShader = frag(`
  uniform sampler2D uVelocity, uCurl;
  uniform float curl, dt;
  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
    gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
  }
`)

const clearShader = frag(`
  uniform sampler2D uTexture;
  uniform float value;
  void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
`)

const pressureShader = frag(`
  uniform sampler2D uPressure, uDivergence;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float div = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
  }
`)

const gradientSubtractShader = frag(`
  uniform sampler2D uPressure, uVelocity;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`)

// UV 場初始化成恆等對應（沒有扭曲）
const identityUVShader = frag(`
  void main () { gl_FragColor = vec4(vUv, 0.0, 1.0); }
`)

// 最後輸出：用被攪動過的 UV 去取樣文字貼圖
const displayShader = frag(`
  uniform sampler2D tMap, tUV;
  void main () {
    vec2 uv = texture2D(tUV, vUv).xy;
    gl_FragColor = texture2D(tMap, uv);
  }
`)

const DEFAULTS = {
  text: 'CHIHUAHUA',
  fontFamily: '"Cherry Bomb One", system-ui',
  fontWeight: 600,
  widthRatio: 0.7, // 文字寬度佔畫面比例
  letterSpacing: -0.04, // em
  strokeWidth: 0.025, // 相對字級
  gradient: ['#fd8326', '#ff8bb4', '#8c93c7'],
  shadows: [
    { x: 10, y: 10, blur: 5, color: 'rgba(255,139,180,0.7)' },
    { x: 6, y: 6, blur: 2, color: 'rgba(253,131,38,0.9)' },
  ],
  // 流體參數
  simRes: 128,
  uvRes: 512,
  curl: 8, // 漩渦強度：越大越會捲（太大會變大理石紋）
  splatForce: 2800, // 滑鼠推力
  splatRadius: 0.7, // 筆刷大小
  velocityDissipation: 0.95, // 速度衰減：越小越快停
  pressureIterations: 20,
  relax: 0.045, // 文字回彈速度：越大越快復原
}

export class FluidText {
  constructor(container, options = {}) {
    this.o = { ...DEFAULTS, ...options }
    this.container = container
    this.pointer = { x: 0, y: 0, prevX: 0, prevY: 0, moved: false, inited: false }
    this.splats = []

    this.renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true, premultipliedAlpha: true })
    const gl = (this.gl = this.renderer.gl)
    gl.clearColor(0, 0, 0, 0)
    gl.canvas.style.display = 'block'
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'
    gl.canvas.style.touchAction = 'none'
    container.appendChild(gl.canvas)

    this.textCanvas = document.createElement('canvas')
    this.textTexture = new Texture(gl, {
      image: this.textCanvas,
      generateMipmaps: false,
      premultiplyAlpha: true,
      minFilter: gl.LINEAR,
    })

    this.geometry = new Triangle(gl)
    const mk = (fragment, uniforms = {}) =>
      new Mesh(gl, {
        geometry: this.geometry,
        program: new Program(gl, {
          vertex: baseVertex,
          fragment,
          uniforms: { texelSize: { value: [1, 1] }, ...uniforms },
          depthTest: false,
          depthWrite: false,
        }),
      })

    const u = () => ({ value: null })
    this.passes = {
      splat: mk(splatShader, { uTarget: u(), aspectRatio: { value: 1 }, color: { value: [0, 0, 0] }, point: { value: [0, 0] }, radius: { value: 0 } }),
      advect: mk(advectShader, { uVelocity: u(), uSource: u(), dt: { value: 0.016 }, dissipation: { value: 1 } }),
      advectUV: mk(advectUVShader, { uVelocity: u(), uSource: u(), dt: { value: 0.016 }, relax: { value: this.o.relax } }),
      divergence: mk(divergenceShader, { uVelocity: u() }),
      curl: mk(curlShader, { uVelocity: u() }),
      vorticity: mk(vorticityShader, { uVelocity: u(), uCurl: u(), curl: { value: this.o.curl }, dt: { value: 0.016 } }),
      clear: mk(clearShader, { uTexture: u(), value: { value: 0.8 } }),
      pressure: mk(pressureShader, { uPressure: u(), uDivergence: u() }),
      gradient: mk(gradientSubtractShader, { uPressure: u(), uVelocity: u() }),
      identity: mk(identityUVShader),
    }
    this.display = new Mesh(gl, {
      geometry: this.geometry,
      program: new Program(gl, {
        vertex: baseVertex,
        fragment: displayShader,
        uniforms: { texelSize: { value: [1, 1] }, tMap: { value: this.textTexture }, tUV: u() },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    })

    this._onMove = this._onMove.bind(this)
    this._onLeave = () => (this.pointer.inited = false)
    this._onResize = this.resize.bind(this)
    this._tick = this._tick.bind(this)

    gl.canvas.addEventListener('pointermove', this._onMove)
    gl.canvas.addEventListener('pointerleave', this._onLeave)
    this._ro = new ResizeObserver(this._onResize)
    this._ro.observe(container)

    this.resize()
    this._last = performance.now()
    this._raf = requestAnimationFrame(this._tick)
  }

  // ---------- 文字貼圖 ----------
  drawText() {
    const { o } = this
    const c = this.textCanvas
    const W = this.gl.canvas.width
    const H = this.gl.canvas.height
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    const dpr = this.renderer.dpr
    // 先用 100px 量寬度，再換算成剛好佔 widthRatio 的字級
    const setFont = (size) => {
      ctx.font = `${o.fontWeight} ${size}px ${o.fontFamily}`
      ctx.letterSpacing = `${o.letterSpacing * size}px`
    }
    setFont(100)
    const size = (100 * W * o.widthRatio) / ctx.measureText(o.text).width
    setFont(size)

    const textW = ctx.measureText(o.text).width
    const x0 = (W - textW) / 2
    const grad = ctx.createLinearGradient(x0, 0, x0 + textW, 0)
    o.gradient.forEach((col, i) => grad.addColorStop(i / (o.gradient.length - 1), col))

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size * o.strokeWidth
    ctx.strokeStyle = grad

    for (const s of o.shadows) {
      ctx.shadowOffsetX = s.x * dpr
      ctx.shadowOffsetY = s.y * dpr
      ctx.shadowBlur = s.blur * dpr
      ctx.shadowColor = s.color
      ctx.strokeText(o.text, W / 2, H * 0.52)
    }
    ctx.shadowColor = 'transparent'
    ctx.strokeText(o.text, W / 2, H * 0.52)

    this.textTexture.image = c
    this.textTexture.needsUpdate = true
  }

  // ---------- FBO ----------
  _fbo(w, h, internalFormat, format) {
    const gl = this.gl
    return new RenderTarget(gl, {
      width: w,
      height: h,
      type: this.renderer.isWebgl2 ? gl.HALF_FLOAT : this.renderer.extensions.OES_texture_half_float?.HALF_FLOAT_OES,
      internalFormat: this.renderer.isWebgl2 ? internalFormat : gl.RGBA,
      format: this.renderer.isWebgl2 ? format : gl.RGBA,
      minFilter: gl.LINEAR,
      depth: false,
    })
  }
  _double(w, h, internalFormat, format) {
    const f = {
      read: this._fbo(w, h, internalFormat, format),
      write: this._fbo(w, h, internalFormat, format),
      swap() {
        ;[this.read, this.write] = [this.write, this.read]
      },
    }
    return f
  }
  _res(r) {
    const aspect = this.gl.canvas.width / this.gl.canvas.height
    const min = Math.round(r)
    const max = Math.round(r * (aspect < 1 ? 1 / aspect : aspect))
    return aspect > 1 ? [max, min] : [min, max]
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height)

    const gl = this.gl
    const [sw, sh] = this._res(this.o.simRes)
    const [uw, uh] = this._res(this.o.uvRes)
    const RG16F = gl.RG16F, RG = gl.RG, R16F = gl.R16F, RED = gl.RED
    this.simTexel = [1 / sw, 1 / sh]
    this.velocity = this._double(sw, sh, RG16F, RG)
    this.pressure = this._double(sw, sh, R16F, RED)
    this.divergence = this._fbo(sw, sh, R16F, RED)
    this.curlFbo = this._fbo(sw, sh, R16F, RED)
    this.uv = this._double(uw, uh, RG16F, RG)

    // UV 場初始化為恆等
    this._pass('identity', this.uv.read)
    this._pass('identity', this.uv.write)

    this.drawText()
  }

  _pass(name, target, uniforms = {}) {
    const mesh = this.passes[name] || name
    for (const k in uniforms) mesh.program.uniforms[k].value = uniforms[k]
    this.renderer.render({ scene: mesh, target, clear: false })
  }

  // ---------- 滑鼠 ----------
  _onMove(e) {
    const rect = this.gl.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = 1 - (e.clientY - rect.top) / rect.height
    const p = this.pointer
    if (!p.inited) {
      p.prevX = p.x = x
      p.prevY = p.y = y
      p.inited = true
      return
    }
    p.prevX = p.x
    p.prevY = p.y
    p.x = x
    p.y = y
    const aspect = rect.width / rect.height
    let dx = p.x - p.prevX
    let dy = p.y - p.prevY
    if (aspect < 1) dx *= aspect
    if (aspect > 1) dy /= aspect
    this.splats.push({ x, y, dx: dx * this.o.splatForce, dy: dy * this.o.splatForce })
  }

  _splat({ x, y, dx, dy }) {
    const aspect = this.gl.canvas.width / this.gl.canvas.height
    let radius = this.o.splatRadius / 100
    if (aspect > 1) radius *= aspect
    this._pass('splat', this.velocity.write, {
      texelSize: this.simTexel,
      uTarget: this.velocity.read.texture,
      aspectRatio: aspect,
      point: [x, y],
      color: [dx, dy, 0],
      radius,
    })
    this.velocity.swap()
  }

  // ---------- 每一幀 ----------
  _tick(now) {
    this._raf = requestAnimationFrame(this._tick)
    const dt = Math.min((now - this._last) / 1000, 1 / 60)
    this._last = now
    const t = this.simTexel

    while (this.splats.length) this._splat(this.splats.shift())

    this._pass('curl', this.curlFbo, { texelSize: t, uVelocity: this.velocity.read.texture })
    this._pass('vorticity', this.velocity.write, {
      texelSize: t,
      uVelocity: this.velocity.read.texture,
      uCurl: this.curlFbo.texture,
      curl: this.o.curl,
      dt,
    })
    this.velocity.swap()

    this._pass('divergence', this.divergence, { texelSize: t, uVelocity: this.velocity.read.texture })

    this._pass('clear', this.pressure.write, { texelSize: t, uTexture: this.pressure.read.texture })
    this.pressure.swap()
    for (let i = 0; i < this.o.pressureIterations; i++) {
      this._pass('pressure', this.pressure.write, {
        texelSize: t,
        uPressure: this.pressure.read.texture,
        uDivergence: this.divergence.texture,
      })
      this.pressure.swap()
    }

    this._pass('gradient', this.velocity.write, {
      texelSize: t,
      uPressure: this.pressure.read.texture,
      uVelocity: this.velocity.read.texture,
    })
    this.velocity.swap()

    this._pass('advect', this.velocity.write, {
      texelSize: t,
      uVelocity: this.velocity.read.texture,
      uSource: this.velocity.read.texture,
      dt,
      dissipation: this.o.velocityDissipation,
    })
    this.velocity.swap()

    this._pass('advectUV', this.uv.write, {
      texelSize: t,
      uVelocity: this.velocity.read.texture,
      uSource: this.uv.read.texture,
      dt,
      relax: this.o.relax,
    })
    this.uv.swap()

    this.display.program.uniforms.tUV.value = this.uv.read.texture
    this.renderer.render({ scene: this.display })
  }

  // 字型載入後、或改文字時呼叫
  refresh() {
    this.drawText()
  }

  destroy() {
    cancelAnimationFrame(this._raf)
    this._ro.disconnect()
    this.gl.canvas.removeEventListener('pointermove', this._onMove)
    this.gl.canvas.removeEventListener('pointerleave', this._onLeave)
    this.gl.canvas.remove()
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}