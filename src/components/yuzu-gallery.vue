<script setup>
// 往下捲動：三張照片依序出現 → 再往下捲，正常捲到下一區（沒有特效）
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({
  // [{ src, title }]
  photos: { type: Array, required: true },
})

const rootRef = useTemplateRef('root')
const itemEls = []
let ctx = null

// clip-path 用負值往外放寬，避免陰影被切掉
const HIDDEN = { autoAlpha: 0, yPercent: -30, scale: 0.85, rotate: -4, clipPath: 'inset(-25% -20% 125% -20%)' }
const SHOWN = { autoAlpha: 1, yPercent: 0, scale: 1, rotate: 0, clipPath: 'inset(-20% -20% -25% -20%)' }

onMounted(() => {
  ctx = gsap.context(() => {
    const items = itemEls.filter(Boolean)
    const n = items.length
    gsap.set(items, HIDDEN)

    const tl = gsap.timeline({ defaults: { duration: 1, ease: 'power2.inOut' } })

    // 依序進場
    items.forEach((el, i) => {
      tl.addLabel(`in${i}`)
      tl.to(el, SHOWN, `in${i}`)
      tl.addLabel(`show${i}`)
      tl.to({}, { duration: 0.6 }) // 每張停留一下
    })

    const total = tl.duration()
    const showPoints = items.map((_, i) => tl.labels[`show${i}`] / total)
    // 吸附點：開頭、每一張剛出現好、結尾（結尾之後就正常捲到下一區）
    const snapPoints = [0, ...showPoints, 1]

    function snapTo(value, self) {
      const dir = self?.direction ?? 1
      if (dir > 0) return snapPoints.find((p) => p >= value - 0.001) ?? value
      return [...snapPoints].reverse().find((p) => p <= value + 0.001) ?? value
    }

    ScrollTrigger.create({
      trigger: rootRef.value,
      start: 'top top',
      end: () => `+=${window.innerHeight * n}`, // 每張照片佔一個螢幕高的捲動距離
      pin: true,
      scrub: 0.6,
      animation: tl,
      invalidateOnRefresh: true,
      snap: {
        snapTo,
        duration: { min: 0.2, max: 0.8 },
        delay: 0.05,
        inertia: false,
        ease: 'power1.inOut',
      },
    })
  }, rootRef.value)
})

onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <section ref="root" class="gallery">
    <div class="gallery__stage">
      <figure
        v-for="(p, i) in props.photos"
        :key="i"
        :ref="(el) => (itemEls[i] = el)"
        class="gallery__item"
      >
        <div class="gallery__media">
          <img :src="p.src" :alt="p.title" draggable="false" />
        </div>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.gallery__stage {
  position: absolute;
  inset: 0;
  /* 盡量撐寬（最多畫面寬 96%），
     但每張卡片高度不超過畫面高度 68%：
     卡片寬 = 高 ÷ 1.25 → 三張約 204vh，再加上兩個間距 */
  width: min(96vw, calc(204vh + 4rem));
  height: max-content;
  margin: auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: clamp(0.75rem, 2vw, 2rem);
  padding: 0 0 2rem;
}

.gallery__item {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  margin: 0;
  will-change: transform, clip-path;
}

.gallery__media {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 28px;
  box-shadow: 2px 2px 0 rgba(253, 131, 38, 0.9), 5px 5px 0 rgba(255, 139, 180, 0.7);
}

.gallery__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  transform: scale(1);
}

.gallery__item:hover .gallery__media img {
  transform: scale(1.12);
}
</style>