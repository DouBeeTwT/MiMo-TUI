/**
 * LaTeX → 2D Unicode renderer for terminal display.
 *
 * Pipeline: LaTeX string → KaTeX (MathML) → custom parser → Box2D → Unicode string
 */
import katex from "katex"

// ── Types ──────────────────────────────────────────────────────────────

interface Box2D {
  rows: string[]
  baseline: number // row index that is the "text baseline"
}

interface MathNode {
  tag: string
  attrs: Record<string, string>
  children: (MathNode | string)[]
}

// ── Unicode tables ─────────────────────────────────────────────────────

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ",
  "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ",
  "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "j": "ʲ", "k": "ᵏ",
  "l": "ˡ", "m": "ᵐ", "o": "ᵒ", "p": "ᵖ", "r": "ʳ",
  "s": "ˢ", "t": "ᵗ", "u": "ᵘ", "v": "ᵛ", "w": "ʷ",
  "x": "ˣ", "y": "ʸ", "z": "ᶻ",
}

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ",
  "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
  "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ",
  "v": "ᵥ", "x": "ₓ",
}

const GREEK: Record<string, string> = {
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\epsilon": "ε", "\\zeta": "ζ", "\\eta": "η", "\\theta": "θ",
  "\\iota": "ι", "\\kappa": "κ", "\\lambda": "λ", "\\mu": "μ",
  "\\nu": "ν", "\\xi": "ξ", "\\pi": "π", "\\rho": "ρ",
  "\\sigma": "σ", "\\tau": "τ", "\\upsilon": "υ", "\\phi": "φ",
  "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω",
  "\\Gamma": "Γ", "\\Delta": "Δ", "\\Theta": "Θ", "\\Lambda": "Λ",
  "\\Xi": "Ξ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Phi": "Φ",
  "\\Psi": "Ψ", "\\Omega": "Ω",
  "\\infty": "∞", "\\partial": "∂", "\\nabla": "∇",
  "\\sum": "∑", "\\prod": "∏", "\\int": "∫",
  "\\pm": "±", "\\times": "×", "\\div": "÷", "\\cdot": "·",
  "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈",
  "\\rightarrow": "→", "\\leftarrow": "←", "\\Rightarrow": "⇒",
  "\\forall": "∀", "\\exists": "∃", "\\in": "∈", "\\notin": "∉",
  "\\subset": "⊂", "\\cup": "∪", "\\cap": "∩",
  "\\ldots": "…", "\\cdots": "⋯", "\\vdots": "⋮",
  "\\quad": " ", "\\qquad": "  ", "\\,": " ", "\\;": " ",
  "\\!": "", "\\{": "{", "\\}": "}",
}

// ── MathML parser (regex-based, no DOM) ────────────────────────────────

function parseMathml(mathml: string): MathNode {
  // Strip the outer <math> wrapper
  const inner = mathml.replace(/<\/?math[^>]*>/g, "").trim()
  return parseElement(inner)
}

function parseElement(xml: string): MathNode {
  // Self-closing tag: <mi/>
  const selfClose = xml.match(/^<(\w+)([^>]*)\/>$/)
  if (selfClose) {
    return { tag: selfClose[1]!, attrs: parseAttrs(selfClose[2]!), children: [] }
  }

  // Opening tag
  const openMatch = xml.match(/^<(\w+)([^>]*)>/)
  if (!openMatch) {
    return { tag: "text", attrs: {}, children: [xml] }
  }

  const tag = openMatch[1]!
  const attrs = parseAttrs(openMatch[2]!)
  const openTagLen = openMatch[0].length
  const closeTag = `</${tag}>`
  const closeIdx = xml.lastIndexOf(closeTag)
  if (closeIdx === -1) {
    return { tag, attrs, children: [xml.slice(openTagLen)] }
  }

  const inner = xml.slice(openTagLen, closeIdx)
  const children = parseChildren(inner)
  return { tag, attrs, children }
}

