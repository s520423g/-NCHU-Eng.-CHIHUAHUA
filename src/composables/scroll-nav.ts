// 選單跳轉和各區塊之間的共用狀態
// - jumping：選單正在把頁面捲到某一區（途中經過的區塊不要攔截）
// - beforeJump：跳轉開始前要做的事（例如照片牆先解除鎖定）
// - afterJump：跳轉結束後要做的事（例如抵達照片牆時開始播放）
export const navState = {
  jumping: false,
  beforeJump: new Set(),
  afterJump: new Set(),
}