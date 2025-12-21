/**
 * Law URL Utilities
 * Handles deep linking to specific laws and sections
 *
 * URL Format: ?law={lawId}&country={country}&section={sectionId}
 * Example: ?law=abc123&country=AT&section=§5
 */

/**
 * Parse URL parameters to extract law navigation info
 * @returns {{ lawId: string|null, country: string|null, section: string|null }}
 */
export function parseLawUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    return {
      lawId: params.get('law'),
      country: params.get('country'),
      section: params.get('section')
    }
  } catch {
    return { lawId: null, country: null, section: null }
  }
}

/**
 * Build a URL for linking to a specific law
 * @param {string} lawId - The law ID
 * @param {string} country - The country code (AT, DE, NL)
 * @param {string} [section] - Optional section identifier (e.g., "§ 5", "Artikel 3")
 * @returns {string} - The URL string
 */
export function buildLawUrl(lawId, country, section = null) {
  const params = new URLSearchParams()

  if (lawId) params.set('law', lawId)
  if (country) params.set('country', country)
  if (section) params.set('section', section)

  const queryString = params.toString()
  return queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname
}

/**
 * Update the browser URL without triggering navigation
 * @param {string} lawId - The law ID
 * @param {string} country - The country code
 * @param {string} [section] - Optional section identifier
 */
export function updateLawUrl(lawId, country, section = null) {
  const url = buildLawUrl(lawId, country, section)
  window.history.pushState({ lawId, country, section }, '', url)
}

/**
 * Replace the current URL state without adding to history
 * @param {string} lawId - The law ID
 * @param {string} country - The country code
 * @param {string} [section] - Optional section identifier
 */
export function replaceLawUrl(lawId, country, section = null) {
  const url = buildLawUrl(lawId, country, section)
  window.history.replaceState({ lawId, country, section }, '', url)
}

/**
 * Clear law parameters from URL
 */
export function clearLawUrl() {
  window.history.pushState({}, '', window.location.pathname)
}

/**
 * Generate a shareable link for a specific law/section
 * @param {string} lawId - The law ID
 * @param {string} country - The country code
 * @param {string} [section] - Optional section identifier
 * @returns {string} - Full URL including origin
 */
export function getShareableLink(lawId, country, section = null) {
  const params = new URLSearchParams()

  if (lawId) params.set('law', lawId)
  if (country) params.set('country', country)
  if (section) params.set('section', section)

  const queryString = params.toString()
  return `${window.location.origin}${window.location.pathname}?${queryString}`
}

/**
 * Parse a section identifier from German/Dutch legal text
 * Handles formats like "§ 5", "§ 5a", "Artikel 3.2", "§ 5 Verbot der Nachtarbeit"
 * @param {string} sectionText - The section text to parse
 * @returns {{ type: 'paragraph'|'artikel'|'unknown', number: string, title: string|null }}
 */
export function parseSectionIdentifier(sectionText) {
  if (!sectionText || typeof sectionText !== 'string') {
    return { type: 'unknown', number: '', title: null }
  }

  // German/Austrian § format: "§ 5", "§ 5a", "§ 5 Verbot der Nachtarbeit"
  const paragraphMatch = sectionText.match(/§\s*(\d+[a-z]?)\s*(.*)/)
  if (paragraphMatch) {
    return {
      type: 'paragraph',
      number: paragraphMatch[1],
      title: paragraphMatch[2]?.trim() || null
    }
  }

  // Dutch Artikel format: "Artikel 3", "Artikel 3.2"
  const artikelMatch = sectionText.match(/Artikel\s+(\d+(?:\.\d+)?)\s*(.*)/)
  if (artikelMatch) {
    return {
      type: 'artikel',
      number: artikelMatch[1],
      title: artikelMatch[2]?.trim() || null
    }
  }

  return { type: 'unknown', number: '', title: sectionText }
}

/**
 * Find a section element in the DOM by its identifier
 * @param {string} sectionId - The section identifier (e.g., "§5", "artikel-3.2")
 * @returns {HTMLElement|null}
 */
export function findSectionElement(sectionId) {
  if (!sectionId) return null

  // Try to find by data attribute
  let element = document.querySelector(`[data-section-id="${sectionId}"]`)
  if (element) return element

  // Try to find by id
  element = document.getElementById(sectionId)
  if (element) return element

  // Try to find by section number in text
  const parsed = parseSectionIdentifier(sectionId)
  if (parsed.type === 'paragraph') {
    // Look for elements containing "§ X"
    const selector = `[data-section-number="${parsed.number}"]`
    element = document.querySelector(selector)
    if (element) return element
  } else if (parsed.type === 'artikel') {
    // Look for Artikel X
    const selector = `[data-section-number="${parsed.number}"]`
    element = document.querySelector(selector)
    if (element) return element
  }

  return null
}

/**
 * Scroll to a section element smoothly
 * @param {string} sectionId - The section identifier
 * @param {number} [offset=80] - Offset from top for fixed headers
 */
export function scrollToSection(sectionId, offset = 80) {
  const element = findSectionElement(sectionId)
  if (element) {
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset
    window.scrollTo({ top, behavior: 'smooth' })

    // Highlight the element briefly
    element.classList.add('ring-2', 'ring-whs-orange-500', 'ring-offset-2')
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-whs-orange-500', 'ring-offset-2')
    }, 2000)

    return true
  }
  return false
}
