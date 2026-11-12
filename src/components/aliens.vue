<script setup>
// 往下捲動：照片沿著曲線從右到左移動
// 走到一半 → 照片下方發光＋畫面中間浮出一張圖 → 再往下捲，兩者消失，照片繼續走完軌跡
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin)

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  // 走到一半時，畫面中間出現的圖片
  centerSrc: { type: String, default: '' },
  centerAlt: { type: String, default: '' },
  // 捲動距離：幾個螢幕高（越大走得越慢）；中間多了停留的段落，所以比原本長一點
  length: { type: Number, default: 3.5 },
})

const rootRef = useTemplateRef('root')
const svgRef = useTemplateRef('svg')
const guideARef = useTemplateRef('guideA') // 前半段（右 → 停點）
const guideBRef = useTemplateRef('guideB') // 後半段（停點 → 左）
const trailARef = useTemplateRef('trailA')
const trailBRef = useTemplateRef('trailB')
const imgRef = useTemplateRef('img')
const glowRef = useTemplateRef('glow')
const centerRef = useTemplateRef('center')
let ctx = null
let lenA = 0
let lenB = 0

// ---------- 舞台 ----------
// 在畫面中央想像一個固定比例（16:10）的舞台，會縮放到剛好塞進螢幕
// 照片大小、停點位置、中間圖片位置都用舞台當尺 → 任何螢幕構圖都一樣
// （CSS 裡的 --stage-w / --stage-h 是同一個舞台）
const STAGE_RATIO = 16 / 10

function buildPath() {
  const w = rootRef.value.clientWidth
  const h = rootRef.value.clientHeight
  const sw = Math.min(w, h * STAGE_RATIO) // 舞台寬
  const sh = sw / STAGE_RATIO // 舞台高
  const X = (f) => w / 2 + (f - 0.5) * sw // 舞台內的水平位置（0 ~ 1）
  const Y = (f) => h / 2 + (f - 0.5) * sh // 舞台內的垂直位置（0 ~ 1）

  // 起點、終點放在螢幕外，距離足以讓整張照片藏起來
  const margin = imgRef.value.offsetWidth / 2 + 40
  const stop = { x: X(0.5), y: Y(0.2) } // 停點：舞台水平中央、高度 20%

  // 前半段：從右邊螢幕外 → 停點
  const dA = `M ${w + margin} ${Y(0.05)} C ${X(0.8)} ${Y(0.05)}, ${X(0.72)} ${Y(0.2)}, ${stop.x} ${stop.y}`
  // 後半段：停點 → 左邊螢幕外（第一個控制點和前半段對稱，曲線才會平順接起來）
  const dB = `M ${stop.x} ${stop.y} C ${X(0.28)} ${Y(0.2)}, ${X(0.15)} ${Y(0.1)}, ${-margin} ${Y(0.1)}`

  svgRef.value.setAttribute('viewBox', `0 0 ${w} ${h}`)
  guideARef.value.setAttribute('d', dA)
  trailARef.value.setAttribute('d', dA)
  guideBRef.value.setAttribute('d', dB)
  trailBRef.value.setAttribute('d', dB)
  lenA = trailARef.value.getTotalLength()
  lenB = trailBRef.value.getTotalLength()
}

// 停下來時往上浮起的距離：舞台寬的 0.9%（大螢幕約 14px），小螢幕會跟著變小
const floatPx = () => {
  const w = rootRef.value.clientWidth
  const h = rootRef.value.clientHeight
  return Math.min(w, h * STAGE_RATIO) * 0.009
}

// 照片沿著某一段軌跡走完
const moveAlong = (pathEl, duration) => ({
  motionPath: {
    path: pathEl,
    align: pathEl,
    alignOrigin: [0.5, 0.5], // 以照片中心對齊
  },
  duration,
})

