<script setup>
// 右上角的漢堡按鈕＋全螢幕選單，點選項目會平滑捲到該區塊
import { ref, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { navState } from '../composables/scroll-nav'

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger)

const props = defineProps({
  // [{ id: 'sec-xxx', label: '顯示的文字' }]，id 是區塊外層 div 的 id；'top' 代表回到最上面
  sections: { type: Array, required: true },
})

const open = ref(false)
const overlayRef = useTemplateRef('overlay')
const itemEls = []
let openTl = null

function buildOpenTimeline() {
  const items = itemEls.filter(Boolean)
  openTl = gsap
    .timeline({ paused: true })
    // 從右上角的按鈕位置用圓形擴散打開
    .fromTo(
      overlayRef.value,
      { clipPath: 'circle(0% at calc(100% - 44px) 44px)', autoAlpha: 1 },
      { clipPath: 'circle(150% at calc(100% - 44px) 44px)', duration: 0.6, ease: 'power3.inOut' },
    )
    .fromTo(items, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, '-=0.25')
}

function toggle() {
  open.value ? close() : show()
}
function show() {
  open.value = true
  openTl.timeScale(1).play()
}
function close() {
  open.value = false
  openTl.timeScale(1.6).reverse()
}

// ---------- 跳到某一區 ----------
function goTo(id) {
  const target = id === 'top' ? 0 : document.getElementById(id)?.getBoundingClientRect().top + window.scrollY
  if (target == null || Number.isNaN(target)) return
  close()

  navState.beforeJump.forEach((fn) => fn()) // 例如：照片牆正在鎖住滾動 → 先解鎖
  navState.jumping = true

  const distance = Math.abs(target - window.scrollY)
  gsap.to(window, {
    scrollTo: { y: target, autoKill: false },
    duration: Math.min(1.6, 0.6 + distance / 6000), // 越遠稍微越久，但不會拖太長
    ease: 'power2.inOut',
    delay: 0.25, // 等選單收起一點再開始捲
    onComplete: () => {
      navState.jumping = false
      ScrollTrigger.update()
      navState.afterJump.forEach((fn) => fn()) // 例如：抵達照片牆 → 開始播放
    },
  })
}

const onKey = (e) => {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(async () => {
  await nextTick()
  gsap.set(overlayRef.value, { autoAlpha: 0 })
  buildOpenTimeline()
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  openTl?.kill()
})
</script>

<template>
  <!-- 漢堡按鈕 -->
  <button
    type="button"
    class="nav-toggle"
    :class="{ 'is-open': open }"
    :aria-expanded="open"
    aria-controls="site-menu"
    :aria-label="open ? '關閉選單' : '打開選單'"
    @click="toggle"
  >
    <span></span>
    <span></span>
    <span></span>
  </button>

  <!-- 全螢幕選單 -->
  <nav id="site-menu" ref="overlay" class="nav-overlay" :aria-hidden="!open" @wheel.prevent @touchmove.prevent>
    <ol class="nav-list">
      <li v-for="(s, i) in props.sections" :key="s.id" :ref="(el) => (itemEls[i] = el)">
        <button type="button" class="nav-link" :tabindex="open ? 0 : -1" @click="goTo(s.id)">
          <span class="nav-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="nav-label">{{ s.label }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
/* ---------- 漢堡按鈕 ---------- */
.nav-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 45; /* 在選單上面、在跟隨滑鼠的 logo（50）下面 */
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  background: #1a1a1a;
  cursor: pointer;
  display: grid;
  place-content: center;
  gap: 5px;
}

.nav-toggle span {
  display: block;
  width: 20px;
  height: 2px;
  border-radius: 2px;
  background: #ffd65c;
  transition: transform 0.3s ease, opacity 0.2s ease;
}

/* 打開時變成 X */
.nav-toggle.is-open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.nav-toggle.is-open span:nth-child(2) {
  opacity: 0;
}
.nav-toggle.is-open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* ---------- 全螢幕選單 ---------- */
.nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: #1a1a1a;
  display: grid;
  place-items: center;
  overflow-y: auto;
}

.nav-list {
  margin: 0;
  padding: 4rem 1.5rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: clamp(0.25rem, 1.5vh, 1rem);
}

.nav-link {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 0.2rem 0;
  border: 0;
  background: none;
  color: #ffd65c;
  font-family: 'Cherry Bomb One', system-ui;
  font-size: clamp(1.8rem, 6vh, 3.5rem);
  line-height: 1.15;
  text-align: left;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
}

.nav-link:hover,
.nav-link:focus-visible {
  color: #ff8bb4;
  transform: translateX(8px);
  outline: none;
}

.nav-num {
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fd8326;
}
</style>