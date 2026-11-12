<script setup>
// 滾到這一區時：鎖住滾動 → 第 1 張出現 → 間隔越來越短地依序出現到最後一張 → 解鎖
// 這一段是「用時間播放」，不是跟著滾輪走
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { navState } from '../composables/scroll-nav'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({
  // 照「出現順序」排好的照片：[{ src, alt }]，第 1 個就是第 1 張出現的
  photos: { type: Array, required: true },
  interval: { type: Number, default: 0.8 }, // 第 1 張到第 2 張的間隔（秒）
  decay: { type: Number, default: 0.7 }, // 每次間隔乘上多少：0.8 = 每次縮短 20%
  minInterval: { type: Number, default: 0.15 }, // 間隔最短不低於幾秒
})

// 每張圖放大幾倍（以自己的中心為基準，位置關係不變）
const SCALE = 1.3

// 每一張的位置和大小（照草圖量的，單位是整個區塊的 %）
// 陣列順序 = 出現順序：第 1 張、第 2 張 … 第 10 張
const LAYOUT = [
  { left: 5.4, top: 6.6, width: 17.9, height: 31.0 }, // 1 左上
  { left: 73.1, top: 62.5, width: 22.3, height: 32.3 }, // 2 右下
  { left: 62.6, top: 7.1, width: 19.0, height: 32.5 }, // 3 右上
  { left: 24.0, top: 65.1, width: 19.1, height: 32.0 }, // 4 左下
  { left: 29.7, top: 8.0, width: 20.4, height: 31.3 }, // 5 上方中間
  { left: 58.0, top: 36.3, width: 21.6, height: 32.4 }, // 6 右邊中間
  { left: 10.0, top: 48.1, width: 19.0, height: 34.5 }, // 7 左邊中間
  { left: 47.0, top: 70.0, width: 19.0, height: 28.0 }, // 8 下方中間（4 和 2 之間的空位）
  { left: 82.0, top: 3.0, width: 15.5, height: 27.0 }, // 9 右上角（3 的右邊）
  { left: 39.3, top: 34.3, width: 22.9, height: 37.1 }, // 10 正中間（最後出現、在最上層）
]

// 以中心放大後的位置
const boxStyle = (box, i) => {
  const w = box.width * SCALE
  const h = box.height * SCALE
  return {
    left: `${box.left - (w - box.width) / 2}%`,
    top: `${box.top - (h - box.height) / 2}%`,
    width: `${w}%`,
    height: `${h}%`,
    zIndex: i + 1, // 越晚出現越上層
  }
}

// ---------- 鎖住滾動 ----------
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar'])
const preventScroll = (e) => e.preventDefault()
const preventKeys = (e) => {
  if (SCROLL_KEYS.has(e.key)) e.preventDefault()
}
let locked = false
let holdY = 0 // 鎖住期間要固定在的捲動位置

// 每一幀、每次頁面被推動時，都把畫面拉回 holdY
// （平滑滾動、觸控板慣性、前面區塊的吸附動畫，都可能在鎖住後繼續推頁面）
function hold() {
  if (locked && Math.abs(window.scrollY - holdY) > 0.5) {
    window.scrollTo({ top: holdY, behavior: 'instant' })
  }
}

function lockScroll(y) {
  holdY = y
  window.scrollTo({ top: holdY, behavior: 'instant' })
  if (locked) return
  locked = true
  document.documentElement.style.overflow = 'hidden' // 直接停掉瀏覽器正在進行的捲動
  window.addEventListener('wheel', preventScroll, { passive: false })
  window.addEventListener('touchmove', preventScroll, { passive: false })
  window.addEventListener('keydown', preventKeys)
  window.addEventListener('scroll', hold)
  gsap.ticker.add(hold)
}
function unlockScroll() {
  if (!locked) return
  locked = false
  document.documentElement.style.overflow = ''
  window.removeEventListener('wheel', preventScroll)
  window.removeEventListener('touchmove', preventScroll)
  window.removeEventListener('keydown', preventKeys)
  window.removeEventListener('scroll', hold)
  gsap.ticker.remove(hold)
}

const rootRef = useTemplateRef('root')
const itemEls = []
let ctx = null
let beforeJump = null
let afterJump = null

onMounted(() => {
  ctx = gsap.context(() => {
    const items = itemEls.filter(Boolean)
    gsap.set(items, { autoAlpha: 0, scale: 0.85 })

    // 算出每一張出現的時間：間隔從 interval 開始，每次乘上 decay
    const times = []
    let t = 0
    let gap = props.interval
    items.forEach((_, i) => {
      times.push(t)
      t += gap
      gap = Math.max(props.minInterval, gap * props.decay)
    })

    // 播完才解鎖
    const tl = gsap.timeline({ paused: true, onComplete: unlockScroll })
    items.forEach((el, i) => {
      tl.to(el, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, times[i])
    })

    const st = ScrollTrigger.create({
      trigger: rootRef.value,
      start: 'top top', // 這一區完全進入畫面時
      onEnter: (self) => {
        // 選單跳轉途中經過這一區：不要攔下來，直接顯示播完的樣子
        if (navState.jumping) {
          tl.progress(1)
          return
        }
        // 滾太快時，偵測到的時候已經超過這一區頂端了 → 拉回頂端並固定住
        // 要 +1：剛好停在起點會被判定成「還沒進入」而觸發重置
        lockScroll(self.start + 1)
        tl.restart()
      },
      // 往回滾到這一區上面時重置，下次滾下來會重新播一次
      onLeaveBack: () => {
        tl.pause(0)
        unlockScroll()
      },
    })

    // 選單要跳轉時：如果正在鎖住，先解鎖並直接顯示全部
    beforeJump = () => {
      if (locked) {
        tl.progress(1)
        unlockScroll()
      }
    }
    // 選單跳轉結束時：如果目的地就是這一區的開頭，照常鎖住並播放
    afterJump = () => {
      if (Math.abs(window.scrollY - st.start) < 3 && tl.progress() === 0) {
        lockScroll(st.start + 1)
        tl.restart()
      }
    }
    navState.beforeJump.add(beforeJump)
    navState.afterJump.add(afterJump)
  }, rootRef.value)
})

onBeforeUnmount(() => {
  navState.beforeJump.delete(beforeJump)
  navState.afterJump.delete(afterJump)
  unlockScroll()
  ctx?.revert()
})
</script>

<template>
  <section ref="root" class="collage">
    <div class="collage__stage">
      <div
        v-for="(box, i) in LAYOUT.slice(0, props.photos.length)"
        :key="i"
        :ref="(el) => (itemEls[i] = el)"
        class="collage__item"
        :style="boxStyle(box, i)"
      >
        <img :src="props.photos[i].src" :alt="props.photos[i].alt || ''" draggable="false" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.collage {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: grid;
  place-items: center;
}

/* 舞台固定和草圖一樣的比例（2000 × 830），照片位置才不會因螢幕大小跑掉 */
.collage__stage {
  position: relative;
  width: min(96vw, calc(92vh * 2000 / 830));
  aspect-ratio: 2000 / 830;
}

.collage__item {
  position: absolute;
  will-change: transform;
}

.collage__item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}
</style>