function parseChildren(inner: string): (MathNode | string)[] {
  const result: (MathNode | string)[] = []
  let i = 0
  while (i < inner.length) {
    if (inner[i] === "<") {
      // Find the matching closing tag for this element
      const tagMatch = inner.slice(i).match(/^<(\w+)([^>]*)>/)
      if (!tagMatch) {
        i++
        continue
      }
      const tag = tagMatch[1]!
      const isSelfClose = inner.slice(i).match(/^<\w+[^>]*\/>/)
      if (isSelfClose) {
        result.push(parseElement(isSelfClose[0]))
        i += isSelfClose[0].length
        continue
      }
      // Find matching close tag, handling nesting
      const closeTag = `</${tag}>`
      let depth = 1
      let j = i + tagMatch[0].length
      while (j < inner.length && depth > 0) {
        const nextOpen = inner.indexOf(`<${tag}`, j)
        const nextClose = inner.indexOf(closeTag, j)
        if (nextClose === -1) break
        if (nextOpen !== -1 && nextOpen < nextClose) {
          // Check it's actually an opening tag, not self-close
          const checkSelf = inner.slice(nextOpen).match(/^<\w+[^>]*\/>/)
          if (!checkSelf) {
            depth++
            j = nextOpen + 1
          } else {
            j = nextOpen + checkSelf[0].length
          }
        } else {
          depth--
          if (depth === 0) {
            const elemXml = inner.slice(i, nextClose + closeTag.length)
            result.push(parseElement(elemXml))
            i = nextClose + closeTag.length
          } else {
            j = nextClose + closeTag.length
          }
        }
      }
      if (depth > 0) {
        // Fallback: just skip
        i++
      }
    } else {
      // Text node
      let j = i + 1
      while (j < inner.length && inner[j] !== "<") j++
      const text = inner.slice(i, j).trim()
      if (text) result.push(text)
      i = j
    }
  }
  return result
}

function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]!] = m[2]!
  }
  return attrs
}

// ── Box2D utilities ────────────────────────────────────────────────────

function textWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    // CJK and fullwidth characters count as 2
    if (code >= 0x1100 && (
      code <= 0x115f || code === 0x2329 || code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
    )) {
      w += 2
    } else {
      w += 1
    }
  }
  return w
}

function padRight(s: string, width: number): string {
  const diff = width - textWidth(s)
  return diff > 0 ? s + " ".repeat(diff) : s
}

function centerText(s: string, width: number): string {
  const sw = textWidth(s)
  if (sw >= width) return s
  const left = Math.floor((width - sw) / 2)
  const right = width - sw - left
  return " ".repeat(left) + s + " ".repeat(right)
}

function makeBox(text: string): Box2D {
  return { rows: [text], baseline: 0 }
}

function hConcat(boxes: Box2D[]): Box2D {
  if (boxes.length === 0) return makeBox("")

  // Find the max baseline and max depth below baseline
  let maxAbove = 0
  let maxBelow = 0
  for (const b of boxes) {
    maxAbove = Math.max(maxAbove, b.baseline)
    maxBelow = Math.max(maxBelow, b.rows.length - 1 - b.baseline)
  }
  const totalRows = maxAbove + maxBelow + 1
  const baseline = maxAbove

  // Build each row by aligning boxes to the shared baseline
  const rows: string[] = Array.from({ length: totalRows }, () => "")
  for (const b of boxes) {
    const offset = baseline - b.baseline
    for (let r = 0; r < totalRows; r++) {
      const srcRow = r - offset
      if (srcRow >= 0 && srcRow < b.rows.length) {
        rows[r] += b.rows[srcRow]!
      } else {
        rows[r] += " ".repeat(maxRowWidth(b))
      }
    }
  }

  return { rows, baseline }
}

function maxRowWidth(b: Box2D): number {
  let max = 0
  for (const r of b.rows) max = Math.max(max, textWidth(r))
  return max
}

// ── Superscript/Subscript conversion ───────────────────────────────────

function toSuperscript(text: string): string {
  let result = ""
  for (const ch of text) {
    result += SUPERSCRIPTS[ch] ?? ch
  }
  return result
}

