import type { Page } from './types'

const pages: Page[] = ['login', 'yonetim', 'katilim', 'cozum', 'izleme', 'sonuclar']

export function routeFromHash(): Page {
  const route = window.location.hash.replace('#/', '').split('?')[0] as Page
  return pages.includes(route) ? route : 'login'
}

export function navigate(page: Page) {
  window.location.hash = `/${page}`
}