onMounted(() => {
  ctx = gsap.context(() => {
    buildPath()
    // 視窗大小改變時，ScrollTrigger 重新計算前先重畫曲線
    ScrollTrigger.addEventListener('refreshInit', buildPath)

    const img = imgRef.value
    const photo = img.querySelector('img')

    gsap.set(glowRef.value, { autoAlpha: 0, scale: 0.4, rotation: -6, transformOrigin: '50% 50%' })
    gsap.set(photo, { filter: 'drop-shadow(0px 0px 0px rgba(255, 196, 92, 0))' })
    if (centerRef.value) gsap.set(centerRef.value, { autoAlpha: 0, scale: 0.7, y: 40 })

    const tl = gsap.timeline({ defaults: { ease: 'none' } })

    // ---------- 1. 前半段：走到 stopAt ----------
    tl.addLabel('first')
    tl.to(img, moveAlong(guideARef.value, 1), 'first')
    tl.fromTo(
      trailARef.value,
      { strokeDasharray: () => lenA, strokeDashoffset: () => lenA },
      { strokeDashoffset: 0, duration: 1 },
      'first',
    )
    // 途中微微搖擺，到停點時擺正
    tl.to(img, { rotate: -10, duration: 0.4, ease: 'sine.inOut' }, 'first')
      .to(img, { rotate: 8, duration: 0.35, ease: 'sine.inOut' }, 'first+=0.4')
      .to(img, { rotate: 0, duration: 0.25, ease: 'sine.inOut' }, 'first+=0.75')

    // ---------- 2. 停住：下方發光＋中間圖片浮出 ----------
    tl.addLabel('glowIn')
    tl.set(img, { rotation: 5 }, 'glowIn') // 停在中間時確保照片正向
    tl.to(glowRef.value, { autoAlpha: 1, scale: 1, rotation: -6, duration: 0.4, ease: 'power2.out' }, 'glowIn')
    tl.to(photo, { filter: 'drop-shadow(0px 12px 28px rgba(255, 196, 92, 0.95))', duration: 0.4, ease: 'power2.out' }, 'glowIn')
    // 照片輕輕浮起一點，像被光托著
    tl.to(img, { y: () => `-=${floatPx()}`, duration: 0.4, ease: 'power2.out' }, 'glowIn')
    if (centerRef.value) {
      tl.to(centerRef.value, { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, 'glowIn+=0.15')
    }
    tl.addLabel('hold')
    tl.to({}, { duration: 0.6 }) // 停留一下，讓人看清楚

    // ---------- 3. 發光和中間圖片消失 ----------
    tl.addLabel('glowOut')
    if (centerRef.value) {
      tl.to(centerRef.value, { autoAlpha: 0, scale: 1.08, y: -30, duration: 0.4, ease: 'power2.in' }, 'glowOut')
    }
    tl.to(glowRef.value, { autoAlpha: 0, scale: 0.4, rotation: 0, duration: 0.4, ease: 'power2.in' }, 'glowOut+=0.1')
    tl.to(photo, { filter: 'drop-shadow(0px 0px 0px rgba(255, 196, 92, 0))', duration: 0.4, ease: 'power2.in' }, 'glowOut+=0.1')
    tl.to(img, { y: () => `+=${floatPx()}`, duration: 0.4, ease: 'power2.in' }, 'glowOut+=0.1')

    // ---------- 4. 後半段：繼續走完 ----------
    tl.addLabel('second')
    tl.to(img, moveAlong(guideBRef.value, 1), 'second')
    tl.fromTo(
      trailBRef.value,
      { strokeDasharray: () => lenB, strokeDashoffset: () => lenB },
      { strokeDashoffset: 0, duration: 1 },
      'second',
    )
    tl.to(img, { rotate: -6, duration: 0.5, ease: 'sine.inOut' }, 'second')
      .to(img, { rotate: 0, duration: 0.5, ease: 'sine.inOut' }, 'second+=0.5')

    // 捲到停點附近時，輕輕吸附到「圖片完整出現」的位置
    const holdPoint = tl.labels.hold / tl.duration()
    const snapTo = (value) => (Math.abs(value - holdPoint) < 0.07 ? holdPoint : value)

    ScrollTrigger.create({
      trigger: rootRef.value,
      start: 'top top',
      end: () => `+=${window.innerHeight * props.length}`,
      pin: true,
      scrub: 1, // 數字越大，照片跟著滾輪越「滑」
      animation: tl,
      invalidateOnRefresh: true,
      snap: { snapTo, duration: { min: 0.2, max: 0.5 }, delay: 0.1, inertia: false, ease: 'power1.inOut' },
    })
  }, rootRef.value)
})

onBeforeUnmount(() => {
  ScrollTrigger.removeEventListener('refreshInit', buildPath)
  ctx?.revert()
})
</script>

<template>
  <section ref="root" class="path-section">
    <svg ref="svg" class="path-section__svg" aria-hidden="true">
      <!-- 淡淡的虛線：整條路線（分前後兩段） -->
      <path ref="guideA" class="path-section__guide" />
      <path ref="guideB" class="path-section__guide" />
      <!-- 實線：照片走過的軌跡 -->
      <path ref="trailA" class="path-section__trail" />
      <path ref="trailB" class="path-section__trail" />
    </svg>

    <!-- 走到一半時，畫面中間出現的圖片 -->
    <div v-if="props.centerSrc" ref="center" class="path-section__center">
      <img :src="props.centerSrc" :alt="props.centerAlt" draggable="false" />
    </div>

    <div ref="img" class="path-section__photo">
      <!-- 照片下方的光 -->
      <div ref="glow" class="path-section__glow" aria-hidden="true"></div>
      <img :src="props.src" :alt="props.alt" draggable="false" />
    </div>
  </section>
</template>

<style scoped>
.path-section {
  /* 舞台尺寸：16:10，剛好塞進螢幕（要和 script 裡的 STAGE_RATIO 一致） */
  --stage-w: min(100vw, 160vh);
  --stage-h: min(62.5vw, 100vh);

  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.path-section__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.path-section__guide {
  fill: none;
  stroke: rgba(26, 26, 26, 0.18);
  stroke-width: 2;
  stroke-dasharray: 6 10;
}

.path-section__trail {
  fill: none;
  stroke: #fd8326;
  stroke-width: 4;
  stroke-linecap: round;
}

/* 位置由 MotionPath 控制，這裡只要放在左上角 */
.path-section__photo {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  width: calc(var(--stage-w) * 0.5); /* 舞台寬的 50% */
  will-change: transform;
}

.path-section__photo img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

/* 照片正下方的一團暖色光：橢圓＋模糊 */
.path-section__glow {
  position: absolute;
  left: 4%;
  right: 4%;
  bottom: -20%;
  height: 42%;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
}

/* 柔和的暖色核心光暈 */
.path-section__glow::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 220, 1) 6%,
    rgba(255, 239, 92, 0.98) 32%,
    rgba(255, 202, 24, 0.7) 62%,
    transparent 82%
  );
  filter: blur(14px);
}

/* 畫面正中間的圖片 */
.path-section__center {
  position: absolute;
  left: 50%;
  /* 舞台高度 70% 的位置（50% 是舞台正中，再往下 20%）；想更低就把 0.2 調大 */
  top: calc(40% + var(--stage-h) * 0.1);
  z-index: 3; /* 在照片上面，出現時才不會被蓋住 */
  width: calc(var(--stage-w) * 0.256); /* 舞台寬的 25.6% */
  translate: -50% -50%; /* 用 translate 屬性置中，不會跟 GSAP 的 transform 打架 */
  pointer-events: none;
}

.path-section__center img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
}
</style>