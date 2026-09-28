// The intro splash plays once per browser session.
const SEEN_KEY = 'mockerai:intro-seen'

export function shouldShowSplash() {
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

export function markSplashSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Storage blocked: the intro simply plays again next load.
  }
}
