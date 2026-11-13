<script setup>
// 最後一區：文字敘述＋周圍散落的照片（沒有任何特效）
import { ref, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'

const props = defineProps({
  title: { type: String, default: 'CHIHUAHUA' },
  // 每一個字串是一段
  paragraphs: { type: Array, default: () => [] },
  // 文字周圍的照片：[{ src, alt }]，順序對應下面 LAYOUT 的位置
  photos: { type: Array, default: () => [] },
})

// 每張照片「中心點」的位置，以「文字區塊」為基準（照草圖上的紅圈量的）
// x / width：文字區塊寬度的 %（0 = 文字左緣、100 = 文字右緣，負數或超過 100 = 在文字外面）
// y：文字區塊高度的 %（0 = 標題上緣、100 = 最後一行下緣）
// ratio：照片的寬 ÷ 高
const LAYOUT = [
  { x: 12, y: 10, width: 17, ratio: 1.6 }, // 1 標題左邊
  { x: -4, y: 70, width: 17, ratio: 1.25 }, // 2 第 4 行左邊
  { x: 76, y: 97, width: 17, ratio: 1.19 }, // 3 第 5 行右邊
  { x: 95, y: 48, width: 17, ratio: 1.46 }, // 4 第 2、3 行右邊
  { x: 80, y: 23, width: 17, ratio: 1.54 }, // 5 標題右下、第 1 行尾
]

// 每張照片放大幾倍（以自己的中心為基準，位置不變）
const SCALE = 1

// 文字兩側放不下照片時（例如手機），照片改排在文字下方
// 依照照片最左、最右的位置，自動算出需要「文字寬度的幾倍」才放得下（再多留 8% 邊距）
const extentLeft = Math.min(0, ...LAYOUT.map((b) => b.x - (b.width * SCALE) / 2))
const extentRight = Math.max(100, ...LAYOUT.map((b) => b.x + (b.width * SCALE) / 2))
const NEEDED_RATIO = (extentRight - extentLeft) / 100 + 0.08
// 文字區塊最窄要有多寬，照片才散在兩側；再窄就改排到文字下方
const MIN_TEXT_WIDTH = 480
const sectionRef = useTemplateRef('section')
const stacked = ref(false)
let ro = null

// 文字區塊寬度會被限制在「可用寬度 ÷ NEEDED_RATIO」（見 CSS），
// 太長的文字（例如網址）會自動換行，照片永遠放得下；只有畫面太窄時才改排在下面
function checkFit() {
  const el = sectionRef.value
  if (!el) return
  const cs = getComputedStyle(el)
  const available = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  stacked.value = available / NEEDED_RATIO < MIN_TEXT_WIDTH
}

onMounted(() => {
  ro = new ResizeObserver(checkFit)
  ro.observe(sectionRef.value)
  checkFit()
})

onBeforeUnmount(() => ro?.disconnect())

const photoStyle = (i) => {
  const box = LAYOUT[i]
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.width}%`,
    aspectRatio: box.ratio,
    '--photo-scale': SCALE,
  }
}
</script>

<template>
  <section
    ref="section"
    class="outro"
    :class="{ 'is-stacked': stacked }"
    :style="{ '--needed-ratio': NEEDED_RATIO }"
  >
    <div class="outro__inner">
      <h2 class="outro__title">{{ props.title }}</h2>
      <p v-for="(text, i) in props.paragraphs" :key="i" class="outro__text">{{ text }}</p>

      <!-- 照片：以文字區塊為基準排在周圍，在文字後面一層 -->
      <div v-if="props.photos.length" class="outro__photos">
        <figure
          v-for="(p, i) in props.photos.slice(0, LAYOUT.length)"
          :key="i"
          class="outro__photo"
          :style="photoStyle(i)"
        >
          <img :src="p.src" :alt="p.alt || ''" draggable="false" />
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.outro {
  width: 100%;
  min-height: 100vh;
  display: grid;
  place-items: center;
  /* 上下留一點空間（照片都在文字旁邊，不用留太多） */
  padding: clamp(5rem, 14vh, 9rem) clamp(1.25rem, 5vw, 4rem);
  box-sizing: border-box;
  overflow-x: clip; /* 只裁左右，避免出現橫向捲軸；上下不裁，照片才不會被切掉 */
}

/* 文字區塊：寬度剛好等於最長那一行，照片以它為基準定位 */
.outro__inner {
  position: relative;
  width: fit-content;
  max-width: min(100%, 1280px);
  text-align: center;
  color: #1a1a1a;
}

/* 照片散在兩側時：文字區塊不能太寬，要留位置給左右的照片（太長的字會換行） */
.outro:not(.is-stacked) .outro__inner {
  max-width: min(1280px, calc(100% / var(--needed-ratio)));
}

.outro__title,
.outro__text {
  position: relative;
  z-index: 1; /* 文字在照片上面，不會被蓋住 */
}

.outro__title {
  margin: 0 0 1.5rem;
  font-family: 'Cherry Bomb One', system-ui;
  font-weight: 400;
  font-size: clamp(2.5rem, 7vw, 5rem);
  line-height: 1.1;
  color: #fd8326;
}

.outro__text {
  margin: 0 0 1.1rem;
  text-align: left; /* 參考資料靠左對齊，標題維持置中 */
  font-family: 'Cherry Bomb One', system-ui;
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  line-height: 1.8;
  overflow-wrap: anywhere; /* 很長的網址可以換行，不會撐破畫面 */
}

.outro__text:last-of-type {
  margin-bottom: 0;
}

/* ---------- 照片 ---------- */
.outro__photos {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.outro__photo {
  position: absolute;
  margin: 0;
  /* left / top 是照片中心點：先往回移半張，再以中心放大 */
  transform: translate(-50%, -50%) scale(var(--photo-scale, 1));
}

.outro__photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

/* ---------- 文字兩側放不下時：照片改排在文字下面 ---------- */
.is-stacked {
  padding-block: clamp(3rem, 8vh, 6rem);
}
.is-stacked .outro__photos {
  position: static;
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 一排 3 張，照片比較大 */
  gap: 0.75rem;
  margin-top: 2rem;
}
.is-stacked .outro__photo {
  position: static;
  width: auto !important;
  aspect-ratio: 1 !important;
  transform: none; /* 排在下面時不用再放大 */
}

@media (max-width: 600px) {
  .is-stacked .outro__photos {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>