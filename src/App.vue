<script setup>
import { onBeforeUnmount, ref, nextTick, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { FluidText } from './composables/fluid-text'
import YuzuGallery from './components/yuzu-gallery.vue'
import Aliens from './components/aliens.vue'
import HeadShape from './components/head-shape.vue'
import Size from './components/size.vue'
import Collage from './components/collage.vue'
import Outro from './components/outro.vue'
import NavMenu from './components/nav-menu.vue'
import logoUrl from './assets/logo.png' // 用 import，打包後路徑才不會壞

import photo1 from './assets/yuzu-1.JPG'
import photo2 from './assets/yuzu-2.JPG'
import photo3 from './assets/yuzu-3.JPG'
import aliens from './assets/aliens.png'
import chihuahua from './assets/200.webp'

import appleHead from './assets/apple-head.png'
import deerHead from './assets/deer-head.png'

import headExtra1 from './assets/head.jpg'
import headExtra2 from './assets/headSkull.jpg'

import pairLeft from './assets/size.png'
import pairRight from './assets/size-compare.webp'
import pairCover from './assets/huge.png'

import collage1 from './assets/chicken.jpg'
import collage2 from './assets/class.jpg'
import collage3 from './assets/crowded.jpg'
import collage4 from './assets/dumpling.jpg'
import collage5 from './assets/gitar.jpg'
import collage6 from './assets/golliza.jpg'
import collage7 from './assets/naruto.jpg'
import collage8 from './assets/hii.jpeg'
import collage9 from './assets/noq.jpg'
import collage10 from './assets/godg.png'

// Reference 區塊周圍的 5 張照片（換成你的檔名）
import ref1 from './assets/1111.png'
import ref2 from './assets/2222.png'
import ref3 from './assets/3333.png'
import ref4 from './assets/4444.png'
import ref5 from './assets/5555.png'

const photos = [
  { src: photo1, title: 'PHOTO 1' },
  { src: photo2, title: 'PHOTO 2' },
  { src: photo3, title: 'PHOTO 3' },
]

const heads = [
  { src: appleHead, label: 'Apple Head' },
  { src: deerHead, label: 'Deer Head' },
]

// Head Shape 原本兩組出現後，再往下捲換上的另外兩張（左、右）
const headExtras = [
  { src: headExtra1, alt: 'extra 1' },
  { src: headExtra2, alt: 'extra 2' },
]

// 第 1 個就是第 1 張出現的，依序到第 8 張
const collagePhotos = [collage1, collage2, collage3, collage4, collage5, collage6, collage7, collage8, collage9, collage10].map(
  (src, i) => ({ src, alt: `photo ${i + 1}` }),
)

// 最後一區的文字：每一個字串是一段
const outroText = [
  '1. https://www.dimensions.com/element/chihuahua',
  '2. https://lyka.com.au/blog/chihuahua-breed-guide',
  '3. https://www.facebook.com/groups/chihuahuaparents/posts/27418144597865873/',
  '4. https://www.instagram.com/godgwawa?utm_source=ig_web_button_share_sheet&obrf=ZDNlZDc0MzIxNw==',
  '5. Google Search: Chihuahua memes',
]

// 最後一區文字周圍的照片，順序對應位置：
// 1 標題左邊、2 標題右上、3 文字右邊、4 文字左下、5 文字下方
const outroPhotos = [ref1, ref2, ref3, ref4, ref5].map((src, i) => ({ src, alt: `reference ${i + 1}` }))

// 選單項目：id 對應下面每一區外層 div 的 id；'top' 代表回到最上面
// label 是選單上顯示的文字
const menuSections = [
  { id: 'top', label: 'Home' },
  { id: 'sec-yuzu', label: 'Yuzu' },
  { id: 'sec-aliens', label: 'Aliens' },
  { id: 'sec-head', label: 'Head Shape' },
  { id: 'sec-collage', label: 'Memes' },
  { id: 'sec-size', label: 'Size' },
  { id: 'sec-reference', label: 'Reference' },
]

const heroRef = useTemplateRef('hero')
const logoRef = useTemplateRef('logo')
const followerRef = useTemplateRef('follower')

const showHero = ref(false)
const FOLLOW_SIZE = 56 // 跟隨圖標最後的寬度（px）

let fx = null
let xTo = null
let yTo = null

function onPointerMove(e) {
  xTo?.(e.clientX)
  yTo?.(e.clientY)
}

async function onButtonClick(e) {
  if (showHero.value) return

  // 1. 量按鈕裡 logo 的位置，把跟隨用的 logo 疊上去
  const rect = logoRef.value.getBoundingClientRect()
  const f = followerRef.value
  f.style.width = `${rect.width}px`
  gsap.set(f, {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    xPercent: -50,
    yPercent: -50,
    scale: 1,
    autoAlpha: 1,
  })

  // 2. 建立平滑跟隨；duration 越大，拖尾越明顯
  xTo = gsap.quickTo(f, 'x', { duration: 0.5, ease: 'power3' })
  yTo = gsap.quickTo(f, 'y', { duration: 0.5, ease: 'power3' })

  // 用鍵盤按 Enter 時 clientX/Y 會是 0，改用 logo 中心
  const startX = e.detail === 0 ? rect.left + rect.width / 2 : e.clientX
  const startY = e.detail === 0 ? rect.top + rect.height / 2 : e.clientY
  xTo(startX)
  yTo(startY)

  // 3. 縮小成圖標
  gsap.to(f, {
    scale: FOLLOW_SIZE / rect.width,
    duration: 0.7,
    ease: 'power3.inOut',
  })

  window.addEventListener('pointermove', onPointerMove)

  await mountHero()
}

async function mountHero() {
  showHero.value = true
  await nextTick()
  if (!heroRef.value) return

  fx?.destroy?.()
  fx = new FluidText(heroRef.value, {
    text: 'CHIHUAHUA',
    fontFamily: '"Cherry Bomb One", system-ui',
    curl: 2,
    splatForce: 1200,
    splatRadius: 0.02,
    relax: 0.2,
  })

  await document.fonts.load('200px "Cherry Bomb One"')
  fx.refresh()

  gsap.from(heroRef.value, { y: -20, opacity: 0, duration: 0.6, ease: 'power2.out' })
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  fx?.destroy()
})
</script>

