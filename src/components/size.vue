<script setup>
// 左右兩張照片直接出現；往下捲到一半，第三張直接蓋在左邊那張上面（沒有任何特效）
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({
  left: { type: String, required: true },
  right: { type: String, required: true },
  cover: { type: String, required: true }, // 蓋上去的第三張
  leftAlt: { type: String, default: '' },
  rightAlt: { type: String, default: '' },
  coverAlt: { type: String, default: '' },
  // 捲動距離：幾個螢幕高
  length: { type: Number, default: 1 },
})

const rootRef = useTemplateRef('root')
const coverRef = useTemplateRef('coverImg')
let ctx = null

onMounted(() => {
  ctx = gsap.context(() => {
    // 第三張一開始隱藏
    gsap.set(coverRef.value, { autoAlpha: 0 })

    // 捲到一半時，第三張直接出現；往回捲過一半又直接消失
    const tl = gsap.timeline()
    tl.to({}, { duration: 1 }) // 空的時間軸，只用來對應捲動進度
    tl.set(coverRef.value, { autoAlpha: 1 }, 0.5)

    ScrollTrigger.create({
      trigger: rootRef.value,
      start: 'top top',
      end: () => `+=${window.innerHeight * props.length}`,
      pin: true,
      scrub: true, // 不延遲，捲到就出現
      animation: tl,
      invalidateOnRefresh: true,
    })
  }, rootRef.value)
})

onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <section ref="root" class="pair">
    <div class="pair__row">
      <!-- 左邊：底下那張＋蓋上去的第三張疊在同一格 -->
      <div class="pair__cell">
        <img class="pair__img" :src="props.left" :alt="props.leftAlt" draggable="false" />
        <img ref="coverImg" class="pair__img pair__img--cover" :src="props.cover" :alt="props.coverAlt" draggable="false" />
      </div>

      <!-- 右邊 -->
      <div class="pair__cell">
        <img class="pair__img" :src="props.right" :alt="props.rightAlt" draggable="false" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.pair {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.pair__row {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: clamp(0.5rem, 2vw, 2rem);   /* 間距縮小 */
  width: min(96vw, 1700px);        /* 整排變寬 */
  margin: auto;
}

/* 每一格：欄寬 × 畫面高度 80%，圖片會用 contain 撐到最大 */
.pair__cell {
  position: relative;
  width: 100%;
  height: 80vh;                    /* 想再大就調到 88vh */
}

.pair__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

/* 蓋上去的那張：在上層
   位置改用 %，格子變大時會跟著等比例移動 */
.pair__img--cover {
  height: 90%;
  top: 2%;
  left: 15%;
  z-index: 2;
}

/* 手機：上下排，每格各佔畫面高度約 4 成 */
@media (max-width: 768px) {
  .pair__row {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 0.75rem;
  }
  .pair__cell {
    height: 42vh;
  }
}
</style>