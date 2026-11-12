<script setup>
// 往下捲動：兩張照片依序出現，每張都是 照片 → 手繪箭頭 → 文字標籤
// 順序：① 照片A ② 箭頭A ③ 標籤A ④ 照片B ⑤ 箭頭B ⑥ 標籤B
// 再往下捲：原本的兩組往上飄走，另外兩張從下方升上來（extras）
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({
  // [{ src, label, alt }]
  items: { type: Array, required: true },
  // 原本兩組之後，再往下捲出現的另外兩張圖片：[{ src, alt }]
  extras: { type: Array, default: () => [] },
  // 捲動距離：幾個螢幕高（多了換圖的段落，所以比原本多 1）
  length: { type: Number, default: 4 },
})

const rootRef = useTemplateRef('root')
const headEls = []
const rowRef = useTemplateRef('row')
const extraRowRef = useTemplateRef('extraRow')
let ctx = null

// 手繪感的箭頭：往右 → 繞一個小圈 → 往右下指向頭頂（座標在 viewBox 0 0 200 140 裡）
const ARROW_D =
  'M 8 22 C 40 10, 72 14, 92 34 C 104 47, 96 60, 84 54 C 72 48, 82 32, 100 38 C 126 46, 150 74, 168 100 C 174 109, 180 118, 186 128'

onMounted(() => {
  ctx = gsap.context(() => {
    const heads = headEls.filter(Boolean)
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })

    heads.forEach((head, i) => {
      const photo = head.querySelector('.head__photo')
      const arrow = head.querySelector('.head__arrow path')
      const chars = head.querySelectorAll('.head__char')
      const len = arrow.getTotalLength()

      // 初始狀態：全部藏起來
      gsap.set(photo, { autoAlpha: 0, y: 80, scale: 0.9, rotate: i % 2 ? 4 : -4 })
      gsap.set(arrow, { strokeDasharray: len, strokeDashoffset: len })
      gsap.set(chars, { autoAlpha: 0, y: 24, rotate: -12 })

      // ① / ④ 照片從下方彈上來
      tl.addLabel(`photo${i}`)
      tl.to(photo, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 1, ease: 'back.out(1.4)' }, `photo${i}`)

      // ② / ⑤ 箭頭一筆畫出來（從標籤往頭頂）
      tl.addLabel(`arrow${i}`)
      tl.to(arrow, { strokeDashoffset: 0, duration: 0.9, ease: 'power1.inOut' }, `arrow${i}`)

      // ③ / ⑥ 文字逐字跳出
      tl.addLabel(`label${i}`)
      tl.to(chars, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.05 }, `label${i}`)

      tl.addLabel(`done${i}`)
      tl.to({}, { duration: 0.5 }) // 每組完成後停一下
    })

    // ⑦ 再往下捲：換成另外兩張（跟著滾輪走，往回捲會倒帶）
    const hasExtras = extraRowRef.value && props.extras.length
    if (hasExtras) {
      const extras = extraRowRef.value.querySelectorAll('.extra')
      tl.addLabel('swap')

      // 原本的兩組（照片＋箭頭＋文字）往上飄走、淡出；左邊先、右邊稍後
      tl.to(
        heads,
        { y: () => -window.innerHeight * 0.6, autoAlpha: 0, duration: 0.9, ease: 'power2.in', stagger: 0.12 },
        'swap',
      )

      // 另外兩張從下方升上來、淡入；一樣左邊先、右邊後
      tl.fromTo(
        extras,
        { y: () => window.innerHeight * 0.5, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', stagger: 0.15 },
        'swap+=0.4', // 上面那排走到一半時開始，兩個動作交錯在一起
      )

      tl.addLabel('extra')
      tl.to({}, { duration: 0.6 }) // 停留一下
    }

    // 停手時吸附到「每一組剛完成」和「換成另外兩張」的位置
    const total = tl.duration()
    const points = [0, ...heads.map((_, i) => tl.labels[`done${i}`] / total)]
    if (hasExtras) points.push(tl.labels.extra / total)
    points.push(1)
    const snapTo = (value, self) => {
      const dir = self?.direction ?? 1
      if (dir > 0) return points.find((p) => p >= value - 0.001) ?? value
      return [...points].reverse().find((p) => p <= value + 0.001) ?? value
    }

    ScrollTrigger.create({
      trigger: rootRef.value,
      start: 'top top',
      end: () => `+=${window.innerHeight * props.length}`,
      pin: true,
      scrub: 0.6,
      animation: tl,
      invalidateOnRefresh: true,
      snap: { snapTo, duration: { min: 0.2, max: 0.7 }, delay: 0.05, inertia: false, ease: 'power1.inOut' },
    })
  }, rootRef.value)
})

onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <section ref="root" class="heads">
    <div ref="row" class="heads__row">
      <figure
        v-for="(item, i) in props.items"
        :key="i"
        :ref="(el) => (headEls[i] = el)"
        class="head"
      >
        <!-- ③ / ⑥ 標籤：拆成一個一個字，才能逐字跳出 -->
        <figcaption class="head__label">
          <span v-for="(ch, k) in [...item.label]" :key="k" class="head__char">{{ ch }}</span>
        </figcaption>

        <!-- ② / ⑤ 手繪箭頭 -->
        <svg class="head__arrow" viewBox="0 0 200 140" aria-hidden="true">
          <path :d="ARROW_D" />
        </svg>

        <!-- ① / ④ 照片 -->
        <img class="head__photo" :src="item.src" :alt="item.alt || item.label" draggable="false" />
      </figure>
    </div>

    <!-- ⑦ 再往下捲才出現的另外兩張（一開始隱藏，位置和上面那排一樣） -->
    <div v-if="props.extras.length" ref="extraRow" class="heads__row heads__row--extra">
      <figure v-for="(item, i) in props.extras" :key="i" class="extra">
        <img :src="item.src" :alt="item.alt || ''" draggable="false" />
      </figure>
    </div>
  </section>
</template>

<style scoped>
.heads {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.heads__row {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: clamp(1rem, 4vw, 4rem);
  width: min(94vw, 1400px);
  margin: auto;
}

/* 另外兩張：每格置中，圖片完整顯示不裁切 */
.extra {
  margin: 0;
  aspect-ratio: 1 / 0.75;
  display: grid;
  place-items: center;
}

.extra img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
}

/* 每一組：標籤在左上、箭頭從標籤指向頭頂、照片在右下 */
.head {
  position: relative;
  margin: 0;
  aspect-ratio: 1 / 0.75;
}

.head__label {
  position: absolute;
  z-index: 2; /* 文字和箭頭在照片上面，不會被擋住 */
  left: 6%;
  top: 2%;
  font-family: 'Cherry Bomb One', system-ui;
  font-size: clamp(1.1rem, 2.4vw, 2.4rem);
  color: #8b0f1e;
  white-space: pre; /* 保留字中間的空白 */
}

.head__char {
  display: inline-block; /* 才能對每個字做 transform */
}

.head__arrow {
  position: absolute;
  z-index: 2;
  left: 12%;
  top: 12%;
  width: 26%;
  overflow: visible;
}

.head__arrow path {
  fill: none;
  stroke: #8b0f1e;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.head__photo {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  width: 66%;
  height: auto;
  user-select: none;
  will-change: transform;
}

/* 手機：上下排 */
@media (max-width: 768px) {
  .heads__row {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 1rem;
  }
  .head,
  .extra {
    width: min(86vw, 420px);
    justify-self: center;
  }
}
</style>