<template>
  <!-- main 不再用 flex 置中，改成一般往下排的頁面，才能往下捲 -->
  <main class="min-h-screen bg-[#ffd65c]" :class="{ 'cursor-none': showHero }">
    <!-- 第一屏：按鈕（置中的工作交給這個 div） -->
    <div v-if="!showHero" class="h-screen flex items-center justify-center">
      <button
        type="button"
        class="h-50 w-50 relative cursor-pointer overflow-hidden rounded-full"
        @click="onButtonClick"
      >
        <svg viewBox="0 0 200 200" class="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            <path id="buttonArc" d="M 30 100 A 70 70 0 0 1 170 100" />
          </defs>
          <text class="button-font" fill="#000000" font-size="22" font-weight="700" letter-spacing="4">
            <textPath href="#buttonArc" startOffset="50%" text-anchor="middle">CLICK</textPath>
          </text>
        </svg>
        <img ref="logo" :src="logoUrl" alt="logo" />
      </button>
    </div>

    <template v-else>
      <!-- 第一屏：流體標題 -->
      <div ref="hero" class="w-full h-screen" role="img" aria-label="CHIHUAHUA"></div>

      <!-- 每一區外面包一層有 id 的 div，選單才能找到它 -->
      <!-- 往下捲：三張照片依序出現 -->
      <div id="sec-yuzu">
        <YuzuGallery :photos="photos" />
      </div>

      <!-- 再往下：一張照片沿著曲線從右飛到左 -->
      <div id="sec-aliens">
        <Aliens
          :src="aliens"
          alt="aliens"
          :center-src="chihuahua"
          center-alt="chihuahua center"
        />
      </div>

      <!-- 再往下：Apple Head / Deer Head 依序出現 → 再往下換成另外兩張 -->
      <div id="sec-head">
        <HeadShape :items="heads" :extras="headExtras" />
      </div>

      <!-- 再往下：照片每隔一段時間依序出現 -->
      <div id="sec-collage">
        <Collage :photos="collagePhotos" />
      </div>

      <!-- 再往下：左右兩張直接出現，往下捲第三張壓在左邊上面 -->
      <div id="sec-size">
        <Size :left="pairLeft" :right="pairRight" :cover="pairCover" />
      </div>

      <!-- 最後一區：文字敘述 -->
      <div id="sec-reference">
        <Outro title="Reference" :paragraphs="outroText" :photos="outroPhotos" />
      </div>

      <!-- 右上角的漢堡選單（進到主畫面後才出現） -->
      <NavMenu :sections="menuSections" />
    </template>

    <!-- 跟隨滑鼠的 logo：一直存在，只是一開始隱藏 -->
    <img
      ref="follower"
      :src="logoUrl"
      alt=""
      aria-hidden="true"
      class="cursor-follower"
    />
  </main>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Rubik+Spray+Paint&display=swap');

html,
body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.button-font {
  font-family: "Cherry Bomb One", system-ui;
}

.cursor-follower {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 50;
  pointer-events: none; /* 關鍵：不能擋住底下 canvas 的滑鼠事件 */
  visibility: hidden;   /* 由 GSAP 的 autoAlpha 打開 */
  will-change: transform;
}
</style>