function toSubscript(text: string): string {
  let result = ""
  for (const ch of text) {
    result += SUBSCRIPTS[ch] ?? ch
  }
  return result
}

/** Flatten a MathNode tree to plain text (for simple subscript/superscript content) */
function flattenToText(node: MathNode | string): string {
  if (typeof node === "string") return node
  if (node.tag === "text" || node.tag === "mi" || node.tag === "mn" || node.tag === "mo") {
    return node.children.map(c => typeof c === "string" ? c : flattenToText(c)).join("")
  }
  // For mrow and others, just flatten recursively
  return node.children.map(c => typeof c === "string" ? c : flattenToText(c)).join("")
}

// ── Core renderer ──────────────────────────────────────────────────────

function renderNode(node: MathNode | string): Box2D {
  if (typeof node === "string") {
    return makeBox(node)
  }

  switch (node.tag) {
    case "mi":
    case "mn":
    case "mo":
    case "ms": // space
    case "mtext": {
      const text = node.children.map(c => typeof c === "string" ? c : flattenToText(c)).join("")
      return makeBox(text)
    }

    case "mrow": {
      const childBoxes = node.children.map(c => renderNode(c))
      return hConcat(childBoxes)
    }

    case "mfrac": {
      const num = node.children[0] ? renderNode(node.children[0]) : makeBox("")
      const den = node.children[1] ? renderNode(node.children[1]) : makeBox("")
      const width = Math.max(maxRowWidth(num), maxRowWidth(den), 3)
      const bar = "─".repeat(width)
      const rows: string[] = [
        ...num.rows.map(r => centerText(r, width)),
        bar,
        ...den.rows.map(r => centerText(r, width)),
      ]
      return { rows, baseline: num.rows.length } // baseline = the bar row
    }

    case "msup": {
      const base = node.children[0] ? renderNode(node.children[0]) : makeBox("")
      const sup = node.children[1] ? flattenToText(node.children[1]) : ""
      // Try Unicode superscript for simple content
      const uniSup = toSuperscript(sup)
      if (uniSup !== sup) {
        // All characters have Unicode superscript — render inline
        return hConcat([base, makeBox(uniSup)])
      }
      // Fallback: raise the superscript
      const supBox = makeBox(sup)
      const width = maxRowWidth(base) + maxRowWidth(supBox)
      const rows: string[] = [
        " ".repeat(maxRowWidth(base)) + supBox.rows[0]!,
        ...base.rows,
      ]
      return { rows, baseline: 1 + base.baseline }
    }

    case "msub": {
      const base = node.children[0] ? renderNode(node.children[0]) : makeBox("")
      const sub = node.children[1] ? flattenToText(node.children[1]) : ""
      const uniSub = toSubscript(sub)
      if (uniSub !== sub) {
        return hConcat([base, makeBox(uniSub)])
      }
      const subBox = makeBox(sub)
      const rows: string[] = [
        ...base.rows,
        " ".repeat(maxRowWidth(base)) + subBox.rows[0]!,
      ]
      return { rows, baseline: base.baseline }
    }

    case "msubsup": {
      const base = node.children[0] ? renderNode(node.children[0]) : makeBox("")
      const sub = node.children[1] ? flattenToText(node.children[1]) : ""
      const sup = node.children[2] ? flattenToText(node.children[2]) : ""
      const uniSub = toSubscript(sub)
      const uniSup = toSuperscript(sup)
      if (uniSub !== sub && uniSup !== sup) {
        return hConcat([base, makeBox(uniSub + uniSup)])
      }
      // Fallback: stack
      const baseW = maxRowWidth(base)
      const supBox = makeBox(sup)
      const subBox = makeBox(sub)
      const sideW = Math.max(maxRowWidth(supBox), maxRowWidth(subBox))
      const rows: string[] = [
        " ".repeat(baseW) + padRight(supBox.rows[0]!, sideW),
        ...base.rows.map(r => padRight(r, baseW + sideW)),
        " ".repeat(baseW) + subBox.rows[0]!,
      ]
      return { rows, baseline: 1 + base.baseline }
    }

    case "msqrt": {
      const content = node.children[0] ? renderNode(node.children[0]) : makeBox("")
      const w = maxRowWidth(content)
      const overline = "‾".repeat(w + 1)
      const rows: string[] = [
        "  " + overline,
        ...content.rows.map(r => " √" + r),
      ]
      return { rows, baseline: 1 + content.baseline }
    }

    case "mtable":
    case "mtr":
    case "mtd": {
      // Simplified table rendering
      const childBoxes = node.children
        .filter(c => typeof c !== "string")
        .map(c => renderNode(c))
      if (node.tag === "mtable") {
        // Vertical stack of rows
        const allRows: string[] = []
        for (const b of childBoxes) {
          allRows.push(...b.rows)
        }
        return { rows: allRows, baseline: 0 }
      }
      if (node.tag === "mtr") {
        return hConcat(childBoxes)
      }
      // mtd
      return childBoxes[0] ?? makeBox("")
    }

    case "mpadded":
    case "mphantom":
    case "menclose":
    case "mstyle":
    case "semantics":
    case "annotation": {
      // Pass through to children
      const childBoxes = node.children
        .filter(c => typeof c !== "string")
        .map(c => renderNode(c))
      if (childBoxes.length === 1) return childBoxes[0]!
      if (childBoxes.length > 1) return hConcat(childBoxes)
      return makeBox("")
    }

    default: {
      // Unknown tag — render children
      const childBoxes = node.children.map(c => renderNode(c))
      if (childBoxes.length === 1) return childBoxes[0]!
      if (childBoxes.length > 1) return hConcat(childBoxes)
      return makeBox("")
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Render a LaTeX string to a single line (newlines → spaces).
 * Used by preprocessMarkdown for inline $...$ expressions.
 */
export function renderLatex(tex: string): string {
  return renderLatexRaw(tex).replace(/\n/g, " ")
}

/**
 * Render LaTeX preserving multi-line output (for display math).
 */
export function renderLatexBlock(tex: string): string {
  return renderLatexRaw(tex)
}

function renderLatexRaw(tex: string): string {
  try {
    const mathml = katex.renderToString(tex, {
      output: "mathml",
      throwOnError: false,
      strict: false,
    })
    const tree = parseMathml(mathml)
    const box = renderNode(tree)
    return box.rows.join("\n")
  } catch {
    return tex
  }
}

/**
 * Pre-process a markdown string: extract $...$ and $$...$$ LaTeX blocks,
 * render them to Unicode, and substitute back into the markdown text.
 *
 * Streaming-safe: if a `$` is unclosed, the trailing LaTeX is
 * left as-is so the next token can close it.
 */
export function preprocessMarkdown(content: string): string {
  let result = ""
  let i = 0

  while (i < content.length) {
    // $$ display math block
    if (content[i] === "$" && content[i + 1] === "$") {
      const end = content.indexOf("$$", i + 2)
      if (end !== -1) {
        const tex = content.slice(i + 2, end).trim()
        const rendered = renderLatexBlock(tex)
        result += rendered
        i = end + 2
        continue
      }
      // Unclosed $$ — leave as-is (streaming)
      result += content.slice(i)
      return result
    }

    // $ inline math
    if (content[i] === "$") {
      const end = content.indexOf("$", i + 1)
      if (end !== -1) {
        const tex = content.slice(i + 1, end).trim()
        if (tex) {
          const rendered = renderLatex(tex)
          result += rendered
        }
        i = end + 1
        continue
      }
      // Unclosed $ — leave as-is (streaming)
      result += content.slice(i)
      return result
    }

    result += content[i]
    i++
  }

  return result
}

/**
 * Check if a string contains LaTeX math delimiters.
 */
export function hasLatex(text: string): boolean {
  return /\$[^$]+\$/.test(text) || /\\[a-zA-Z]+/.test(text)
}
