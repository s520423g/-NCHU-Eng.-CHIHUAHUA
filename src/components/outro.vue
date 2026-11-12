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

// 每張照片的位置，以「文字區塊」為基準（照草圖量的）
// left / width：文字區塊寬度的 %（0 = 文字左緣、100 = 文字右緣，負數或超過 100 = 在文字外面）
// top：文字區塊高度的 %（0 = 標題上緣、100 = 最後一行下緣）
// ratio：照片的寬 ÷ 高
const LAYOUT = [
  { left: 1.5, top: -5, width: 16.6, ratio: 1.6 }, // 1 標題左邊
  { left: 74, top: -43, width: 17.7, ratio: 1.25 }, // 2 標題右上
  { left: 111.6, top: 54, width: 19.7, ratio: 1.19 }, // 3 文字右邊
  { left: -27, top: 79, width: 21.2, ratio: 1.46 }, // 4 文字左下
  { left: 69, top: 121, width: 22.8, ratio: 1.54 }, // 5 文字下方
]

// 每張照片放大幾倍（以自己的中心為基準，位置排法不變）
const SCALE = 1.4

// 文字兩側放不下照片時（例如筆電、平板），照片改排在文字下方
// 依照放大後照片最左、最右的位置，自動算出需要「文字寬度的幾倍」才放得下（再多留 8% 邊距）
const extentLeft = Math.min(...LAYOUT.map((b) => b.left - (b.width * (SCALE - 1)) / 2))
const extentRight = Math.max(...LAYOUT.map((b) => b.left + b.width + (b.width * (SCALE - 1)) / 2))
const NEEDED_RATIO = (extentRight - extentLeft) / 100 + 0.08
const sectionRef = useTemplateRef('section')
const innerRef = useTemplateRef('inner')
const stacked = ref(false)
let ro = null

function checkFit() {
  if (!sectionRef.value || !innerRef.value) return
  const available = sectionRef.value.clientWidth
  const textWidth = innerRef.value.offsetWidth
  stacked.value = textWidth * NEEDED_RATIO > available
}

onMounted(() => {
  ro = new ResizeObserver(checkFit)
  ro.observe(sectionRef.value)
  ro.observe(innerRef.value)
  document.fonts?.ready.then(checkFit) // 字型載入後文字寬度會變，再量一次
})

onBeforeUnmount(() => ro?.disconnect())

const photoStyle = (i) => {
  const box = LAYOUT[i]
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    aspectRatio: box.ratio,
    '--photo-scale': SCALE,
  }
}
</script>

<template>
  <section ref="section" class="outro" :class="{ 'is-stacked': stacked }">
    <div ref="inner" class="outro__inner">
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
  /* 上下多留空間給文字區塊外面的照片（下方的照片 5 比較低，所以下面留更多） */
  padding: clamp(10rem, 28vh, 18rem) clamp(1.25rem, 5vw, 4rem) clamp(14rem, 40vh, 24rem);
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
  transform: scale(var(--photo-scale, 1)); /* 以中心放大 */
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